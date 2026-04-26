import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AdSlot from "../components/AdSlot";
import { API_URL } from "../config";
import { messageFromApiError, messageFromFetchFailure, readResponseJson } from "../utils/apiError";
import { hapticError, hapticSuccess, hapticTap } from "../utils/haptics";

function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    window.dispatchEvent(new Event("quad:loading:start"));
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await readResponseJson(response);
      if (!response.ok) {
        throw new Error(messageFromApiError(payload));
      }
      const body = payload as { token?: string };
      if (!body.token) throw new Error("No token received from server.");
      localStorage.setItem("quad_token", body.token);
      hapticSuccess();
      navigate("/app");
    } catch (err) {
      setError(messageFromFetchFailure(err));
      hapticError();
    } finally {
      setLoading(false);
      window.dispatchEvent(new Event("quad:loading:stop"));
    }
  }

  return (
    <main className="auth-page auth-split">
      <div className="auth-visual">
        <p className="caps auth-visual-eyebrow">Access</p>
        <h2>Drop into the same glass shell as the campus deck.</h2>
        <p>One steady frame: this screen, the landing page, and /app all share the same spatial contract — no cheap
          template skin swap after you log in.</p>
      </div>
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="auth-brand-title">
            <span className="quad-wordmark" style={{ fontSize: "2.35rem" }}>
              QUAD
            </span>
          </div>
          <p className="auth-brand-line">No student fees — you are the identity inside the layer</p>
        </div>
        <section className="auth-card glass-pro">
          <p className="caps">Sign in</p>
          <h1>Welcome back</h1>
          <p className="subtle">Seeded admin: admin@quad.in / Admin@123</p>

          <form onSubmit={onSubmit}>
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <button className="btn btn-primary" type="submit" disabled={loading} onMouseDown={hapticTap}>
              {loading ? "Signing in..." : "Sign In"} <ArrowRight size={16} />
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}
          <p className="switch-link">New here? <Link to="/register">Create account</Link></p>
        </section>
        <AdSlot
          id="auth-login-inline"
          format="inline"
          title="Sponsored Student Deals"
          description="Dedicated high-intent ad inventory beside login flow."
        />
      </div>
    </main>
  );
}

export default LoginPage;
