import bracuCourt from "../assets/bracu_court.jpg";
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Button, Input, Toast, Divider } from "../components/ui";
import { api } from "../lib/api";

type Prefill = {
  opponent_id: number;
  opponent_name?: string;
  start_time: string; // ISO string like 2025-12-28T17:00:00
  end_time: string;
};

// Convert "2025-12-28T17:00:00" -> { date:"2025-12-28", time:"17:00" }
function splitISO(iso: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  // handle both "YYYY-MM-DDTHH:mm:ss" and "YYYY-MM-DD HH:mm:ss"
  const norm = iso.replace(" ", "T");
  const [d, tRaw] = norm.split("T");
  const t = (tRaw || "").slice(0, 5); // HH:mm
  return { date: d || "", time: t || "" };
}

// Build ISO "YYYY-MM-DDTHH:mm:00"
function buildISO(date: string, time: string): string {
  if (!date || !time) return "";
  return `${date}T${time}:00`;
}

export default function BookMatch() {
  const [courtId, setCourtId] = useState(1);
  const [opponentId, setOpponentId] = useState<number>(0); // 0 means "not provided"

  // ✅ Same style as Find Partners
  const [date, setDate] = useState(""); // YYYY-MM-DD
  const [startTime, setStartTime] = useState(""); // HH:mm
  const [endTime, setEndTime] = useState(""); // HH:mm

  const [note, setNote] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    // Prefill from partner-matching flow (if exists)
    const raw = sessionStorage.getItem("bb_booking_prefill");
    if (!raw) return;
    try {
      const p = JSON.parse(raw) as Prefill;

      setOpponentId(p.opponent_id || 0);

      const s = splitISO(p.start_time);
      const e = splitISO(p.end_time);

      // If dates mismatch (rare), keep start date
      setDate(s.date || e.date || "");
      setStartTime(s.time || "");
      setEndTime(e.time || "");

      setNote(p.opponent_name ? `Selected partner: ${p.opponent_name}` : "Booking details prefilled.");
    } catch {}
  }, []);

  const isoStart = useMemo(() => buildISO(date, startTime), [date, startTime]);
  const isoEnd = useMemo(() => buildISO(date, endTime), [date, endTime]);

  const canSubmit = useMemo(() => {
    // basic checks; backend will still validate conflicts
    if (!(courtId > 0 && date && startTime && endTime)) return false;
    if (isoStart >= isoEnd) return false; // simple string compare works for ISO
    return true;
  }, [courtId, date, startTime, endTime, isoStart, isoEnd]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader title="Book a court slot" subtitle="Choose a court, optionally add an opponent, and your preferred time." />
        <CardBody className="space-y-3">
          {note && <Toast tone="ok">{note}</Toast>}
          {err && <Toast tone="err">{err}</Toast>}
          {ok && <Toast tone="ok">{ok}</Toast>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-300 mb-1">Court ID</div>
              <Input type="number" min={1} value={courtId} onChange={(e) => setCourtId(Number(e.target.value))} />
            </div>

            <div>
              <div className="text-xs text-slate-300 mb-1">Opponent user ID (optional)</div>
              <Input
                type="number"
                min={1}
                value={opponentId > 0 ? opponentId : ""}
                placeholder="Leave empty to create open slot"
                onChange={(e) => {
                  const v = e.target.value;
                  setOpponentId(v === "" ? 0 : Number(v));
                }}
              />
            </div>
          </div>

          {/* ✅ Match Find Partners: date + time pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-300 mb-1">Date</div>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-300 mb-1">Start time</div>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-slate-300 mb-1">End time</div>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Helpful preview so you can show teacher */}
          <div className="text-xs text-white/50">
            Preview ISO:
            <div className="mt-1">
              <span className="text-white/70">start_time:</span> <span className="text-white/60">{isoStart || "-"}</span>
            </div>
            <div>
              <span className="text-white/70">end_time:</span> <span className="text-white/60">{isoEnd || "-"}</span>
            </div>
          </div>

          <Button
            disabled={busy || !canSubmit}
            onClick={async () => {
              setErr(null);
              setOk(null);
              setBusy(true);
              try {
                const payload: { court_id: number; start_time: string; end_time: string; opponent_id?: number } = {
                  court_id: courtId,
                  start_time: isoStart,
                  end_time: isoEnd,
                };
                if (opponentId > 0) payload.opponent_id = opponentId;

                const res = await api.bookMatch(payload);
                const openMsg = res.open_slot ? " (Open slot created)" : "";
                setOk(`Booking confirmed! Match ID: ${res.match_id}${openMsg}`);
              } catch (e: any) {
                setErr(e.message || "Booking failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Booking…" : "Confirm booking"}
          </Button>

          <Divider />

          <div className="text-xs text-white/50">
            Note: Date/Time picker uses browser UI (same as Find Partners). Backend still stores as DATETIME.
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Court tips" subtitle="Before you confirm" />
        <CardBody className="text-sm text-slate-300 space-y-2">
          <div>• Use a valid Court ID (for example: 1, 2, 3).</div>
          <div>• If you add an opponent’s user ID, make sure it’s correct.</div>
          <div>• Start time must be earlier than end time.</div>
          <div>• If the slot is already taken, choose another time.</div>
          <div>• Leaving opponent empty will create an open slot that others can join.</div>

          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <img src={bracuCourt} alt="BRACU Badminton Court" className="h-48 w-full object-cover" loading="lazy" />
            <div className="px-3 py-2 text-xs text-white/60 text-center">BRACU Indoor Badminton Court</div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}


