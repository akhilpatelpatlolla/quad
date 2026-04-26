import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import AdSlot from "../components/AdSlot";
import {
  Bell,
  BellRing,
  Briefcase,
  CircleDollarSign,
  Flame,
  GraduationCap,
  LogOut,
  Megaphone,
  MessageSquare,
  Search,
  Sparkles,
  Star,
  Store,
  Trophy,
  Users,
  UserRoundCheck
} from "lucide-react";
import dayjs from "dayjs";
import { io, Socket } from "socket.io-client";
import { Link, useNavigate } from "react-router-dom";
import { API_URL, getSocketConnectUrl } from "../config";
import { messageFromApiError, readResponseJson } from "../utils/apiError";
import { hapticError, hapticSuccess, hapticTap } from "../utils/haptics";

type SimpleEntity = {
  id: string;
  createdAt?: string;
  title?: string;
  content?: string;
  description?: string;
  message?: string;
  brand?: string;
  company?: string;
  code?: string;
  name?: string;
  topic?: string;
};

type CampusGroup = {
  id: string;
  name: string;
  description: string;
  departmentName: string | null;
  owner: { id: string; name: string; email: string };
  poc: { id: string; name: string; email: string } | null;
  memberCount: number;
  isMember: boolean;
  myRequestStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
};

type GroupJoinRequest = {
  id: string;
  message?: string | null;
  createdAt: string;
  requester: { id: string; name: string; email: string };
  group: { id: string; name: string };
};

type PocCandidate = {
  id: string;
  name: string;
  email: string;
  department?: { name: string } | null;
};

type ActivityEntry = {
  id: string;
  text: string;
  time: string;
};

type MentorSession = {
  id: string;
  topic: string;
  mentor: string;
  mode: "Online" | "Offline";
  slot: string;
  note: string;
  createdAt: string;
};

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};



type User = {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "ADMIN" | "BRAND" | "RECRUITER";
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  college?: { name: string } | null;
  department?: { name: string } | null;
  batch?: { name: string } | null;
};

const tabConfig: Array<{ tab: Tab; icon: ReactNode }> = [
  { tab: "Campus Wall", icon: <Megaphone size={16} /> },
  { tab: "Batch Room", icon: <MessageSquare size={16} /> },
  { tab: "Campus Bazaar", icon: <Store size={16} /> },
  { tab: "Opportunities", icon: <Briefcase size={16} /> },
  { tab: "Student Perks", icon: <CircleDollarSign size={16} /> },
  { tab: "Resources", icon: <GraduationCap size={16} /> },
  { tab: "Events", icon: <Bell size={16} /> },
  { tab: "Study Rooms", icon: <Users size={16} /> },
  { tab: "Campus Groups", icon: <UserRoundCheck size={16} /> },
  { tab: "Mentorship Hub", icon: <Trophy size={16} /> }
];

function DashboardPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [token, setToken] = useState<string>(() => localStorage.getItem("quad_token") ?? "");
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("Campus Wall");
  const [items, setItems] = useState<SimpleEntity[]>([]);
  const [groupItems, setGroupItems] = useState<CampusGroup[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<GroupJoinRequest[]>([]);
  const [pocCandidates, setPocCandidates] = useState<PocCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");

  const [postContent, setPostContent] = useState("");
  const [batchMessage, setBatchMessage] = useState("");
  const [marketForm, setMarketForm] = useState({ title: "", description: "", price: "" });
  const [opportunityForm, setOpportunityForm] = useState({ title: "", company: "", description: "" });
  const [dealForm, setDealForm] = useState({ brand: "", title: "", code: "", description: "" });
  const [resourceForm, setResourceForm] = useState({ title: "", url: "", subject: "" });
  const [eventForm, setEventForm] = useState({ title: "", description: "", eventDate: "" });
  const [studyForm, setStudyForm] = useState({ name: "", topic: "" });
  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    departmentName: "",
    pocUserId: ""
  });
  const [joinRequestMessage, setJoinRequestMessage] = useState("");
  const [mentorForm, setMentorForm] = useState({
    topic: "",
    mentor: "",
    mode: "Online" as "Online" | "Offline",
    slot: "",
    note: ""
  });
  const [mentorSessions, setMentorSessions] = useState<MentorSession[]>(() => {
    try {
      const stored = localStorage.getItem("quad_mentor_sessions");
      if (stored) return JSON.parse(stored) as MentorSession[];
    } catch {
      // no-op fallback
    }
    return [];
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [reputationScore, setReputationScore] = useState<number>(() => {
    const stored = localStorage.getItem("quad_reputation_score");
    return stored ? Number(stored) : 120;
  });
  const [streakDays, setStreakDays] = useState<number>(() => {
    const stored = localStorage.getItem("quad_streak_days");
    return stored ? Number(stored) : 1;
  });
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>(() => {
    try {
      const stored = localStorage.getItem("quad_activity_entries");
      if (stored) return JSON.parse(stored) as ActivityEntry[];
    } catch {
      // no-op fallback
    }
    return [];
  });
  const [favoriteTabs, setFavoriteTabs] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("quad_favorite_tabs");
      if (stored) return JSON.parse(stored) as string[];
    } catch {
      // no-op fallback
    }
    return ["Campus Wall", "Batch Room", "Opportunities"];
  });

  const isVerified = user?.verificationStatus === "VERIFIED" || user?.role === "ADMIN";
  const roleCanPublish = useMemo(() => {
    if (!user) return false;
    if (!isVerified) return false;
    if (tab === "Campus Groups") return user.role === "ADMIN";
    if (tab === "Opportunities") return user.role === "ADMIN" || user.role === "RECRUITER";
    if (tab === "Student Perks") return user.role === "ADMIN" || user.role === "BRAND";
    return true;
  }, [user, tab, isVerified]);
  const orderedTabs = useMemo(() => {
    const favorites = tabConfig.filter((item) => favoriteTabs.includes(item.tab));
    const rest = tabConfig.filter((item) => !favoriteTabs.includes(item.tab));
    return [...favorites, ...rest];
  }, [favoriteTabs]);

  const tabPath = useMemo(() => {
    switch (tab) {
      case "Campus Wall":
        return "posts";
      case "Batch Room":
        return "batch/messages";
      case "Campus Bazaar":
        return "marketplace";
      case "Opportunities":
        return "opportunities";
      case "Student Perks":
        return "deals";
      case "Resources":
        return "resources";
      case "Events":
        return "events";
      case "Study Rooms":
        return "study-rooms";
      case "Campus Groups":
        return "groups";
      case "Mentorship Hub":
        return "";
    }
  }, [tab]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter((item) => {
      const text = [item.title, item.content, item.description, item.message, item.brand, item.company, item.name, item.topic]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [items, search]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return groupItems;
    const q = search.toLowerCase();
    return groupItems.filter((group) => {
      return [group.name, group.description, group.departmentName ?? "", group.poc?.name ?? "", group.owner.name]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [groupItems, search]);

  async function api<T>(path: string, method: "GET" | "POST" | "PATCH" = "GET", body?: unknown): Promise<T> {
    window.dispatchEvent(new Event("quad:loading:start"));
    try {
      const response = await fetch(`${API_URL}/${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
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

  async function loadMe() {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const me = await api<User>("me");
      setUser(me);
      setError("");
    } catch {
      localStorage.removeItem("quad_token");
      setToken("");
      navigate("/login");
    }
  }

  async function loadTabData() {
    if (!token) return;
    setLoading(true);

    try {
      if (tab === "Mentorship Hub") {
        setItems([]);
      } else if (tab === "Campus Groups") {
        const groups = await api<CampusGroup[]>(tabPath);
        setGroupItems(groups);
      } else {
        const data = await api<SimpleEntity[]>(tabPath);
        setItems(data);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingUsers() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      const rows = await api<User[]>("users/pending");
      setPendingUsers(rows);
    } catch {
      setPendingUsers([]);
    }
  }

  async function loadPocCandidates() {
    if (!token || user?.role !== "ADMIN") return;
    try {
      const rows = await api<PocCandidate[]>("users/verified");
      setPocCandidates(rows);
      if (!groupForm.pocUserId && rows.length > 0) {
        setGroupForm((current) => ({ ...current, pocUserId: rows[0].id }));
      }
    } catch {
      setPocCandidates([]);
    }
  }

  async function loadIncomingGroupRequests() {
    if (!token) return;
    try {
      const rows = await api<GroupJoinRequest[]>("groups/requests/incoming");
      setIncomingRequests(rows);
    } catch {
      setIncomingRequests([]);
    }
  }

  async function loadMentorSessions() {
    if (!token) return;
    try {
      const rows = await api<MentorSession[]>("mentorship/sessions");
      setMentorSessions(rows);
    } catch {
      setMentorSessions([]);
    }
  }

  async function loadNotifications() {
    if (!token) return;
    try {
      const rows = await api<NotificationItem[]>("notifications");
      setNotifications(rows);
    } catch {
      setNotifications([]);
    }
  }

  async function loadEngagement() {
    if (!token) return;
    try {
      await api("engagement/pulse", "POST");
      const engagement = await api<{ reputationScore: number; streakDays: number }>("engagement/me");
      setReputationScore(engagement.reputationScore);
      setStreakDays(engagement.streakDays);
    } catch {
      // fallback to existing local values
    }
  }

  useEffect(() => {
    loadMe();
  }, [token]);

  useEffect(() => {
    loadTabData();
  }, [tabPath, token]);

  useEffect(() => {
    loadPendingUsers();
    loadPocCandidates();
    loadIncomingGroupRequests();
    loadMentorSessions();
    loadNotifications();
    loadEngagement();
  }, [user?.role, token]);

  useEffect(() => {
    if (!token || tab !== "Batch Room") return;

    const s = io(getSocketConnectUrl(), { auth: { token } });
    s.on("batch:message", (msg: SimpleEntity) => {
      setItems((current) => [...current, msg]);
    });

    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [tab, token]);

  useEffect(() => {
    localStorage.setItem("quad_activity_entries", JSON.stringify(activityEntries));
  }, [activityEntries]);

  useEffect(() => {
    localStorage.setItem("quad_favorite_tabs", JSON.stringify(favoriteTabs));
  }, [favoriteTabs]);

  useEffect(() => {
    localStorage.setItem("quad_mentor_sessions", JSON.stringify(mentorSessions));
  }, [mentorSessions]);

  useEffect(() => {
    localStorage.setItem("quad_reputation_score", String(reputationScore));
  }, [reputationScore]);

  useEffect(() => {
    localStorage.setItem("quad_streak_days", String(streakDays));
  }, [streakDays]);

  function logout() {
    localStorage.removeItem("quad_token");
    setToken("");
    navigate("/login");
  }

  async function addNotification(title: string, body: string) {
    try {
      await api("notifications", "POST", { title, body });
      await loadNotifications();
    } catch {
      // ignore notification errors
    }
  }

  async function markNotificationRead(id: string) {
    try {
      await api(`notifications/${id}/read`, "PATCH");
    } catch {
      // ignore
    } finally {
      await loadNotifications();
    }
  }

  function logActivity(text: string) {
    const next: ActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text,
      time: dayjs().format("DD MMM, HH:mm")
    };
    setActivityEntries((current) => [next, ...current].slice(0, 8));
    setReputationScore((score) => score + 5);
  }

  function toggleFavoriteTab(tabName: string) {
    setFavoriteTabs((current) => {
      if (current.includes(tabName)) return current.filter((item) => item !== tabName);
      return [...current, tabName].slice(0, 5);
    });
  }

  function applyTemplateForCurrentTab() {
    if (tab === "Campus Wall") {
      setPostContent("Sharing this week campus momentum: events, opportunities, and help needed for incoming projects.");
    } else if (tab === "Batch Room") {
      setBatchMessage("Quick sync at 5 PM near library wing. Drop your current blockers and needed resources.");
    } else if (tab === "Campus Bazaar") {
      setMarketForm({
        title: "Like-new scientific calculator",
        description: "Excellent condition with pouch and charger. Available for same-day handover.",
        price: "1500"
      });
    } else if (tab === "Opportunities") {
      setOpportunityForm({
        title: "Campus Ambassador",
        company: "GrowthPilot Labs",
        description: "Drive chapter growth, host mini events, and get performance-based stipend."
      });
    } else if (tab === "Student Perks") {
      setDealForm({
        brand: "SkillSprint",
        title: "50% on premium prep pack",
        code: "QUAD50",
        description: "Applies to interview prep, roadmap plans, and mock assessments."
      });
    } else if (tab === "Resources") {
      setResourceForm({
        title: "ECE Interview Sheet",
        url: "https://example.com/resource",
        subject: "Interview Prep"
      });
    } else if (tab === "Events") {
      setEventForm({
        title: "Career Sprint Meetup",
        description: "Alumni talk, rapid networking, and internship AMA.",
        eventDate: dayjs().add(2, "day").hour(16).minute(0).format("YYYY-MM-DDTHH:mm")
      });
    } else if (tab === "Study Rooms") {
      setStudyForm({ name: "Signal Processing Sprint", topic: "Revision and doubt clearing" });
    } else if (tab === "Mentorship Hub") {
      setMentorForm({
        topic: "Resume and internship strategy",
        mentor: "Alumni Product Engineer",
        mode: "Online",
        slot: dayjs().add(3, "day").hour(18).minute(0).format("YYYY-MM-DDTHH:mm"),
        note: "Need guidance on projects, profile positioning, and shortlist strategy."
      });
    }
    logActivity(`Applied smart template in ${tab}`);
    void addNotification("Template applied", `Quick starter content injected for ${tab}.`);
  }

  async function approveUser(userId: string) {
    try {
      await api(`verification/approve/${userId}`, "POST");
      await loadPendingUsers();
      setNotice("User approved.");
      logActivity("Approved one pending student verification");
      void addNotification("Verification approved", "A pending student account has been approved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function approveGroupRequest(requestId: string) {
    try {
      await api(`groups/requests/${requestId}/approve`, "POST");
      await Promise.all([loadIncomingGroupRequests(), loadTabData()]);
      setNotice("Group request approved.");
      logActivity("Approved a group join request");
      void addNotification("Group request approved", "A learner was added to a campus group.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function rejectGroupRequest(requestId: string) {
    try {
      await api(`groups/requests/${requestId}/reject`, "POST");
      await loadIncomingGroupRequests();
      setNotice("Group request rejected.");
      logActivity("Rejected a group join request");
      void addNotification("Group request rejected", "One join request has been declined.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function requestToJoinGroup(groupId: string) {
    try {
      await api(`groups/${groupId}/requests`, "POST", { message: joinRequestMessage.trim() || undefined });
      await loadTabData();
      setJoinRequestMessage("");
      setNotice("Join request sent to the group POC.");
      logActivity("Submitted join request for a campus group");
      void addNotification("Join request sent", "Your request has been routed to group owner/POC.");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function postCurrent(event: FormEvent) {
    event.preventDefault();
    try {
      if (tab === "Campus Wall") {
        await api("posts", "POST", { content: postContent, visibility: "COLLEGE" });
        setPostContent("");
      } else if (tab === "Batch Room") {
        await api("batch/messages", "POST", { message: batchMessage });
        setBatchMessage("");
      } else if (tab === "Campus Bazaar") {
        await api("marketplace", "POST", {
          title: marketForm.title,
          description: marketForm.description,
          price: Number(marketForm.price),
          category: "OTHER"
        });
        setMarketForm({ title: "", description: "", price: "" });
      } else if (tab === "Opportunities") {
        await api("opportunities", "POST", opportunityForm);
        setOpportunityForm({ title: "", company: "", description: "" });
      } else if (tab === "Student Perks") {
        await api("deals", "POST", dealForm);
        setDealForm({ brand: "", title: "", code: "", description: "" });
      } else if (tab === "Resources") {
        await api("resources", "POST", resourceForm);
        setResourceForm({ title: "", url: "", subject: "" });
      } else if (tab === "Events") {
        const isoDate = eventForm.eventDate ? new Date(eventForm.eventDate).toISOString() : new Date().toISOString();
        await api("events", "POST", { ...eventForm, eventDate: isoDate });
        setEventForm({ title: "", description: "", eventDate: "" });
      } else if (tab === "Study Rooms") {
        await api("study-rooms", "POST", studyForm);
        setStudyForm({ name: "", topic: "" });
      } else if (tab === "Campus Groups") {
        await api("groups", "POST", {
          name: groupForm.name,
          description: groupForm.description,
          departmentName: groupForm.departmentName.trim() || undefined,
          pocUserId: groupForm.pocUserId
        });
        setGroupForm({ name: "", description: "", departmentName: "", pocUserId: groupForm.pocUserId });
      } else if (tab === "Mentorship Hub") {
        const slot = mentorForm.slot
          ? new Date(mentorForm.slot).toISOString()
          : dayjs().add(1, "day").hour(17).minute(0).toISOString();
        await api("mentorship/sessions", "POST", {
          topic: mentorForm.topic,
          mentor: mentorForm.mentor,
          mode: mentorForm.mode,
          slot,
          note: mentorForm.note
        });
        await loadMentorSessions();
        setMentorForm({ topic: "", mentor: "", mode: "Online", slot: "", note: "" });
      }

      await loadTabData();
      setNotice(`${tab} updated.`);
      logActivity(`Published new content in ${tab}`);
      void addNotification("Content published", `New update pushed to ${tab}.`);
      hapticSuccess();
    } catch (e) {
      setError((e as Error).message);
      hapticError();
    }
  }

  // Micro-interaction: animate tab switch
  function handleTabSwitch(newTab: Tab) {
    setTab(newTab);
    hapticTap();
    window.dispatchEvent(new Event("quad:loading:start"));
    setTimeout(() => {
      window.dispatchEvent(new Event("quad:loading:stop"));
    }, 320); // Fast feedback
  }

  return (
    <main className="dashboard-page dashboard-app-shell q-cockpit">
      <aside className="sidebar glass">
        <div className="sidebar-header">
          <span className="eyebrow">QUAD</span>
          <h2>Modules</h2>
        </div>
        <nav className="sidebar-nav dash-module-nav" aria-label="Primary modules">
          {orderedTabs.map(({ tab: t, icon }) => {
            const isActive = tab === t;
            return (
              <div key={t as string} className={`sidebar-tab-row${isActive ? " is-active" : ""}`}>
                <motion.button
                  type="button"
                  className={`sidebar-tab${isActive ? " active" : ""}`}
                  onClick={() => handleTabSwitch(t)}
                  aria-current={isActive ? "true" : undefined}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  whileHover={reduceMotion ? undefined : { scale: isActive ? 1 : 1.014 }}
                  transition={{ type: "spring", stiffness: 400, damping: 26 }}
                >
                  <span className="sidebar-tab-pip" aria-hidden />
                  {icon}
                  <span className="sidebar-tab-label">{t}</span>
                </motion.button>
                <motion.button
                  className={favoriteTabs.includes(t) ? "tab-pin active" : "tab-pin"}
                  type="button"
                  onClick={() => {
                    hapticTap();
                    toggleFavoriteTab(t);
                  }}
                  title="Pin tab"
                  whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                >
                  <Star size={12} />
                </motion.button>
              </div>
            );
          })}
        </nav>
        <AdSlot
          id="dashboard-sidebar-sticky"
          format="sidebar"
          title="Campus partners"
          description="Sponsored placement beside navigation."
          cta="Inquire"
        />
      </aside>

      <div className="dash-main-column">
        <div className="dash-top glass">
          <p className="dash-mission">
            <span className="dash-mission-pill">Free for your seat</span>
            <span className="subtle">Partner placements and hiring orgs back the product — you are not the fee.</span>
          </p>
          <header className="dash-header">
            <div>
              <p className="caps">Command</p>
              <h1>{user?.college?.name ?? "Campus"}</h1>
              <p className="subtle">{user?.department?.name} | {user?.batch?.name} | {dayjs().format("DD MMM, HH:mm")}</p>
            </div>
            <div className="dash-actions">
              {user?.role === "ADMIN" ? <Link className="btn btn-ghost" to="/owner">Owner Console</Link> : null}
              <button className="btn btn-ghost" type="button" onClick={logout}><LogOut size={14} /> Logout</button>
              <Link className="btn btn-ghost" to="/">Home</Link>
            </div>
          </header>
          <div className="dash-metrics-row">
            <div className="dash-metric inline">
              <Flame size={16} />
              <span>Streak</span>
              <strong>{streakDays}d</strong>
            </div>
            <div className="dash-metric inline">
              <Trophy size={16} />
              <span>Rep</span>
              <strong>{reputationScore}</strong>
            </div>
            <div className="dash-metric inline">
              <BellRing size={16} />
              <span>Unread</span>
              <strong>{notifications.filter((item) => !item.read).length}</strong>
            </div>
          </div>
        </div>

        <div className="dash-workspace">
          <div className="dash-steady-frame glass">
            <div className="dash-frame-chrome">
              <motion.h2
                key={tab}
                className="dash-active-module"
                initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.2, 0.85, 0.2, 1] }}
              >
                {tab}
              </motion.h2>
              <p className="subtle dash-frame-hint">Scroll inside this panel to see posts, requests, and activity — the page around it stays put.</p>
            </div>

            {!isVerified ? <p className="warning dash-frame-warn">Read-only until an admin approves your verification.</p> : null}

            <form className="composer dash-composer" onSubmit={postCurrent}>
            <div className="composer-head">
              <p className="caps">New</p>
              <div className="search-wrap"><Search size={14} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter this feed" /></div>
            </div>

            {tab === "Campus Wall" ? <textarea value={postContent} onChange={(e) => setPostContent(e.target.value)} placeholder="Post update" /> : null}
            {tab === "Batch Room" ? <textarea value={batchMessage} onChange={(e) => setBatchMessage(e.target.value)} placeholder="Message your batch" /> : null}
            {tab === "Campus Bazaar" ? <><input value={marketForm.title} onChange={(e) => setMarketForm({ ...marketForm, title: e.target.value })} placeholder="Item title" /><textarea value={marketForm.description} onChange={(e) => setMarketForm({ ...marketForm, description: e.target.value })} placeholder="Description" /><input value={marketForm.price} onChange={(e) => setMarketForm({ ...marketForm, price: e.target.value })} type="number" placeholder="Price" /></> : null}
            {tab === "Opportunities" ? <><input value={opportunityForm.title} onChange={(e) => setOpportunityForm({ ...opportunityForm, title: e.target.value })} placeholder="Role title" /><input value={opportunityForm.company} onChange={(e) => setOpportunityForm({ ...opportunityForm, company: e.target.value })} placeholder="Company" /><textarea value={opportunityForm.description} onChange={(e) => setOpportunityForm({ ...opportunityForm, description: e.target.value })} placeholder="Description" /></> : null}
            {tab === "Student Perks" ? <><input value={dealForm.brand} onChange={(e) => setDealForm({ ...dealForm, brand: e.target.value })} placeholder="Brand" /><input value={dealForm.title} onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })} placeholder="Offer title" /><input value={dealForm.code} onChange={(e) => setDealForm({ ...dealForm, code: e.target.value })} placeholder="Coupon code" /><textarea value={dealForm.description} onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })} placeholder="Offer details" /></> : null}
            {tab === "Resources" ? <><input value={resourceForm.title} onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })} placeholder="Resource title" /><input value={resourceForm.url} onChange={(e) => setResourceForm({ ...resourceForm, url: e.target.value })} placeholder="Public URL" /><input value={resourceForm.subject} onChange={(e) => setResourceForm({ ...resourceForm, subject: e.target.value })} placeholder="Subject" /></> : null}
            {tab === "Events" ? <><input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Event title" /><textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Event details" /><input value={eventForm.eventDate} onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })} type="datetime-local" /></> : null}
            {tab === "Study Rooms" ? <><input value={studyForm.name} onChange={(e) => setStudyForm({ ...studyForm, name: e.target.value })} placeholder="Room name" /><input value={studyForm.topic} onChange={(e) => setStudyForm({ ...studyForm, topic: e.target.value })} placeholder="Topic" /></> : null}
            {tab === "Mentorship Hub" ? (
              <>
                <input value={mentorForm.topic} onChange={(e) => setMentorForm({ ...mentorForm, topic: e.target.value })} placeholder="Mentorship topic" />
                <input value={mentorForm.mentor} onChange={(e) => setMentorForm({ ...mentorForm, mentor: e.target.value })} placeholder="Preferred mentor / alumni profile" />
                <div className="grid-2">
                  <select value={mentorForm.mode} onChange={(e) => setMentorForm({ ...mentorForm, mode: e.target.value as "Online" | "Offline" })}>
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                  </select>
                  <input type="datetime-local" value={mentorForm.slot} onChange={(e) => setMentorForm({ ...mentorForm, slot: e.target.value })} />
                </div>
                <textarea value={mentorForm.note} onChange={(e) => setMentorForm({ ...mentorForm, note: e.target.value })} placeholder="Context, goals, and expected outcomes" />
              </>
            ) : null}
            {tab === "Campus Groups" && user?.role === "ADMIN" ? (
              <>
                <input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} placeholder="Group name" required />
                <textarea value={groupForm.description} onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })} placeholder="Group purpose and access rules" required />
                <input value={groupForm.departmentName} onChange={(e) => setGroupForm({ ...groupForm, departmentName: e.target.value })} placeholder="Department (optional)" />
                <select value={groupForm.pocUserId} onChange={(e) => setGroupForm({ ...groupForm, pocUserId: e.target.value })} required>
                  <option value="">Select POC user</option>
                  {pocCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} ({candidate.department?.name ?? "No department"})
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            {tab === "Campus Groups" && user?.role !== "ADMIN" ? (
              <p className="subtle">Campus owner creates groups. You can request to join any listed group below.</p>
            ) : null}

            {!roleCanPublish ? (
              <p className="subtle">
                Publishing in this module is restricted for your role. You can still browse and engage with content here.
              </p>
            ) : null}
            <div className="composer-actions">
              <button className="btn btn-ghost" type="button" onClick={applyTemplateForCurrentTab}>
                <Sparkles size={14} /> Autofill
              </button>
              <button className="btn btn-primary" type="submit" disabled={!roleCanPublish}>Publish</button>
            </div>
            </form>

          <div className="dash-frame-scroll">
            {user?.role === "ADMIN" && pendingUsers.length > 0 ? (
              <section className="admin-inline glass">
                <h3>Pending verification ({pendingUsers.length})</h3>
                {pendingUsers.map((u) => (
                  <div key={u.id} className="pending-row">
                    <div>
                      <strong>{u.name}</strong>
                      <p className="subtle">{u.email}</p>
                    </div>
                    <button className="btn btn-primary" type="button" onClick={() => approveUser(u.id)}>Approve</button>
                  </div>
                ))}
              </section>
            ) : null}

            <section className="feed dash-feed">
            {loading ? <p className="subtle">Loading…</p> : null}

            {tab !== "Campus Groups" && tab !== "Mentorship Hub" ? (
              <>
                {filteredItems.length === 0 ? <p className="subtle">No entries yet.</p> : null}
                <AnimatePresence>
                  {filteredItems.map((item) => (
                    <motion.article key={item.id} className="feed-item" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      <h3>{item.title ?? item.name ?? item.brand ?? item.company ?? "Entry"}</h3>
                      <p>{item.content ?? item.message ?? item.description ?? item.topic ?? ""}</p>
                      {item.code ? <p className="meta">Code: {item.code}</p> : null}
                      {item.createdAt ? <p className="meta">{dayjs(item.createdAt).format("DD MMM YYYY, HH:mm")}</p> : null}
                    </motion.article>
                  ))}
                </AnimatePresence>
                <AdSlot
                  id="dashboard-feed-inline"
                  format="inline"
                  title="Partner offer lane"
                  description="Brands and hiring teams meet students in-context. Your seat stays free; partners back the field."
                  cta="For partners"
                  mode="brand"
                />
              </>
            ) : tab === "Campus Groups" ? (
              <>
                <div className="group-request-row">
                  <input
                    value={joinRequestMessage}
                    onChange={(e) => setJoinRequestMessage(e.target.value)}
                    placeholder="Optional join note to group POC"
                  />
                </div>

                {filteredGroups.length === 0 ? <p className="subtle">No groups found for this search.</p> : null}
                {filteredGroups.map((group) => {
                  const statusClass = group.myRequestStatus ? `status-chip ${group.myRequestStatus.toLowerCase()}` : "status-chip";
                  const canRequest = isVerified && !group.isMember && group.myRequestStatus !== "PENDING";

                  return (
                    <article key={group.id} className="feed-item group-card">
                      <div className="group-head">
                        <h3>{group.name}</h3>
                        <span className={statusClass}>{group.isMember ? "MEMBER" : group.myRequestStatus ?? "OPEN"}</span>
                      </div>
                      <p>{group.description}</p>
                      <p className="meta">Department: {group.departmentName ?? "Campus-wide"}</p>
                      <p className="meta">POC: {group.poc?.name ?? "Unassigned"} | Owner: {group.owner.name} | Members: {group.memberCount}</p>
                      {canRequest ? (
                        <button className="btn btn-primary" type="button" onClick={() => requestToJoinGroup(group.id)}>
                          Request to Join
                        </button>
                      ) : null}
                    </article>
                  );
                })}

                {incomingRequests.length > 0 ? (
                  <div className="group-incoming">
                    <h3>Incoming Join Requests (Owner / POC)</h3>
                    {incomingRequests.map((request) => (
                      <article key={request.id} className="feed-item">
                        <h3>{request.requester.name}{" -> "}{request.group.name}</h3>
                        <p>{request.message || "No message provided"}</p>
                        <p className="meta">{dayjs(request.createdAt).format("DD MMM YYYY, HH:mm")}</p>
                        <div className="group-actions">
                          <button className="btn btn-primary" type="button" onClick={() => approveGroupRequest(request.id)}>Approve</button>
                          <button className="btn btn-ghost" type="button" onClick={() => rejectGroupRequest(request.id)}>Reject</button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                {mentorSessions.length === 0 ? <p className="subtle">No mentorship sessions planned yet.</p> : null}
                {mentorSessions.map((session) => (
                  <article key={session.id} className="feed-item mentorship-card">
                    <div className="mentorship-head">
                      <h3>{session.topic}</h3>
                      <span className="status-chip member">{session.mode}</span>
                    </div>
                    <p>{session.note}</p>
                    <p className="meta">Mentor: {session.mentor}</p>
                    <p className="meta">Session: {dayjs(session.slot).format("DD MMM YYYY, HH:mm")}</p>
                    <p className="meta">Created: {dayjs(session.createdAt).format("DD MMM YYYY, HH:mm")}</p>
                  </article>
                ))}
              </>
            )}
            </section>
          </div>
          {notice ? <p className="notice dash-inline-toast">{notice}</p> : null}
          {error ? <p className="error dash-inline-toast">{error}</p> : null}
          {socket && tab === "Batch Room" ? <p className="notice dash-inline-toast">Realtime: batch chat is live.</p> : null}
        </div>

        <aside className="dash-rail glass" aria-label="Notifications">
          <h3>Alerts</h3>
          {notifications.length === 0 ? <p className="subtle">No notifications yet.</p> : null}
          {notifications.map((item) => (
            <article key={item.id} className={item.read ? "activity-row" : "activity-row unread"}>
              <div>
                <p><strong>{item.title}</strong></p>
                <p className="subtle">{item.body}</p>
              </div>
              <div className="notif-meta">
                <span>{dayjs(item.createdAt).format("DD MMM, HH:mm")}</span>
                {!item.read ? (
                  <button className="btn btn-ghost" type="button" onClick={() => markNotificationRead(item.id)}>
                    Mark read
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </aside>
        </div>
      </div>

    </main>
  );
}

export default DashboardPage;
type Tab =
  | "Campus Wall"
  | "Batch Room"
  | "Campus Bazaar"
  | "Opportunities"
  | "Student Perks"
  | "Resources"
  | "Events"
  | "Study Rooms"
  | "Campus Groups"
  | "Mentorship Hub";
