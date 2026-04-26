import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config";

type HealthPayload = {
  ok?: boolean;
  service?: string;
};

function SystemStatusPill() {
  const [online, setOnline] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  async function checkHealth() {
    try {
      const response = await fetch(`${API_URL}/health`, { method: "GET" });
      if (!response.ok) {
        setOnline(false);
        return;
      }
      const payload = (await response.json()) as HealthPayload;
      setOnline(Boolean(payload.ok));
    } catch {
      setOnline(false);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    void checkHealth();
    const timer = window.setInterval(() => {
      void checkHealth();
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const label = useMemo(() => {
    if (checking) return "Checking API...";
    return online ? "API Live" : "API Offline";
  }, [checking, online]);

  return (
    <div className={online ? "system-status-pill online" : "system-status-pill offline"} aria-live="polite">
      <span className="dot" />
      <span>{label}</span>
    </div>
  );
}

export default SystemStatusPill;
