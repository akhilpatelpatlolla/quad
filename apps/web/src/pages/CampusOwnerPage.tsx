import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Crown, Layers3, ShieldCheck, UserCog, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AdSlot from "../components/AdSlot";
import { API_URL } from "../config";
import { messageFromApiError, readResponseJson } from "../utils/apiError";
import { hapticError, hapticSuccess, hapticTap } from "../utils/haptics";

type User = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "ADMIN" | "BRAND" | "RECRUITER";
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  college?: { name: string } | null;
};

type OwnerGroup = {
  id: string;
  name: string;
  description: string;
  departmentName: string | null;
  owner: { id: string; name: string; email: string };
  poc: { id: string; name: string; email: string } | null;
  memberCount: number;
  pendingRequests: number;
  createdAt: string;
};

type OwnerOverview = {
  metrics: {
    groupCount: number;
    membersCount: number;
    pendingCount: number;
  };
  departmentStats: Array<{
    departmentName: string;
    groupCount: number;
    memberCount: number;
    pendingRequests: number;
  }>;
  groups: OwnerGroup[];
};

type PocCandidate = {
  id: string;
  name: string;
  email: string;
  department?: { name: string } | null;
};

type IncomingRequest = {
  id: string;
  message?: string | null;
  createdAt: string;
  requester: { id: string; name: string; email: string };
  group: { id: string; name: string };
};

function CampusOwnerPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem("quad_token") ?? "";

  const [user, setUser] = useState<User | null>(null);
  const [overview, setOverview] = useState<OwnerOverview | null>(null);
  const [verifiedUsers, setVerifiedUsers] = useState<PocCandidate[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>([]);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [pocSelections, setPocSelections] = useState<Record<string, string>>( {} );
  const [ownerSelections, setOwnerSelections] = useState<Record<string, string>>( {} );
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const maxMembers = useMemo(() => {
    const max = overview?.departmentStats.reduce((acc, row) => Math.max(acc, row.memberCount), 1) ?? 1;
    return Math.max(max, 1);
  }, [overview]);

  async function api<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown): Promise<T> {
    window.dispatchEvent(new Event("quad:loading:start"));
    try {
      const response = await fetch(`${API_URL}/${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await readResponseJson(response);
      if (!response.ok) {
        throw new Error(messageFromApiError(payload));
      }
      return payload as T;
    } finally {
      window.dispatchEvent(new Event("quad:loading:stop"));
    }
  }

  async function loadAll() {
    if (!token) {
      navigate("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [me, ownerOverview, users, requests] = await Promise.all([
        api<User>("me"),
        api<OwnerOverview>("owner/overview"),
        api<PocCandidate[]>("users/verified"),
        api<IncomingRequest[]>("groups/requests/incoming")
      ]);

      if (me.role !== "ADMIN") {
        navigate("/app");
        return;
      }

      setUser(me);
      setOverview(ownerOverview);
      setVerifiedUsers(users);
      setIncomingRequests(requests);

      const pocMap: Record<string, string> = {};
      const ownerMap: Record<string, string> = {};
      ownerOverview.groups.forEach((group) => {
        pocMap[group.id] = group.poc?.id ?? "";
        ownerMap[group.id] = group.owner.id;
      });

      setPocSelections(pocMap);
      setOwnerSelections(ownerMap);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function updatePoc(groupId: string) {
    try {
      const pocUserId = pocSelections[groupId] || null;
      await api(`owner/groups/${groupId}/poc`, "PATCH", { pocUserId });
      await loadAll();
      setMessage("POC updated successfully.");
      hapticSuccess();
    } catch (e) {
      setError((e as Error).message);
      hapticError();
    }
  }

  async function removePoc(groupId: string) {
    try {
      await api(`owner/groups/${groupId}/poc`, "PATCH", { pocUserId: null });
      await loadAll();
      setMessage("POC removed.");
      hapticSuccess();
    } catch (e) {
      setError((e as Error).message);
      hapticError();
    }
  }

  async function transferOwner(groupId: string) {
    try {
      const newOwnerId = ownerSelections[groupId];
      if (!newOwnerId) return;
      await api(`owner/groups/${groupId}/transfer`, "PATCH", { newOwnerId });
      await loadAll();
      setMessage("Ownership transferred.");
      hapticSuccess();
    } catch (e) {
      setError((e as Error).message);
      hapticError();
    }
  }

  async function bulkApprove() {
    try {
      if (selectedRequestIds.length === 0) {
        return;
      }

      await api<{ updated: number }>("owner/groups/requests/bulk-approve", "POST", {
        requestIds: selectedRequestIds
      });

      setSelectedRequestIds([]);
      await loadAll();
      setMessage("Selected join requests approved.");
      hapticSuccess();
    } catch (e) {
      setError((e as Error).message);
      hapticError();
    }
  }

  function toggleRequestSelection(requestId: string) {
    setSelectedRequestIds((current) => {
      if (current.includes(requestId)) {
        return current.filter((id) => id !== requestId);
      }
      return [...current, requestId];
    });
  }


  if (loading) {
    return (
      <main className="owner-app-shell">
        <div className="owner-steady-scroll">
          <section className="glass owner-shell owner-loading fade-section">
            <p className="subtle">Loading Campus Owner Console...</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="owner-app-shell">
      <div className="owner-steady-scroll">
      <section className="glass owner-hero fade-section">
        <div>
          <p className="caps">CAMPUS OWNER CONSOLE</p>
          <h1>{user?.college?.name ?? "Campus"} Command Layer</h1>
          <p className="subtle">Enterprise-grade control over POC assignment, ownership transfer, request approvals, and department-level analytics.</p>
        </div>
        <div className="owner-hero-actions">
          <Link className="btn btn-ghost" to="/app"><ArrowLeft size={14} /> Back to App</Link>
          <button className="btn btn-primary" type="button" onClick={loadAll} onMouseDown={hapticTap}>Refresh</button>
        </div>
      </section>

      <AdSlot
        id="owner-console-banner"
        format="banner"
        title="Program-level partner lane"
        description="Reserved for B2B programs that hire from or serve your institution. Students never pay to sit in the room."
        cta="Request partnership deck"
        mode="partner"
      />

      <section className="owner-metrics fade-section">
        <article className="glass owner-metric-card">
          <div><Layers3 size={18} /><span>Total Groups</span></div>
          <strong>{overview?.metrics.groupCount ?? 0}</strong>
        </article>
        <article className="glass owner-metric-card">
          <div><Users size={18} /><span>Total Members</span></div>
          <strong>{overview?.metrics.membersCount ?? 0}</strong>
        </article>
        <article className="glass owner-metric-card">
          <div><ShieldCheck size={18} /><span>Pending Requests</span></div>
          <strong>{overview?.metrics.pendingCount ?? 0}</strong>
        </article>
      </section>

      <section className="owner-grid fade-section">
        <section className="glass owner-panel">
          <h2>Department Analytics</h2>
          {(overview?.departmentStats ?? []).map((row) => (
            <motion.div key={row.departmentName} className="dept-row" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="dept-head">
                <strong>{row.departmentName}</strong>
                <span>{row.memberCount} members</span>
              </div>
              <div className="dept-bar-track"><div className="dept-bar-fill" style={{ width: `${Math.max((row.memberCount / maxMembers) * 100, 8)}%` }} /></div>
              <p className="meta">{row.groupCount} groups | {row.pendingRequests} pending</p>
            </motion.div>
          ))}
        </section>

        <section className="glass owner-panel">
          <h2>Bulk Approvals</h2>
          <p className="subtle">Select multiple incoming join requests and approve them in one action.</p>
          <button className="btn btn-primary" type="button" onClick={bulkApprove} disabled={selectedRequestIds.length === 0}>
            <Check size={14} /> Approve Selected ({selectedRequestIds.length})
          </button>

          <div className="owner-request-list">
            {incomingRequests.length === 0 ? <p className="subtle">No pending join requests.</p> : null}
            {incomingRequests.map((request) => (
              <label key={request.id} className="owner-request-item">
                <input
                  type="checkbox"
                  checked={selectedRequestIds.includes(request.id)}
                  onChange={() => toggleRequestSelection(request.id)}
                />
                <div>
                  <strong>{request.requester.name}{" -> "}{request.group.name}</strong>
                  <p className="meta">{request.message || "No message"}</p>
                </div>
              </label>
            ))}
          </div>
        </section>
      </section>

      <section className="glass owner-panel owner-groups fade-section">
        <h2>Group Controls</h2>
        <p className="subtle">Edit or remove POC, and transfer ownership to any verified campus member.</p>

        <div className="owner-group-list">
          {(overview?.groups ?? []).map((group) => (
            <article key={group.id} className="owner-group-card">
              <div className="owner-group-head">
                <div>
                  <h3>{group.name}</h3>
                  <p className="meta">{group.departmentName ?? "Campus-wide"} | {group.memberCount} members | {group.pendingRequests} pending</p>
                </div>
                <span className="status-chip">Owner: {group.owner.name}</span>
              </div>
              <p>{group.description}</p>

              <div className="owner-control-row">
                <div className="owner-control-block">
                  <p className="caps">POC CONTROL</p>
                  <select value={pocSelections[group.id] ?? ""} onChange={(e) => setPocSelections((s) => ({ ...s, [group.id]: e.target.value }))}>
                    <option value="">Unassigned</option>
                    {verifiedUsers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.department?.name ?? "No department"})</option>
                    ))}
                  </select>
                  <div className="owner-inline-actions">
                    <button className="btn btn-primary" type="button" onClick={() => updatePoc(group.id)}><UserCog size={14} /> Save POC</button>
                    <button className="btn btn-ghost" type="button" onClick={() => removePoc(group.id)}>Remove POC</button>
                  </div>
                </div>

                <div className="owner-control-block">
                  <p className="caps">OWNERSHIP</p>
                  <select value={ownerSelections[group.id] ?? group.owner.id} onChange={(e) => setOwnerSelections((s) => ({ ...s, [group.id]: e.target.value }))}>
                    {verifiedUsers.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.department?.name ?? "No department"})</option>
                    ))}
                  </select>
                  <button className="btn btn-primary" type="button" onClick={() => transferOwner(group.id)}><Crown size={14} /> Transfer Ownership</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {message ? <p className="notice fade-section">{message}</p> : null}
      {error ? <p className="error fade-section">{error}</p> : null}
      <AdSlot
        id="owner-console-inline"
        format="inline"
        title="Analytics + insight placement"
        description="A calm slot for partner-grade insight beside your real approval workflow — your students are not a paywall line item."
        cta="Talk to our team"
        mode="brand"
      />
      </div>
    </main>
  );
}

export default CampusOwnerPage;
