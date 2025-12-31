import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Button, Badge, Toast, Divider, Input } from "../components/ui";
import { api } from "../lib/api";

type Row = {
  match_id: number;
  court_id: number;
  player1_id: number;
  player1_name: string;
  player2_id: number;
  player2_name: string;
  start_time: string;
  end_time: string;
  tournament_id: number | null;
  round: number | null;
  winner_id: number | null;
  score: string | null;
};

export default function History() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function refresh() {
    const res = await api.matchHistory();
    setRows(res.history || []);
  }

  useEffect(() => {
    refresh().catch((e: any) => setErr(e.message || "Failed to load history"));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const players = `${r.player1_name} ${r.player2_name}`.toLowerCase();
      const ids = `${r.player1_id} ${r.player2_id} ${r.match_id} ${r.court_id}`;
      return players.includes(q) || ids.includes(q) || (r.tournament_id != null && String(r.tournament_id) === q);
    });
  }, [rows, query]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader title="Match history" subtitle="GET /api/matches/history/ (last 50)" />
        <CardBody className="space-y-3">
          {err && <Toast tone="err">{err}</Toast>}

          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="flex gap-2 flex-wrap">
              <Badge>{rows.length} loaded</Badge>
              <Badge>Includes tournaments + friendly</Badge>
            </div>
            <div className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search player, match_id, tournament_id…" />
              <Button variant="ghost" onClick={() => refresh().catch((e: any) => setErr(e.message || "Refresh failed"))}>
                Refresh
              </Button>
            </div>
          </div>

          <Divider />

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="text-sm text-slate-400">No matches found.</div>
            ) : (
              filtered.map((m) => (
                <div key={m.match_id} className="rounded-2xl border border-slate-800 bg-slate-950/30 p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <div className="font-semibold text-white">
                        {m.player1_name} <span className="text-slate-500">vs</span> {m.player2_name}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        match_id: {m.match_id} • court: {m.court_id} • {m.start_time} → {m.end_time}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.tournament_id ? <Badge>tournament: {m.tournament_id}</Badge> : <Badge>friendly</Badge>}
                        {m.round != null ? <Badge>round: {m.round}</Badge> : null}
                        {m.winner_id != null ? <Badge>winner: {m.winner_id}</Badge> : <Badge>pending</Badge>}
                        {m.score ? <Badge>score: {m.score}</Badge> : null}
                      </div>
                    </div>

                    <div className="text-xs text-slate-500">
                      P1: {m.player1_id} • P2: {m.player2_id}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
