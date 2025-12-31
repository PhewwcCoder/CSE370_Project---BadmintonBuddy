import json
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
from django.utils.dateparse import parse_datetime


def _current_user_id(request):
    return request.session.get("user_id")


def _get_json(request):
    try:
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


@require_GET
def find_partners(request):
    user_id = _current_user_id(request)
    if not user_id:
        return JsonResponse({"error": "Not logged in"}, status=401)

    start_s = request.GET.get("start_time")
    end_s = request.GET.get("end_time")
    if not start_s or not end_s:
        return JsonResponse({"error": "start_time and end_time are required"}, status=400)

    start_dt = parse_datetime(start_s)
    end_dt = parse_datetime(end_s)
    if not start_dt or not end_dt:
        return JsonResponse({"error": "Invalid datetime format. Use 2025-12-28T17:00:00"}, status=400)

    max_skill_diff = int(request.GET.get("max_skill_diff", 2))
    limit = int(request.GET.get("limit", 5))

    with connection.cursor() as cur:
        cur.execute("SELECT skill_rating FROM users WHERE user_id=%s", [user_id])
        row = cur.fetchone()
        if not row:
            return JsonResponse({"error": "User not found"}, status=404)
        my_skill = row[0]

    query = """
        SELECT u.user_id, u.name, u.email, u.skill_rating
        FROM users u
        WHERE u.user_id <> %s
          AND u.role = 'player'
          AND ABS(u.skill_rating - %s) <= %s
          AND NOT EXISTS (
              SELECT 1
              FROM matches m
              WHERE (m.player1_id = u.user_id OR m.player2_id = u.user_id)
                AND NOT (m.end_time <= %s OR m.start_time >= %s)
          )
        ORDER BY ABS(u.skill_rating - %s) ASC
        LIMIT %s
    """

    partners = []
    with connection.cursor() as cur:
        cur.execute(query, [user_id, my_skill, max_skill_diff, start_dt, end_dt, my_skill, limit])
        for pid, name, email, skill in cur.fetchall():
            partners.append({"user_id": pid, "name": name, "email": email, "skill_rating": skill})

    return JsonResponse({
        "me": {"user_id": int(user_id), "skill_rating": my_skill},
        "desired": {"start_time": start_s, "end_time": end_s},
        "available_partners": partners
    })


@csrf_exempt
def book_match(request):
    """
    POST /api/matches/book/
    opponent_id OPTIONAL (open slot booking)
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    user_id = _current_user_id(request)
    if not user_id:
        return JsonResponse({"error": "Not logged in"}, status=401)

    data = _get_json(request)
    court_id = data.get("court_id")
    opponent_id = data.get("opponent_id")  # optional
    start_s = data.get("start_time")
    end_s = data.get("end_time")

    if not court_id or not start_s or not end_s:
        return JsonResponse({"error": "court_id, start_time, end_time required"}, status=400)

    start_dt = parse_datetime(start_s)
    end_dt = parse_datetime(end_s)
    if not start_dt or not end_dt:
        return JsonResponse({"error": "Invalid datetime format"}, status=400)

    # normalize opponent_id
    if opponent_id in ("", None):
        opponent_id = None
    else:
        try:
            opponent_id = int(opponent_id)
            if opponent_id <= 0:
                opponent_id = None
        except Exception:
            return JsonResponse({"error": "opponent_id must be an integer"}, status=400)

    if opponent_id is not None and int(opponent_id) == int(user_id):
        return JsonResponse({"error": "opponent_id cannot be same as user"}, status=400)

    overlap = "NOT (end_time <= %s OR start_time >= %s)"

    with connection.cursor() as cur:
        # court conflict
        cur.execute(
            f"SELECT COUNT(*) FROM matches WHERE court_id=%s AND {overlap}",
            [court_id, start_dt, end_dt]
        )
        if cur.fetchone()[0] > 0:
            return JsonResponse({"error": "Court not available in that slot"}, status=409)

        # current user conflict
        cur.execute(
            f"SELECT COUNT(*) FROM matches WHERE (player1_id=%s OR player2_id=%s) AND {overlap}",
            [user_id, user_id, start_dt, end_dt]
        )
        if cur.fetchone()[0] > 0:
            return JsonResponse({"error": "You already have a match in that slot"}, status=409)

        # opponent conflict (only if provided)
        if opponent_id is not None:
            cur.execute(
                f"SELECT COUNT(*) FROM matches WHERE (player1_id=%s OR player2_id=%s) AND {overlap}",
                [opponent_id, opponent_id, start_dt, end_dt]
            )
            if cur.fetchone()[0] > 0:
                return JsonResponse({"error": "Opponent not available in that slot"}, status=409)

        # insert
        cur.execute(
            "INSERT INTO matches (court_id, player1_id, player2_id, start_time, end_time) VALUES (%s,%s,%s,%s,%s)",
            [court_id, user_id, opponent_id, start_dt, end_dt]
        )
        match_id = cur.lastrowid

    return JsonResponse(
        {"message": "Match booked", "match_id": match_id, "open_slot": opponent_id is None},
        status=201
    )


@require_GET
def match_history(request):
    user_id = _current_user_id(request)
    if not user_id:
        return JsonResponse({"error": "Not logged in"}, status=401)

    with connection.cursor() as cur:
        cur.execute("""
            SELECT
                m.match_id,
                m.court_id,
                m.player1_id,
                u1.name AS player1_name,
                m.player2_id,
                u2.name AS player2_name,
                m.start_time,
                m.end_time,
                m.tournament_id,
                m.round,
                m.winner_id,
                m.score
            FROM matches m
            JOIN users u1 ON u1.user_id = m.player1_id
            LEFT JOIN users u2 ON u2.user_id = m.player2_id
            WHERE m.player1_id=%s OR m.player2_id=%s
            ORDER BY m.start_time DESC
            LIMIT 50
        """, [user_id, user_id])
        rows = cur.fetchall()

    return JsonResponse({
        "user_id": int(user_id),
        "history": [
            {
                "match_id": r[0],
                "court_id": r[1],
                "player1_id": r[2],
                "player1_name": r[3],
                "player2_id": r[4],
                "player2_name": r[5],
                "start_time": str(r[6]),
                "end_time": str(r[7]),
                "tournament_id": r[8],
                "round": r[9],
                "winner_id": r[10],
                "score": r[11],
            }
            for r in rows
        ]
    })

from datetime import datetime, timedelta

@require_GET
def matches_by_day(request):
    """
    GET /api/matches/by-day/?date=YYYY-MM-DD
    Returns all matches of logged-in user for that day (including tournament matches)
    """
    user_id = _current_user_id(request)
    if not user_id:
        return JsonResponse({"error": "Not logged in"}, status=401)

    date_s = request.GET.get("date")
    if not date_s:
        return JsonResponse({"error": "date is required (YYYY-MM-DD)"}, status=400)

    try:
        day = datetime.strptime(date_s, "%Y-%m-%d")
    except Exception:
        return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD"}, status=400)

    day_start = day
    day_end = day + timedelta(days=1)

    with connection.cursor() as cur:
        cur.execute("""
            SELECT
                m.match_id,
                m.court_id,
                m.start_time,
                m.end_time,
                m.player1_id,
                u1.name AS player1_name,
                m.player2_id,
                u2.name AS player2_name,
                m.tournament_id,
                t.name AS tournament_name,
                m.round,
                m.winner_id,
                m.score
            FROM matches m
            JOIN users u1 ON u1.user_id = m.player1_id
            LEFT JOIN users u2 ON u2.user_id = m.player2_id
            LEFT JOIN tournaments t ON t.tournament_id = m.tournament_id
            WHERE (m.player1_id=%s OR m.player2_id=%s)
              AND m.start_time >= %s
              AND m.start_time < %s
            ORDER BY m.start_time ASC
        """, [user_id, user_id, day_start, day_end])

        rows = cur.fetchall()

    return JsonResponse({
        "date": date_s,
        "items": [
            {
                "match_id": r[0],
                "court_id": r[1],
                "start_time": str(r[2]),
                "end_time": str(r[3]),
                "player1_id": r[4],
                "player1_name": r[5],
                "player2_id": r[6],
                "player2_name": r[7],
                "tournament_id": r[8],
                "tournament_name": r[9],
                "round": r[10],
                "winner_id": r[11],
                "score": r[12],
                "type": "tournament" if r[8] is not None else "friendly",
            }
            for r in rows
        ]
    })


@require_GET
def open_slots(request):
    """
    GET /api/matches/open/?start_time=...&end_time=...
    Lists matches where player2_id IS NULL (open slot).
    """
    start_s = request.GET.get("start_time")
    end_s = request.GET.get("end_time")
    if not start_s or not end_s:
        return JsonResponse({"error": "start_time and end_time are required"}, status=400)

    start_dt = parse_datetime(start_s)
    end_dt = parse_datetime(end_s)
    if not start_dt or not end_dt:
        return JsonResponse({"error": "Invalid datetime format"}, status=400)

    overlap = "NOT (m.end_time <= %s OR m.start_time >= %s)"

    with connection.cursor() as cur:
        cur.execute(f"""
            SELECT m.match_id, m.court_id, m.player1_id, u.name, m.start_time, m.end_time
            FROM matches m
            JOIN users u ON u.user_id = m.player1_id
            WHERE m.player2_id IS NULL
              AND {overlap}
            ORDER BY m.start_time ASC
            LIMIT 50
        """, [start_dt, end_dt])
        rows = cur.fetchall()

    return JsonResponse({
        "open_slots": [
            {
                "match_id": r[0],
                "court_id": r[1],
                "host_user_id": r[2],
                "host_name": r[3],
                "start_time": str(r[4]),
                "end_time": str(r[5]),
            }
            for r in rows
        ]
    })


@csrf_exempt
def join_slot(request, match_id):
    """
    POST /api/matches/<match_id>/join/
    Join an open slot by setting player2_id = current user.
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    user_id = _current_user_id(request)
    if not user_id:
        return JsonResponse({"error": "Not logged in"}, status=401)

    overlap = "NOT (end_time <= %s OR start_time >= %s)"

    with connection.cursor() as cur:
        cur.execute("SELECT player1_id, player2_id, start_time, end_time FROM matches WHERE match_id=%s", [match_id])
        row = cur.fetchone()
        if not row:
            return JsonResponse({"error": "Match not found"}, status=404)

        host_id, p2, start_dt, end_dt = row
        if p2 is not None:
            return JsonResponse({"error": "Slot already taken"}, status=409)
        if int(host_id) == int(user_id):
            return JsonResponse({"error": "You cannot join your own slot"}, status=400)

        # user availability
        cur.execute(
            f"SELECT COUNT(*) FROM matches WHERE (player1_id=%s OR player2_id=%s) AND {overlap}",
            [user_id, user_id, start_dt, end_dt]
        )
        if cur.fetchone()[0] > 0:
            return JsonResponse({"error": "You already have a match in that slot"}, status=409)

        # claim slot
        cur.execute(
            "UPDATE matches SET player2_id=%s WHERE match_id=%s AND player2_id IS NULL",
            [user_id, match_id]
        )
        if cur.rowcount == 0:
            return JsonResponse({"error": "Slot already taken"}, status=409)

    return JsonResponse({"message": "Joined slot", "match_id": int(match_id)}, status=200)

from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.db import connection

from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.db import connection

@require_GET
def matches_by_day(request):
    """
    GET /api/matches/by-day/?date=YYYY-MM-DD[&court_id=1]
    Returns ALL bookings on that date (friendly + tournament).
    Optional: filter by court_id.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        return JsonResponse({"error": "Not logged in"}, status=401)

    date_s = request.GET.get("date")
    if not date_s:
        return JsonResponse({"error": "date is required (YYYY-MM-DD)"}, status=400)

    try:
        day = datetime.strptime(date_s, "%Y-%m-%d")
    except Exception:
        return JsonResponse({"error": "Invalid date format. Use YYYY-MM-DD"}, status=400)

    court_id = request.GET.get("court_id")
    try:
        court_id_int = int(court_id) if court_id not in (None, "", "0") else None
    except Exception:
        return JsonResponse({"error": "court_id must be an integer"}, status=400)

    day_start = day
    day_end = day + timedelta(days=1)

    params = [day_start, day_end]
    court_filter_sql = ""
    if court_id_int is not None:
        court_filter_sql = " AND m.court_id = %s "
        params.append(court_id_int)

    with connection.cursor() as cur:
        cur.execute(f"""
            SELECT
                m.match_id,
                m.court_id,
                m.start_time,
                m.end_time,
                m.player1_id,
                u1.name AS player1_name,
                m.player2_id,
                u2.name AS player2_name,
                m.tournament_id,
                t.name AS tournament_name,
                m.round,
                m.winner_id,
                m.score
            FROM matches m
            JOIN users u1 ON u1.user_id = m.player1_id
            LEFT JOIN users u2 ON u2.user_id = m.player2_id
            LEFT JOIN tournaments t ON t.tournament_id = m.tournament_id
            WHERE m.start_time >= %s
              AND m.start_time < %s
              {court_filter_sql}
            ORDER BY m.court_id ASC, m.start_time ASC
        """, params)

        rows = cur.fetchall()

    return JsonResponse({
        "date": date_s,
        "court_id": court_id_int,
        "items": [
            {
                "match_id": r[0],
                "court_id": r[1],
                "start_time": str(r[2]),
                "end_time": str(r[3]),
                "player1_id": r[4],
                "player1_name": r[5],
                "player2_id": r[6],
                "player2_name": r[7],
                "tournament_id": r[8],
                "tournament_name": r[9],
                "round": r[10],
                "winner_id": r[11],
                "score": r[12],
                "type": "tournament" if r[8] is not None else "friendly",
                "open_slot": True if r[6] is None else False,
            }
            for r in rows
        ]
    })


