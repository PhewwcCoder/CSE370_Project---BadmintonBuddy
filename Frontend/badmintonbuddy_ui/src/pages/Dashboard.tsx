// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Button, Toast, Divider } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../state/auth";
import StatsCharts from "../components/StatsCharts";

type MatchRow = {
  match_id?: number;
  id?: number;

  start_time: string;
  end_time: string;
  court_id: number;
  match_type?: string;

  opponent_name?: string;

  // from backend match_history: winner_id + score
  winner_id?: number | string | null;
  winner?: number | string | null;
  winnerId?: number | string | null;
  winner_name?: string | null;
  score?: string | null;
};

type LeaderRow = {
  user_id: number;
  name: string;
  wins: number;
  total_matches: number;
  skill_rating: number;
};

function fmt(dt: string) {
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString();
}

// robust extraction for your backend shapes
function extractMatches(res: any): MatchRow[] {
  if (!res) return [];
  if (Array.isArray(res)) return res as MatchRow[];

  const candidates = [res.matches, res.history, res.results, res.data];
  for (const c of candidates) if (Array.isArray(c)) return c as MatchRow[];

  if (res.data && typeof res.data === "object") {
    const deep = [res.data.matches, res.data.history, res.data.results];
    for (const d of deep) if (Array.isArray(d)) return d as MatchRow[];
  }

  return [];
}

function getWinnerId(m: any) {
  return m?.winner_id ?? m?.winnerId ?? m?.winner ?? null;
}

export default function Dashboard() {
  const { user } = useAuth();

  const [preview, setPreview] = useState<MatchRow[]>([]);
  const [allCount, setAllCount] = useState(0); // all bookings shown in history (played + pending)
  const [playedCount, setPlayedCount] = useState(0); // only completed matches
  const [wins, setWins] = useState(0);

  // leaderboard rank
  const [rank, setRank] = useState<number | null>(null);
  const [mySkill, setMySkill] = useState<number | null>(null);
  const [myLbWins, setMyLbWins] = useState<number | null>(null);
  const [myLbMatches, setMyLbMatches] = useState<number | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setErr(null);
    setBusy(true);

    try {
      // load both: history + leaderboard
      const [histRes, lbRes]: any = await Promise.all([api.matchHistory(), api.leaderboard()]);

      // ---------- HISTORY ----------
      const list = extractMatches(histRes);
      setAllCount(list.length);

      // ✅ pending vs played:
      // A match is "played/completed" only if winner_id is present (backend returns winner_id) :contentReference[oaicite:0]{index=0}
      const played = list.filter((m) => getWinnerId(m) != null);
      setPlayedCount(played.length);

      // wins based ONLY on played matches
      const myId = (user as any)?.user_id ?? (user as any)?.id;
      let winCount = 0;

      for (const m of played) {
        const w = getWinnerId(m);
        if (myId != null && w != null && String(w) === String(myId)) winCount++;
      }
      setWins(winCount);

      // preview (keep small so no scroll)
      setPreview(list.slice(0, 3));

      // ---------- LEADERBOARD ----------
      const rows: LeaderRow[] = lbRes?.leaderboard || [];
      const idx = rows.findIndex((r) => String(r.user_id) === String(myId));
      setRank(idx >= 0 ? idx + 1 : null);

      if (idx >= 0) {
        setMySkill(rows[idx].skill_rating);
        setMyLbWins(rows[idx].wins);
        setMyLbMatches(rows[idx].total_matches);
      } else {
        setMySkill(null);
        setMyLbWins(null);
        setMyLbMatches(null);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load dashboard");
      setAllCount(0);
      setPlayedCount(0);
      setWins(0);
      setPreview([]);
      setRank(null);
      setMySkill(null);
      setMyLbWins(null);
      setMyLbMatches(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ✅ win rate based only on PLAYED matches (exclude pending bookings)
  const winRate = useMemo(() => {
    if (playedCount <= 0) return 0;
    return Math.round((wins / playedCount) * 100);
  }, [wins, playedCount]);

  return (
    // Full-fit screen (no page scroll)
    <div className="h-[calc(100vh-88px)] min-h-0 overflow-hidden grid gap-4 md:grid-cols-3">
      {/* MAIN */}
      <Card className="md:col-span-2 overflow-hidden">
        <CardHeader title={`Hi, ${user?.name ?? "Player"} 👋`} subtitle="Your activity overview" />

        <CardBody className="h-full min-h-0 overflow-hidden grid grid-rows-[auto_auto_1fr] gap-3">
          {err && <Toast tone="err">{err}</Toast>}

          {/* Top: Performance + Stats */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/60 mb-2">Performance (played only)</div>
              <StatsCharts wins={wins} total={playedCount} />
            </div>

            <div className="grid gap-3 grid-rows-4">
              <Stat title="Wins (played)" value={wins} />
              <Stat title="Played matches" value={playedCount} />
              <Stat title="Booked matches" value={allCount} />
              <Stat title="Win rate (played)" value={`${winRate}%`} />
            </div>
          </div>

          <Divider />

          {/* Bottom: Recent matches (limited to avoid scroll) */}
          <div className="min-h-0 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Recent bookings</div>
              <Button disabled={busy} onClick={load}>
                {busy ? "Refreshing…" : "Refresh"}
              </Button>
            </div>

            <div className="min-h-0 overflow-hidden grid gap-2">
              {preview.length === 0 ? (
                <div className="text-xs text-white/60">No matches yet.</div>
              ) : (
                preview.map((m, i) => (
                  <div key={m.match_id ?? m.id ?? i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-sm font-medium">{m.opponent_name ? `You vs ${m.opponent_name}` : "Match"}</div>
                    <div className="text-xs text-white/60 mt-1">
                      {fmt(m.start_time)} → {fmt(m.end_time)} • Court {m.court_id}
                      {getWinnerId(m) == null ? (
                        <span className="text-white/50"> • Pending</span>
                      ) : (
                        <span className="text-emerald-200/80"> • Completed</span>
                      )}
                    </div>
                    {m.score ? <div className="text-xs text-white/60 mt-1">Score: {m.score}</div> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* SIDE (remove coach advice, show leaderboard rank) */}
      <Card className="overflow-hidden">
        <CardHeader title="Quick status" subtitle="Ranking + account info" />

        <CardBody className="h-full min-h-0 overflow-hidden flex flex-col gap-3 text-sm">
          {/* Rank card */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="text-sm font-semibold text-white">Leaderboard rank</div>
            <div className="text-xs text-white/60 mt-1">
              From tournaments leaderboard ordering (wins → matches → skill).
            </div>

            <div className="mt-3 grid gap-2">
              <MiniStat label="Your rank" value={rank == null ? "—" : `#${rank}`} />
              <MiniStat label="Skill rating" value={mySkill == null ? "—" : mySkill} />
              <MiniStat label="LB wins / matches" value={myLbWins == null ? "—" : `${myLbWins} / ${myLbMatches ?? "—"}`} />
            </div>
          </div>

          <Divider />

          {/* Account info */}
          <div>
            <div className="text-xs text-white/60">Role</div>
            <div className="text-white font-medium">{user?.role}</div>
          </div>

          <div>
            <div className="text-xs text-white/60">Calendar</div>
            <div className="text-white font-medium">Not connected</div>
          </div>

          {/* absorbs extra space so nothing gets pushed down */}
          <div className="min-h-0 flex-1" />
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-xs text-white/60">{title}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-between">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}



