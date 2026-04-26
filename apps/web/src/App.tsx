import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import DashboardPage from "./pages/DashboardPage";
import CampusOwnerPage from "./pages/CampusOwnerPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SystemStatusPill from "./components/SystemStatusPill";
import QuadAppShell from "./components/QuadAppShell";

type ThemeMode = "system" | "light" | "dark";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = localStorage.getItem("quad_token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<QuadAppShell />}>
        <Route index element={<LandingPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route
          path="app"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="owner"
          element={
            <ProtectedRoute>
              <CampusOwnerPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem("quad_theme_mode");
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
    return "system";
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolvedTheme = themeMode === "system" ? (media.matches ? "dark" : "light") : themeMode;
      document.documentElement.setAttribute("data-theme", resolvedTheme);
      document.documentElement.setAttribute("data-theme-mode", themeMode);
    };

    apply();
    localStorage.setItem("quad_theme_mode", themeMode);
    media.addEventListener("change", apply);

    return () => media.removeEventListener("change", apply);
  }, [themeMode]);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      document.documentElement.style.setProperty("--cursor-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${event.clientY}px`);
    };
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, []);

  return (
    <BrowserRouter>
      <AppRoutes />
      <SystemStatusPill />
      <div className="theme-switch">
        <button className={themeMode === "system" ? "theme-chip active" : "theme-chip"} onClick={() => setThemeMode("system")} type="button">
          <Monitor size={14} />
          <span>System</span>
        </button>
        <button className={themeMode === "light" ? "theme-chip active" : "theme-chip"} onClick={() => setThemeMode("light")} type="button">
          <Sun size={14} />
          <span>Light</span>
        </button>
        <button className={themeMode === "dark" ? "theme-chip active" : "theme-chip"} onClick={() => setThemeMode("dark")} type="button">
          <Moon size={14} />
          <span>Dark</span>
        </button>
      </div>
    </BrowserRouter>
  );
}

export default App;
