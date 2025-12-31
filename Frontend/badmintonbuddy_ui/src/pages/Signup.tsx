import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader, Button, Input, Toast } from "../components/ui";
import { useAuth } from "../state/auth";

export default function Signup() {
  const { signup } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid place-items-center py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader title="Create account" subtitle="Starts with role=player and skill_rating=0 in your schema." />
          <CardBody>
            <div className="space-y-3">
              {err && <Toast tone="err">{err}</Toast>}
              <div>
                <div className="text-xs text-slate-300 mb-1">Name</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aryan" />
              </div>
              <div>
                <div className="text-xs text-slate-300 mb-1">Email</div>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@bracu.ac.bd" />
              </div>
              <div>
                <div className="text-xs text-slate-300 mb-1">Password</div>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
              </div>

              <Button
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setErr(null);
                  setBusy(true);
                  try {
                    await signup(name, email, password);
                    nav("/dashboard");
                  } catch (e: any) {
                    setErr(e.message || "Signup failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Creating…" : "Sign up"}
              </Button>

              <div className="text-sm text-slate-400">
                Already have an account?{" "}
                <Link to="/login" className="text-white underline underline-offset-4">
                  Login
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
