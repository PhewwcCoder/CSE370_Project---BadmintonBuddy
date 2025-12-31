import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Button, Toast, Divider } from "../components/ui";
import { api } from "../lib/api";

type DayItem = {
  match_id: number;
  court_id: number;
  start_time: string;
  end_time: string;
  player1_id: number;
  player1_name: string;
  player2_id: number | null;
  player2_name: string | null;
  tournament_id: number | null;
  tournament_name: string | null;
  round: number | null;
  winner_id: number | null;
  score: string | null;
  type: "friendly" | "tournament";
  open_slot?: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toYMD(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function prettyTime(s: string) {
  const t = s?.split(" ")[1];
  return t ? t.slice(0, 5) : s;
}

export default function Calendar() {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(() => toYMD(new Date()));
  const [items, setItems] = useState<DayItem[]>([]);
  const [courtFilter, setCourtFilter] = useState<number>(0); // 0 = all courts
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const monthLabel = useMemo(() => {
    return monthCursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [monthCursor]);

  // Build calendar grid
  const grid = useMemo(() => {
    const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();

    const cells: Array<{ date: Date; inMonth: boolean }> = [];

    for (let i = 0; i < startDay; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() - (startDay - i));
      cells.push({ date: d, inMonth: false });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ date: new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day), inMonth: true });
    }

    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(last.getDate() + 1);
      cells.push({ date: d, inMonth: false });
    }

    return cells;
  }, [monthCursor]);

  async function loadDay(dateYMD: string) {
    setErr(null);
    setLoading(true);
    try {
      const res = await api.matchesByDay(
        dateYMD,
        courtFilter > 0 ? courtFilter : undefined
      );
      setItems(res.items as DayItem[]);
    } catch (e: any) {
      setItems([]);
      setErr(e.message || "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDay(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDay(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtFilter]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Calendar panel */}
      <Card className="md:col-span-2">
        <CardHeader
          title="Calendar"
          subtitle="Click a date to see all court bookings and tournament matches."
        />
        <CardBody className="space-y-3">
          {err && <Toast tone="err">{err}</Toast>}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  const d = new Date(monthCursor);
                  d.setMonth(d.getMonth() - 1);
                  setMonthCursor(d);
                }}
              >
                ◀
              </Button>

              <div className="text-sm text-slate-200">{monthLabel}</div>

              <Button
                onClick={() => {
                  const d = new Date(monthCursor);
                  d.setMonth(d.getMonth() + 1);
                  setMonthCursor(d);
                }}
              >
                ▶
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="text-xs text-white/60">Court</div>
                <input
                  className="w-20 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                  type="number"
                  min={0}
                  value={courtFilter}
                  onChange={(e) => setCourtFilter(Number(e.target.value))}
                  placeholder="0=All"
                />
              </div>

              <Button disabled={loading} onClick={() => loadDay(selectedDate)}>
                {loading ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          </div>

          <Divider />

          <div className="grid grid-cols-7 gap-2 text-xs text-slate-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="px-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {grid.map((c) => {
              const ymd = toYMD(c.date);
              const isSelected = ymd === selectedDate;
              const isToday = ymd === toYMD(new Date());

              return (
                <button
                  key={ymd}
                  className={[
                    "rounded-xl border px-2 py-2 text-left transition",
                    c.inMonth ? "border-white/10 bg-white/5" : "border-white/5 opacity-60",
                    isSelected ? "ring-2 ring-white/30" : "",
                  ].join(" ")}
                  onClick={() => {
                    setSelectedDate(ymd);
                    loadDay(ymd);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-100">{c.date.getDate()}</div>
                    {isToday && <div className="text-[10px] text-white/60">Today</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Details panel */}
      <Card>
        <CardHeader
          title="Details"
          subtitle={loading ? "Loading…" : `Selected day: ${selectedDate}`}
        />
        <CardBody className="space-y-3">
          <div className="text-xs text-white/60">All bookings on this day</div>

          {loading && <div className="text-sm text-slate-300">Loading…</div>}

          {!loading && items.length === 0 && (
            <div className="text-sm text-slate-300">No bookings on this date.</div>
          )}

          {!loading &&
            items.map((m) => {
              const badge =
                m.type === "tournament"
                  ? `Tournament: ${m.tournament_name ?? "Tournament"}`
                  : "Friendly";

              const opponent =
                m.player2_id == null
                  ? "Open slot (waiting for opponent)"
                  : m.player2_name ?? `User #${m.player2_id}`;

              return (
                <div key={m.match_id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-100">
                      {prettyTime(m.start_time)}–{prettyTime(m.end_time)}
                    </div>
                    <div className="text-[10px] rounded-full border border-white/10 px-2 py-1 text-white/70">
                      {badge}
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-300">
                    Court: <span className="text-slate-100">#{m.court_id}</span>
                  </div>

                  <div className="mt-1 text-xs text-slate-300">
                    Opponent: <span className="text-slate-100">{opponent}</span>
                  </div>

                  {m.score && (
                    <div className="mt-1 text-xs text-slate-300">
                      Score: <span className="text-slate-100">{m.score}</span>
                    </div>
                  )}
                </div>
              );
            })}
        </CardBody>
      </Card>
    </div>
  );
}


