import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Button, Badge, Toast, Divider, Input } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../state/auth";

type Row = { user_id: number; name: string; wins: number; total_matches: number; skill_rating: number };

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function refresh() {
    const res = await api.leaderboard();
    setRows(res.leaderboard || []);
  }

  useEffect(() => {
    refresh().catch((e: any) => setErr(e.message || "Failed to load leaderboard"));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q) || String(r.user_id) === q);
  }, [rows, query]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader title="Leaderboard" subtitle="GET /api/tournaments/leaderboard/ (wins → matches → skill)" />
        <CardBody className="space-y-3">
          {err && <Toast tone="err">{err}</Toast>}

          <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between">
            <div className="flex gap-2 flex-wrap items-center">
              <Badge>Top 20</Badge>
              <Badge>Session user: {user?.name}</Badge>
            </div>
            <div className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or user_id…" />
              <Button variant="ghost" onClick={() => refresh().catch((e: any) => setErr(e.message || "Refresh failed"))}>
                Refresh
              </Button>
            </div>
          </div>

          <Divider />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Wins</th>
                  <th className="py-2 pr-3">Matches</th>
                  <th className="py-2 pr-3">Skill</th>
                  <th className="py-2 pr-3">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-slate-400">
                      No rows.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r, idx) => {
                    const rate = r.total_matches ? Math.round((r.wins / r.total_matches) * 100) : 0;
                    const me = r.user_id === user?.user_id;
                    return (
                      <tr key={r.user_id} className={"border-t border-slate-800 " + (me ? "bg-white/5" : "")}
                      >
                        <td className="py-3 pr-3 text-slate-300">{idx + 1}</td>
                        <td className="py-3 pr-3">
                          <div className="font-medium text-white">
                            {r.name} {me ? <span className="text-emerald-200">(you)</span> : null}
                          </div>
                          <div className="text-xs text-slate-500">user_id: {r.user_id}</div>
                        </td>
                        <td className="py-3 pr-3 text-white">{r.wins}</td>
                        <td className="py-3 pr-3 text-slate-200">{r.total_matches}</td>
                        <td className="py-3 pr-3 text-slate-200">{r.skill_rating}</td>
                        <td className="py-3 pr-3 text-slate-200">{rate}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="How this is computed" subtitle="From tournaments/views.py" />
        <CardBody className="text-sm text-slate-300 space-y-2 leading-relaxed">
          <div>
            Backend query orders players by <span className="text-white">wins</span>, then <span className="text-white">total_matches</span>, then <span className="text-white">skill_rating</span>.
          </div>
          <div className="text-xs text-slate-500">
            If you want a per-tournament leaderboard too, your backend already supports:
            <div className="mt-1 text-slate-300">GET /api/tournaments/&lt;id&gt;/leaderboard/</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
