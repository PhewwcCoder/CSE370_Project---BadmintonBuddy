import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../state/auth";
import { Button } from "./ui";

const nav = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/partners", label: "Find partners" },
  { to: "/book", label: "Book match" },
  { to: "/tournaments", label: "Tournaments" },
  { to: "/history", label: "Match history" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/calendar", label: "Calendar sync" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="px-6 pt-6">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-white text-black flex items-center justify-center font-bold">
              BB
            </div>
            <div>
              <div className="text-white font-semibold leading-tight">BadmintonBUDDY</div>
              <div className="text-xs text-white/60">Partner matching • booking • tournaments</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="text-sm text-white/80">
                {user.name} <span className="text-white/40">({user.role})</span>
              </div>
            )}
            {user && (
              <Button
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
              >
                Logout
              </Button>
            )}
          </div>
        </div>

        <nav className="mx-auto max-w-6xl mt-4 flex flex-wrap gap-2">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                [
                  "px-4 py-2 rounded-xl text-sm transition border",
                  isActive
                    ? "bg-white/10 text-white border-white/15"
                    : "bg-white/5 text-white/75 border-white/10 hover:bg-white/10 hover:text-white",
                ].join(" ")
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="px-6 py-6">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>

      {/* clean footer (no dev/meta text) */}
      <footer className="px-6 pb-6">
        <div className="mx-auto max-w-6xl text-xs text-white/35">
          © {new Date().getFullYear()} BadmintonBUDDY
        </div>
      </footer>
    </div>
  );
}

