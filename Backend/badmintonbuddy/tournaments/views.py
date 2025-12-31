import json
import random
from datetime import timedelta

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db import connection
from django.utils.dateparse import parse_datetime


def _get_json(request):
    try:
        return json.loads(request.body.decode("utf-8"))
    except Exception:
        return {}


def _require_login(request):
    user_id = request.session.get("user_id")
    if not user_id:
        return None, JsonResponse({"error": "Not logged in"}, status=401)
    return int(user_id), None


def _db_role(user_id):
    """Safer than session role. Reads role from DB."""
    with connection.cursor() as cur:
        cur.execute("SELECT role FROM users WHERE user_id=%s", [user_id])
        row = cur.fetchone()
    return row[0] if row else None


def _require_admin(request):
    user_id, err = _require_login(request)
    if err:
        return None, err

    role = _db_role(user_id)
    if role != "admin":
        return None, JsonResponse({"error": "Admin only"}, status=403)

    return user_id, None


def list_tournaments(request):
    """
    GET /api/tournaments/
    """
    with connection.cursor() as cur:
        cur.execute("""
            SELECT tournament_id, name, description, created_by, max_players, status
            FROM tournaments
            ORDER BY tournament_id DESC
        """)
        rows = cur.fetchall()

    return JsonResponse({
        "tournaments": [
            {
                "tournament_id": r[0],
                "name": r[1],
                "description": r[2],
                "created_by": r[3],
                "max_players": r[4],
                "status": r[5],
            }
            for r in rows
        ]
    })


@csrf_exempt
def create_tournament(request):
    """
    POST /api/tournaments/create/
    Admin only.
    Body:
    {
      "name": "BRAC Badminton Open",
      "description": "optional",
      "max_players": 16
    }
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    admin_id, err = _require_admin(request)
    if err:
        return err

    data = _get_json(request)
    name = (data.get("name") or "").strip()
    description = (data.get("description") or "").strip() or None
    max_players = data.get("max_players")

    if not name or max_players is None:
        return JsonResponse({"error": "name and max_players required"}, status=400)

    try:
        max_players = int(max_players)
        if max_players < 2:
            return JsonResponse({"error": "max_players must be >= 2"}, status=400)
    except Exception:
        return JsonResponse({"error": "max_players must be an integer"}, status=400)

    with connection.cursor() as cur:
        cur.execute(
            """
            INSERT INTO tournaments (name, description, created_by, max_players, status)
            VALUES (%s, %s, %s, %s, 'upcoming')
            """,
            [name, description, admin_id, max_players]
        )
        new_id = cur.lastrowid

    return JsonResponse({"message": "Tournament created", "tournament_id": new_id}, status=201)


# ------------------------------
# Tinon's Part Starts Here
# ------------------------------

@csrf_exempt
def join_tournament(request, tournament_id):
    """
    POST /api/tournaments/<id>/join/
    Logged-in user joins tournament (must be upcoming + not full)
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    user_id, err = _require_login(request)
    if err:
        return err

    with connection.cursor() as cur:
        cur.execute("SELECT max_players, status FROM tournaments WHERE tournament_id=%s", [tournament_id])
        t = cur.fetchone()

    if not t:
        return JsonResponse({"error": "Tournament not found"}, status=404)

    max_players, status = t
    if status != "upcoming":
        return JsonResponse({"error": "Tournament not open for joining"}, status=400)

    with connection.cursor() as cur:
        # already joined?
        cur.execute("""
            SELECT COUNT(*) FROM tournament_participants
            WHERE tournament_id=%s AND user_id=%s
        """, [tournament_id, user_id])
        already = cur.fetchone()[0]
        if already > 0:
            return JsonResponse({"error": "Already joined"}, status=400)

        # full?
        cur.execute("SELECT COUNT(*) FROM tournament_participants WHERE tournament_id=%s", [tournament_id])
        count_now = cur.fetchone()[0]
        if count_now >= max_players:
            return JsonResponse({"error": "Tournament is full"}, status=400)

        # insert
        cur.execute("""
            INSERT INTO tournament_participants (tournament_id, user_id, seed)
            VALUES (%s, %s, NULL)
        """, [tournament_id, user_id])

    return JsonResponse({"message": "Joined tournament successfully"}, status=201)


@csrf_exempt
def start_tournament(request, tournament_id):
    """
    POST /api/tournaments/<id>/start/
    Admin only.
    - checks min participants
    - sets tournament status to ongoing
    - generates round=1 matches into matches table (tournament_id, round)
    Body (optional):
    {
      "court_id": 1,
      "start_time": "2026-01-10T10:00:00",
      "match_minutes": 60
    }
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    admin_id, err = _require_admin(request)
    if err:
        return err

    # tournament exists?
    with connection.cursor() as cur:
        cur.execute("SELECT status FROM tournaments WHERE tournament_id=%s", [tournament_id])
        row = cur.fetchone()
    if not row:
        return JsonResponse({"error": "Tournament not found"}, status=404)
    if row[0] != "upcoming":
        return JsonResponse({"error": "Tournament must be upcoming to start"}, status=400)

    data = _get_json(request)
    court_id = int(data.get("court_id") or 1)
    match_minutes = int(data.get("match_minutes") or 60)

    start_dt = parse_datetime(data.get("start_time") or "")
    # if not provided, just use "now" from DB time (simpler approach: schedule sequentially anyway)
    # We'll fallback to CURRENT_TIMESTAMP by selecting NOW() once.
    if not start_dt:
        with connection.cursor() as cur:
            cur.execute("SELECT NOW()")
            start_dt = cur.fetchone()[0]

    # load participants
    with connection.cursor() as cur:
        cur.execute("""
            SELECT user_id
            FROM tournament_participants
            WHERE tournament_id=%s
        """, [tournament_id])
        participants = [r[0] for r in cur.fetchall()]

    if len(participants) < 2:
        return JsonResponse({"error": "Need at least 2 participants to start"}, status=400)

    # shuffle and pair
    random.shuffle(participants)

    # if odd, one gets bye (no match created)
    pairs = []
    i = 0
    while i + 1 < len(participants):
        pairs.append((participants[i], participants[i + 1]))
        i += 2
    bye_user = participants[-1] if len(participants) % 2 == 1 else None

    # set tournament ongoing + insert matches (round 1)
    with connection.cursor() as cur:
        cur.execute("UPDATE tournaments SET status='ongoing' WHERE tournament_id=%s", [tournament_id])

        current_start = start_dt
        created_matches = []

        for p1, p2 in pairs:
            current_end = current_start + timedelta(minutes=match_minutes)

            cur.execute("""
                INSERT INTO matches
                  (court_id, player1_id, player2_id, start_time, end_time, tournament_id, round, winner_id, score)
                VALUES
                  (%s, %s, %s, %s, %s, %s, 1, NULL, NULL)
            """, [court_id, p1, p2, current_start, current_end, tournament_id])

            created_matches.append({
                "match_id": cur.lastrowid,
                "player1_id": p1,
                "player2_id": p2,
                "start_time": str(current_start),
                "end_time": str(current_end),
                "round": 1
            })

            current_start = current_end  # next slot

    return JsonResponse({
        "message": "Tournament started (round 1 generated)",
        "bye_user_id": bye_user,
        "matches_created": created_matches
    }, status=201)


def tournament_matches(request, tournament_id):
    """
    GET /api/tournaments/<id>/matches/
    """
    with connection.cursor() as cur:
        cur.execute("""
            SELECT match_id, player1_id, player2_id, start_time, end_time, round, winner_id, score
            FROM matches
            WHERE tournament_id=%s
            ORDER BY round ASC, match_id ASC
        """, [tournament_id])
        rows = cur.fetchall()

    return JsonResponse({
        "tournament_id": tournament_id,
        "matches": [
            {
                "match_id": r[0],
                "player1_id": r[1],
                "player2_id": r[2],
                "start_time": str(r[3]),
                "end_time": str(r[4]),
                "round": r[5],
                "winner_id": r[6],
                "score": r[7],
            }
            for r in rows
        ]
    })


@csrf_exempt
def report_match_result(request, match_id):
    """
    POST /api/tournaments/match/<match_id>/result/
    Admin only for simplicity.
    Body:
    {
      "winner_id": 2,
      "score": "21-18, 21-19"
    }

    Updates:
    - matches.winner_id + matches.score
    - users.wins (+1) for winner
    - users.total_matches (+1) for both players
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    admin_id, err = _require_admin(request)
    if err:
        return err

    data = _get_json(request)
    winner_id = data.get("winner_id")
    score = (data.get("score") or "").strip() or None

    if not winner_id:
        return JsonResponse({"error": "winner_id required"}, status=400)

    with connection.cursor() as cur:
        cur.execute("""
            SELECT player1_id, player2_id, winner_id
            FROM matches
            WHERE match_id=%s
        """, [match_id])
        m = cur.fetchone()

    if not m:
        return JsonResponse({"error": "Match not found"}, status=404)

    p1, p2, existing_winner = m
    if existing_winner is not None:
        return JsonResponse({"error": "Result already submitted"}, status=400)

    winner_id = int(winner_id)
    if winner_id not in (p1, p2):
        return JsonResponse({"error": "winner_id must be player1_id or player2_id"}, status=400)

    with connection.cursor() as cur:
        cur.execute("""
            UPDATE matches
            SET winner_id=%s, score=%s
            WHERE match_id=%s
        """, [winner_id, score, match_id])

        # total matches increment for both
        cur.execute("UPDATE users SET total_matches = total_matches + 1 WHERE user_id IN (%s, %s)", [p1, p2])

        # wins increment for winner
        cur.execute("UPDATE users SET wins = wins + 1 WHERE user_id=%s", [winner_id])

    return JsonResponse({"message": "Match result saved", "match_id": match_id})


def leaderboard(request):
    """
    GET /api/tournaments/leaderboard/
    Simple leaderboard: order by wins desc, total_matches desc
    """
    with connection.cursor() as cur:
        cur.execute("""
            SELECT user_id, name, wins, total_matches, skill_rating
            FROM users
            ORDER BY wins DESC, total_matches DESC, skill_rating DESC, user_id ASC
            LIMIT 20
        """)
        rows = cur.fetchall()

    return JsonResponse({
        "leaderboard": [
            {
                "user_id": r[0],
                "name": r[1],
                "wins": r[2],
                "total_matches": r[3],
                "skill_rating": r[4],
            }
            for r in rows
        ]
    })
def tournament_leaderboard(request, tournament_id):
    """
    GET /api/tournaments/<tournament_id>/leaderboard/
    Returns leaderboard: matches_played + wins for each participant
    """
    with connection.cursor() as cur:
        cur.execute("""
            SELECT
                u.user_id,
                u.name,
                COUNT(DISTINCT m.match_id) AS matches_played,
                COALESCE(SUM(CASE WHEN m.winner_id = u.user_id THEN 1 ELSE 0 END), 0) AS wins
            FROM tournament_participants tp
            JOIN users u ON tp.user_id = u.user_id
            LEFT JOIN matches m
                ON m.tournament_id = tp.tournament_id
                AND (m.player1_id = u.user_id OR m.player2_id = u.user_id)
            WHERE tp.tournament_id = %s
            GROUP BY u.user_id, u.name
            ORDER BY wins DESC, matches_played DESC, u.user_id ASC
        """, [tournament_id])

        rows = cur.fetchall()

    return JsonResponse({
        "tournament_id": tournament_id,
        "leaderboard": [
            {
                "user_id": r[0],
                "name": r[1],
                "matches_played": int(r[2]),
                "wins": int(r[3])
            }
            for r in rows
        ]
    })

@csrf_exempt
def complete_tournament(request, tournament_id):
    """
    POST /api/tournaments/<id>/complete/
    Admin only.

    Logic:
    - tournament must exist
    - tournament must be ongoing
    - all matches in this tournament must have winner_id NOT NULL
    - then set status = 'completed'
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    admin_id, err = _require_admin(request)
    if err:
        return err

    # Check tournament status
    with connection.cursor() as cur:
        cur.execute("SELECT status FROM tournaments WHERE tournament_id=%s", [tournament_id])
        row = cur.fetchone()

    if not row:
        return JsonResponse({"error": "Tournament not found"}, status=404)

    status = row[0]
    if status == "upcoming":
        return JsonResponse({"error": "Tournament not started yet"}, status=400)
    if status == "completed":
        return JsonResponse({"error": "Tournament already completed"}, status=400)
    if status != "ongoing":
        return JsonResponse({"error": f"Invalid tournament status: {status}"}, status=400)

    # Count total matches + pending matches
    with connection.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) 
            FROM matches
            WHERE tournament_id=%s
        """, [tournament_id])
        total_matches = cur.fetchone()[0]

        cur.execute("""
            SELECT COUNT(*)
            FROM matches
            WHERE tournament_id=%s AND winner_id IS NULL
        """, [tournament_id])
        pending = cur.fetchone()[0]

    if total_matches == 0:
        return JsonResponse({"error": "No matches found for this tournament"}, status=400)

    if pending > 0:
        return JsonResponse({
            "error": "Tournament cannot be completed yet",
            "pending_matches": int(pending),
            "total_matches": int(total_matches)
        }, status=400)

    # All matches have winners -> complete it
    with connection.cursor() as cur:
        cur.execute("""
            UPDATE tournaments
            SET status='completed'
            WHERE tournament_id=%s
        """, [tournament_id])

    return JsonResponse({
        "message": "Tournament completed successfully",
        "tournament_id": tournament_id,
        "total_matches": int(total_matches)
    }, status=200)




