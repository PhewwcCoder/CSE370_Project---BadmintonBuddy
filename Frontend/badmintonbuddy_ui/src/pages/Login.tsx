import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader, Button, Input, Toast } from "../components/ui";
import { useAuth } from "../state/auth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="grid place-items-center py-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader title="Welcome back" subtitle="Login using the Django session backend (cookie-based)." />
          <CardBody>
            <div className="space-y-3">
              {err && <Toast tone="err">{err}</Toast>}
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
                    await login(email, password);
                    nav("/dashboard");
                  } catch (e: any) {
                    setErr(e.message || "Login failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Logging in…" : "Login"}
              </Button>

              <div className="text-sm text-slate-400">
                New here?{" "}
                <Link to="/signup" className="text-white underline underline-offset-4">
                  Create an account
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
