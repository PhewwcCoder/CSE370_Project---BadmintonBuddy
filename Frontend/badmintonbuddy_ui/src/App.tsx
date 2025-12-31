import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import PartnerMatching from "./pages/PartnerMatching";
import BookMatch from "./pages/BookMatch";
import Tournaments from "./pages/Tournaments";
import Leaderboard from "./pages/Leaderboard";
import Calendar from "./pages/Calendar";
import History from "./pages/History";
import { AuthProvider, useAuth } from "./state/auth";

import bg from "./assets/bg_badminton2.avif"; // ✅ background image

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-6 text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return children;
}

export default function App() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* 🔹 BACKGROUND IMAGE */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-100 blur-sm"
        style={{ backgroundImage: `url(${bg})` }}
      />

      {/* 🔹 DARK OVERLAY (stronger, cinematic) */}
      <div className="absolute inset-0 bg-black/75" />

      {/* 🔹 APP CONTENT */}
      <div className="relative z-10">
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />

              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              <Route
                path="/dashboard"
                element={
                  <Protected>
                    <Dashboard />
                  </Protected>
                }
              />

              <Route
                path="/partners"
                element={
                  <Protected>
                    <PartnerMatching />
                  </Protected>
                }
              />

              <Route
                path="/book"
                element={
                  <Protected>
                    <BookMatch />
                  </Protected>
                }
              />

              <Route
                path="/tournaments"
                element={
                  <Protected>
                    <Tournaments />
                  </Protected>
                }
              />

              <Route
                path="/leaderboard"
                element={
                  <Protected>
                    <Leaderboard />
                  </Protected>
                }
              />

              <Route
                path="/calendar"
                element={
                  <Protected>
                    <Calendar />
                  </Protected>
                }
              />

              <Route
                path="/history"
                element={
                  <Protected>
                    <History />
                  </Protected>
                }
              />
            </Route>
          </Routes>
        </AuthProvider>
      </div>
    </div>
  );
}


