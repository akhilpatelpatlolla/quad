import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import AdSlot from "../components/AdSlot";
import { API_URL } from "../config";
import { messageFromApiError, messageFromFetchFailure, readResponseJson } from "../utils/apiError";
import { hapticError, hapticSuccess, hapticTap } from "../utils/haptics";

function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    collegeName: "CBIT Hyderabad",
    departmentName: "ECE",
    batchStartYear: 2025,
    batchEndYear: 2029
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    window.dispatchEvent(new Event("quad:loading:start"));
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const payload = await readResponseJson(response);
      if (!response.ok) {
        throw new Error(messageFromApiError(payload));
      }
      const body = payload as { token?: string; user?: unknown };
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
        <p className="caps auth-visual-eyebrow">Onboarding</p>
        <h2>Claim your program context in one pass.</h2>
        <p>We scope you to a real college, program, and batch — the same object graph you will see inside the
          dashboard.</p>
      </div>
      <div className="auth-panel">
        <div className="auth-brand">
          <div className="auth-brand-title">
            <span className="quad-wordmark" style={{ fontSize: "2.35rem" }}>
              QUAD
            </span>
          </div>
          <p className="auth-brand-line">Free to join — partners fund the room, not your tuition</p>
        </div>
        <section className="auth-card glass-pro">
          <p className="caps">Create account</p>
          <h1>Claim your verified student identity</h1>
          <p className="subtle">Instant access; your admin finishes verification in workflow.</p>

          <form onSubmit={onSubmit}>
            <input placeholder="Full Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input placeholder="Password (8+ characters)" type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <input placeholder="College" value={form.collegeName} onChange={(e) => setForm({ ...form, collegeName: e.target.value })} required />
            <input placeholder="Department" value={form.departmentName} onChange={(e) => setForm({ ...form, departmentName: e.target.value })} required />
            <p className="subtle" style={{ margin: "0.25rem 0" }}>Password: at least 8 characters.</p>
            <div className="grid-2">
              <div>
                <span className="input-label">Batch start year</span>
                <input type="number" min={2020} max={2040} value={form.batchStartYear} onChange={(e) => setForm({ ...form, batchStartYear: Number(e.target.value) })} required />
              </div>
              <div>
                <span className="input-label">Batch end year</span>
                <input type="number" min={2020} max={2040} value={form.batchEndYear} onChange={(e) => setForm({ ...form, batchEndYear: Number(e.target.value) })} required />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} onMouseDown={hapticTap}>
              {loading ? "Creating..." : "Create Account"} <ArrowRight size={16} />
            </button>
          </form>

          {error ? <p className="error">{error}</p> : null}
          <p className="switch-link">Already registered? <Link to="/login">Login</Link></p>
        </section>
        <AdSlot
          id="auth-register-inline"
          format="inline"
          title="Brand Collaboration Slot"
          description="Reserved placement for trusted onboarding sponsors."
        />
      </div>
    </main>
  );
}

export default RegisterPage;
