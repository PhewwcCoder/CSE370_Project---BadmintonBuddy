# BadmintonBuddy Backend — Aryan Module (SQL-First)

## 0. Overview (What Aryan built)
Aryan’s module covers the “player-side” flow:
1) User Authentication (signup/login/logout via session)
2) Smart Partner Matching (find available opponents/partners based on time + skill)
3) Shared Court Slot Booking (book a match slot while preventing overlaps)
4) Calendar Sync Storage (store Google Calendar OAuth tokens in DB)

This module is implemented using **SQL-first** approach:
- Tables are created manually in MariaDB
- Django is used only to expose APIs and run RAW SQL queries using `connection.cursor()`
- No migrations for project tables (managed=False models where needed)


---

## 1. Authentication (Session-based)
### Why session auth?
- Simple for lab exam
- Works with Postman easily (cookie is stored after login)
- Avoids needing Django’s full auth system

### Key logic
- `signup`: creates user row in `users` table (password hashed)
- `login`: verifies email + hashed password (`check_password`)
- On success, stores:
  - `request.session["user_id"] = user.user_id`

> NOTE: Tournament module checks admin privilege from DB role, so even if session role is missing, it’s safe.

### Endpoints
- `POST /api/users/signup/`
- `POST /api/users/login/`
- `POST /api/users/logout/`

---

## 2. Smart Partner Matching (Feature)
### Goal
Given a desired time window (start_time, end_time), find other players who:
1) Are not the current user
2) Are within a skill difference threshold
3) Have no time overlap with another match

### Endpoint
- `GET /api/matches/partners/?start_time=...&end_time=...&max_skill_diff=2&limit=5`

### Inputs
- `start_time` and `end_time` in ISO format:
  - Example: `2025-12-28T17:00:00`
- `max_skill_diff` (default 2)
- `limit` (default 5)

### Core SQL idea (Overlap check)
We consider two time intervals overlap if:
- NOT (existing_end <= new_start OR existing_start >= new_end)

So a player is available if there does **NOT** exist any match overlapping that window.

### SQL used (concept)
- Uses `ABS(u.skill_rating - my_skill)`
- Uses `NOT EXISTS (...)` with overlap logic against `matches` table
- Orders by closest skill rating

### Output
Returns:
- current user’s skill
- desired time window
- list of available partners (id, name, email, skill_rating)

---

## 3. Shared Court Slot Booking (Feature)
### Goal
Create a match booking while preventing conflicts:
1) Court already booked in same time window
2) Current user already has match in same time window
3) Opponent already has match in same time window

### Endpoint
- `POST /api/matches/book/`

### Request body
```json
{
  "court_id": 1,
  "opponent_id": 2,
  "start_time": "2025-12-28T17:00:00",
  "end_time": "2025-12-28T18:00:00"
}
