// src/lib/api.ts
// Central API wrapper for Django session-auth endpoints.
// IMPORTANT: credentials:"include" is REQUIRED so Django session cookie is sent.

export type ApiErrorShape = { error?: string; detail?: string; message?: string };

const jsonHeaders = { "Content-Type": "application/json" };

async function request<T>(path: string, opts: RequestInit & { json?: any } = {}): Promise<T> {
  const init: RequestInit = {
    method: opts.method ?? "GET",
    credentials: "include",
    headers: {
      ...(opts.json ? jsonHeaders : {}),
      ...(opts.headers ?? {}),
    },
    body: opts.json ? JSON.stringify(opts.json) : opts.body,
  };

  const res = await fetch(path, init);

  // try parse json (even on errors)
  let data: any = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else {
    try {
      data = await res.text();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const e = (data || {}) as ApiErrorShape;
    const msg =
      e.error ||
      e.detail ||
      e.message ||
      (typeof data === "string" ? data : null) ||
      `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export const api = {
  // ---------- AUTH ----------
  signup(payload: { name: string; email: string; password: string }) {
    return request<{ ok: true }>("/api/users/signup/", { method: "POST", json: payload });
  },
  login(payload: { email: string; password: string }) {
    return request<{ ok: true; user: any }>("/api/users/login/", { method: "POST", json: payload });
  },
  logout() {
    return request<{ ok: true }>("/api/users/logout/", { method: "POST" });
  },
  me() {
    // if your backend has /me/ use it; otherwise auth state already has user from login
    return request<any>("/api/users/me/");
  },

  // ---------- MATCHES ----------
  findPartners(params: { start_time: string; end_time: string; max_skill_diff?: number; limit?: number }) {
    const q = new URLSearchParams();
    q.set("start_time", params.start_time);
    q.set("end_time", params.end_time);
    if (params.max_skill_diff != null) q.set("max_skill_diff", String(params.max_skill_diff));
    if (params.limit != null) q.set("limit", String(params.limit));
    return request<any>(`/api/matches/partners/?${q.toString()}`);
  },

  // ✅ opponent_id optional + open_slot optional in response
  bookMatch(payload: { court_id: number; opponent_id?: number; start_time: string; end_time: string }) {
    return request<{ match_id: number; open_slot?: boolean; message?: string }>("/api/matches/book/", {
      method: "POST",
      json: payload,
    });
  },

  matchHistory() {
    return request<any>("/api/matches/history/");
  },

  matchesByDay(date: string, courtId?: number) {
    const q = new URLSearchParams();
    q.set("date", date);
    if (courtId && courtId > 0) q.set("court_id", String(courtId));
    return request<{ date: string; items: any[] }>(`/api/matches/by-day/?${q.toString()}`);
  },

  // ---------- TOURNAMENTS ----------
  // ---------- TOURNAMENTS ----------
  tournaments() {
    return request<any>("/api/tournaments/");
  },

  createTournament(payload: { name: string; description?: string; max_players?: number }) {
    return request<any>("/api/tournaments/create/", { method: "POST", json: payload });
  },

  // ✅ FIX: backend uses /join/ not /enroll/
  joinTournament(tournament_id: number) {
    return request<any>(`/api/tournaments/${tournament_id}/join/`, { method: "POST" });
  },

  tournamentMatches(tournament_id: number) {
    return request<any>(`/api/tournaments/${tournament_id}/matches/`);
  },

  leaderboard() {
    return request<any>("/api/tournaments/leaderboard/");
  },

  tournamentLeaderboard(tournament_id: number) {
    return request<any>(`/api/tournaments/${tournament_id}/leaderboard/`);
  },


  // ---------- CALENDAR (your backend stores creds / status) ----------
  calendarStatus() {
    return request<any>("/api/users/calendar/status/");
  },

  calendarConnect(payload: { google_account_email: string; access_token: string; refresh_token: string; token_expiry: string }) {
    return request<any>("/api/users/calendar/connect/", { method: "POST", json: payload });
  },



};



