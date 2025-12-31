import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.hashers import make_password, check_password

from django.db import connection
from django.utils.dateparse import parse_datetime


from .models import User


def _get_json(request):
    try:
        return json.loads(request.body.decode('utf-8'))
    except Exception:
        return {}


@csrf_exempt
def signup(request):
    if request.method != 'POST':
        return JsonResponse({"error": "POST required"}, status=405)

    data = _get_json(request)
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return JsonResponse({"error": "name, email, password required"}, status=400)

    if User.objects.filter(email=email).exists():
        return JsonResponse({"error": "Email already exists"}, status=409)

    user = User.objects.create(
        name=name,
        email=email,
        password=make_password(password),  # hashed
        role='player',
        skill_rating=0,
        wins=0,
        total_matches=0,
    )

    # lightweight session (store user_id)
    request.session["user_id"] = user.user_id
    request.session["role"] = user.role


    return JsonResponse({
        "message": "Signup successful",
        "user": {"user_id": user.user_id, "name": user.name, "email": user.email, "role": user.role}
    }, status=201)


@csrf_exempt
def login_view(request):
    if request.method != 'POST':
        return JsonResponse({"error": "POST required"}, status=405)

    data = _get_json(request)
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return JsonResponse({"error": "email, password required"}, status=400)

    user = User.objects.filter(email=email).first()
    if not user:
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    if not check_password(password, user.password):
        return JsonResponse({"error": "Invalid credentials"}, status=401)

    request.session["user_id"] = user.user_id
    request.session["role"] = user.role


    return JsonResponse({
        "message": "Login successful",
        "user": {"user_id": user.user_id, "name": user.name, "email": user.email, "role": user.role}
    })


@csrf_exempt
def logout_view(request):
    if request.method != 'POST':
        return JsonResponse({"error": "POST required"}, status=405)

    request.session.flush()
    return JsonResponse({"message": "Logged out"})

@csrf_exempt
def calendar_connect(request):
    """
    POST /api/users/calendar/connect/
    Body:
    {
      "google_account_email": "aryan@gmail.com",
      "access_token": "abc",
      "refresh_token": "def",
      "token_expiry": "2025-12-30T10:00:00"
    }

    SQL-first: stores into google_calendar_creds (upsert).
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)

    user_id = request.session.get("user_id")
    if not user_id:
        return JsonResponse({"error": "Not logged in"}, status=401)

    data = _get_json(request)
    google_email = (data.get("google_account_email") or "").strip()
    access_token = data.get("access_token") or ""
    refresh_token = data.get("refresh_token") or ""
    expiry_s = data.get("token_expiry") or ""

    if not google_email or not access_token or not refresh_token or not expiry_s:
        return JsonResponse({"error": "google_account_email, access_token, refresh_token, token_expiry required"}, status=400)

    expiry_dt = parse_datetime(expiry_s)
    if not expiry_dt:
        return JsonResponse({"error": "Invalid token_expiry datetime"}, status=400)

    # Upsert into google_calendar_creds
    # Since user_id is PRIMARY KEY in that table, we can use ON DUPLICATE KEY UPDATE
    with connection.cursor() as cur:
        cur.execute(
            """
            INSERT INTO google_calendar_creds
                (user_id, google_account_email, access_token, refresh_token, token_expiry)
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                google_account_email = VALUES(google_account_email),
                access_token = VALUES(access_token),
                refresh_token = VALUES(refresh_token),
                token_expiry = VALUES(token_expiry)
            """,
            [user_id, google_email, access_token, refresh_token, expiry_dt]
        )

    return JsonResponse({"message": "Google Calendar credentials saved", "user_id": user_id})


def calendar_status(request):
    """
    GET /api/users/calendar/status/
    Shows whether creds exist for logged-in user.
    """
    user_id = request.session.get("user_id")
    if not user_id:
        return JsonResponse({"error": "Not logged in"}, status=401)

    with connection.cursor() as cur:
        cur.execute(
            "SELECT google_account_email, token_expiry FROM google_calendar_creds WHERE user_id=%s",
            [user_id]
        )
        row = cur.fetchone()

    if not row:
        return JsonResponse({"connected": False})

    return JsonResponse({
        "connected": True,
        "google_account_email": row[0],
        "token_expiry": str(row[1]) if row[1] else None
    })

from django.http import JsonResponse
from django.db import connection

def user_stats(request):
    """
    GET /api/users/stats/
    Logged-in user's stats:
    - wins
    - total_matches
    - win_rate
    - tournament_matches
    - friendly_matches
    """
    user_id = request.session.get("user_id")
    if not user_id:
        return JsonResponse({"error": "Not logged in"}, status=401)

    with connection.cursor() as cur:
        # Basic user stats from users table
        cur.execute("""
            SELECT user_id, name, wins, total_matches, skill_rating
            FROM users
            WHERE user_id=%s
        """, [user_id])
        u = cur.fetchone()

    if not u:
        return JsonResponse({"error": "User not found"}, status=404)

    wins = int(u[2] or 0)
    total = int(u[3] or 0)
    win_rate = round((wins / total) * 100, 2) if total > 0 else 0.0

    # Tournament vs friendly match breakdown
    with connection.cursor() as cur:
        cur.execute("""
            SELECT
                SUM(CASE WHEN tournament_id IS NULL THEN 1 ELSE 0 END) AS friendly_matches,
                SUM(CASE WHEN tournament_id IS NOT NULL THEN 1 ELSE 0 END) AS tournament_matches
            FROM matches
            WHERE player1_id=%s OR player2_id=%s
        """, [user_id, user_id])
        m = cur.fetchone()

    friendly_matches = int(m[0] or 0)
    tournament_matches = int(m[1] or 0)

    return JsonResponse({
        "user": {
            "user_id": u[0],
            "name": u[1],
            "wins": wins,
            "total_matches": total,
            "win_rate_percent": win_rate,
            "skill_rating": int(u[4] or 0),
            "friendly_matches": friendly_matches,
            "tournament_matches": tournament_matches
        }
    })
