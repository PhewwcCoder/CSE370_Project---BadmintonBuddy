import { useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Button, Input, Toast, Divider } from "../components/ui";
import { api } from "../lib/api";

type Partner = {
  user_id: number;
  name: string;
  email: string;
  skill_rating: number;
};

function buildISO(date: string, time: string) {
  if (!date || !time) return "";
  return `${date}T${time}:00`;
}

export default function PartnerMatching() {
  const [date, setDate] = useState("");        // YYYY-MM-DD
  const [startTime, setStartTime] = useState(""); // HH:mm
  const [endTime, setEndTime] = useState("");     // HH:mm
  const [maxSkillDiff, setMaxSkillDiff] = useState(2);
  const [limit, setLimit] = useState(5);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);

  const isoStart = useMemo(() => buildISO(date, startTime), [date, startTime]);
  const isoEnd = useMemo(() => buildISO(date, endTime), [date, endTime]);

  const canSubmit = useMemo(() => {
    if (!date || !startTime || !endTime) return false;
    if (isoStart >= isoEnd) return false;
    return true;
  }, [date, startTime, endTime, isoStart, isoEnd]);

  async function find() {
    setErr(null);
    setNote(null);
    setPartners([]);
    setBusy(true);
    try {
      const res = await api.findPartners({
        start_time: isoStart,
        end_time: isoEnd,
        max_skill_diff: maxSkillDiff,
        limit,
      });

      const list: Partner[] = res?.available_partners ?? [];
      setPartners(list);

      if (list.length === 0) {
        setNote("No available partners found for that time. Try a different slot.");
      }
    } catch (e: any) {
      setErr(e.message || "Find partners failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader title="Find partners" subtitle="Choose a time slot and we’ll show who’s available." />
        <CardBody className="space-y-3">
          {err && <Toast tone="err">{err}</Toast>}
          {note && <Toast tone="ok">{note}</Toast>}

          {/* ✅ DATE: use native date picker (YYYY-MM-DD) */}
          <div>
            <div className="text-xs text-white/60 mb-1">Date</div>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          {/* ✅ TIME: native time pickers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-white/60 mb-1">Start time</div>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">End time</div>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <Divider />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-white/60 mb-1">Max skill difference</div>
              <Input type="number" min={0} value={maxSkillDiff} onChange={(e) => setMaxSkillDiff(Number(e.target.value))} />
            </div>
            <div>
              <div className="text-xs text-white/60 mb-1">Results limit</div>
              <Input type="number" min={1} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
            </div>
          </div>

          <Button disabled={busy || !canSubmit} onClick={find}>
            {busy ? "Searching…" : "Find partners"}
          </Button>

          <div className="text-xs text-white/50">
            Tip: If you don’t find anyone, widen the skill difference or try another hour.
          </div>

          {/* Optional: preview ISO (good for viva debugging) */}
          <div className="text-[11px] text-white/40">
            ISO preview: {isoStart || "-"} to {isoEnd || "-"}
          </div>
        </CardBody>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader title="Available partners" subtitle="Players who match your slot and skill range." />
        <CardBody className="space-y-2">
          {partners.length === 0 && <div className="text-sm text-white/60">No results to show yet.</div>}

          {partners.map((p) => (
            <div key={p.user_id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div className="text-white font-medium">{p.name}</div>
                <div className="text-xs text-white/60">Skill: {p.skill_rating}</div>
              </div>
              <div className="text-xs text-white/60">User ID: {p.user_id}</div>
              <div className="text-xs text-white/50">{p.email}</div>

              <div className="mt-2">
                <Button
                  onClick={() => {
                    // Prefill booking page with this partner and time window
                    sessionStorage.setItem(
                      "bb_booking_prefill",
                      JSON.stringify({
                        opponent_id: p.user_id,
                        opponent_name: p.name,
                        start_time: isoStart,
                        end_time: isoEnd,
                      })
                    );
                    setNote(`Selected partner: ${p.name}. Now go to "Book match" to confirm.`);
                  }}
                >
                  Select partner
                </Button>
              </div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}


