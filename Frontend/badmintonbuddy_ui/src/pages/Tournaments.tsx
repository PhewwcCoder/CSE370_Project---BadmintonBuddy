// src/pages/Tournaments.tsx
import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, Button, Input, Toast, Divider } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../state/auth";

type Tournament = {
  tournament_id: number;
  name: string;
  description?: string;
  max_players?: number;
  created_at?: string;
};

export default function Tournaments() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [items, setItems] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(16);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function refresh(keepSelection = true) {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      const res: any = await api.tournaments();

      const list: Tournament[] =
        Array.isArray(res) ? res :
        Array.isArray(res?.tournaments) ? res.tournaments :
        Array.isArray(res?.items) ? res.items :
        [];

      setItems(list);

      // keep currently selected tournament if it still exists
      if (keepSelection && selected) {
        const stillThere = list.find((t) => t.tournament_id === selected.tournament_id);
        setSelected(stillThere ?? (list[0] ?? null));
      } else {
        setSelected(list[0] ?? null);
      }
    } catch (e: any) {
      setErr(e.message || "Could not load tournaments");
      setItems([]);
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCreate = useMemo(
    () => isAdmin && name.trim().length > 0 && maxPlayers > 1,
    [isAdmin, name, maxPlayers]
  );

  async function create() {
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await api.createTournament({
        name: name.trim(),
        description: desc.trim(),
        max_players: maxPlayers,
      });
      setOk("Tournament created.");
      setName("");
      setDesc("");
      await refresh(false);
    } catch (e: any) {
      setErr(e.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function joinSelected() {
    if (!selected) return;
    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      // ✅ FIX: backend route is /join/ not /enroll/
      await api.joinTournament(selected.tournament_id);
      setOk("Joined successfully.");
      await refresh(true);
    } catch (e: any) {
      setErr(e.message || "Join failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="md:col-span-2">
        <CardHeader title="Tournaments" subtitle="Create, view and join" />
        <CardBody className="space-y-3">
          {err && <Toast tone="err">{err}</Toast>}
          {ok && <Toast tone="ok">{ok}</Toast>}

          <div className="flex items-center justify-between">
            <div className="text-sm text-white/70">{items.length} tournament(s)</div>
            <Button disabled={busy} onClick={() => refresh(true)}>
              {busy ? "Loading…" : "Refresh"}
            </Button>
          </div>

          <div className="grid gap-2">
            {items.map((t) => (
              <button
                key={t.tournament_id}
                onClick={() => setSelected(t)}
                className={[
                  "text-left rounded-xl border px-4 py-3 transition",
                  selected?.tournament_id === t.tournament_id
                    ? "border-white/30 bg-white/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10",
                ].join(" ")}
              >
                <div className="text-white font-medium">{t.name}</div>
                <div className="text-xs text-white/60">
                  ID: {t.tournament_id} {t.max_players ? `• Max: ${t.max_players}` : ""}
                </div>
                {t.description ? <div className="text-sm text-white/70 mt-1">{t.description}</div> : null}
              </button>
            ))}
            {items.length === 0 && <div className="text-white/60 text-sm">No tournaments yet.</div>}
          </div>

          <Divider />

          <div className="flex gap-2">
            <Button disabled={busy || !selected} onClick={joinSelected}>
              Join selected
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={isAdmin ? "Create tournament" : "Note"}
          subtitle={isAdmin ? "Admins only" : "Participation"}
        />
        <CardBody className="space-y-3 text-sm text-slate-300">
          {isAdmin ? (
            <>
              <div>
                <div className="text-xs text-white/60 mb-1">Tournament name</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Winter Smash 2025" />
              </div>

              <div>
                <div className="text-xs text-white/60 mb-1">Description (optional)</div>
                <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Short description" />
              </div>

              <div>
                <div className="text-xs text-white/60 mb-1">Max players</div>
                <Input
                  type="number"
                  min={2}
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                />
              </div>

              <Button disabled={busy || !canCreate} onClick={create}>
                {busy ? "Creating…" : "Create"}
              </Button>
            </>
          ) : (
            <div>
              Choose a tournament from the list, then click <span className="text-white">Join selected</span>.
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}


