import { motion, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useRef, useState } from "react";
import { getSpatialFrame, subscribeSpatialFrame } from "../spatial/spatialFrame";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Cpu,
  Gem,
  HeartHandshake,
  Layers,
  MessageSquare,
  Orbit,
  Radio,
  ShieldCheck,
  Sparkles,
  Store,
  UserCheck,
  Zap
} from "lucide-react";
import { Link } from "react-router-dom";
import AdSlot from "../components/AdSlot";
import { hapticTap } from "../utils/haptics";

const chapters = [
  {
    id: "verify",
    label: "Step 1 · Verification",
    title: "Verified before you get loud",
    copy:
      "Admins clear real students. Until then you can explore in read-only mode. Once you are verified, every module unlocks for your campus — with zero subscription on your side.",
    icon: <ShieldCheck size={20} />,
    preview: "verify" as const
  },
  {
    id: "scope",
    label: "Step 2 · Your campus & batch",
    title: "Boundaries that feel like real life",
    copy:
      "The wall, the batch room, and resources are scoped to your program. The internet is still out there; QUAD is the calm layer for your people.",
    icon: <Layers size={20} />,
    preview: "scope" as const
  },
  {
    id: "modules",
    label: "Step 3 · One canvas",
    title: "Every channel. One command surface",
    copy:
      "Post, message in real time, trade in the bazaar, chase roles, and pull perks from brands — in one steady, glass-tight web shell. We never charge you for the seat.",
    icon: <Cpu size={20} />,
    preview: "modules" as const
  },
  {
    id: "groups",
    label: "Step 4 · Groups & control",
    title: "Groups, POCs, and a serious owner view",
    copy:
      "Request into official groups, route approvals through a POC, and let campus owners operate from a real console. Hiring teams and brand partners can meet you where you already are.",
    icon: <UserCheck size={20} />,
    preview: "groups" as const
  }
];

const heroSignals = [
  { kbd: "01", text: "Pointer-linked viewport — the shell responds as you look around the page." },
  { kbd: "02", text: "One steady frame: routes swap in place, nothing jumps to a new document scroll." },
  { kbd: "03", text: "Glass UI over live depth — same language from landing to command deck." },
  { kbd: "04", text: "Read-only until verified; admin clears real students, not anonymous noise." }
];

function WebPreview({ activeId }: { activeId: string }) {
  return (
    <div className="lp-web-preview glass-pro" aria-hidden>
      <div className="lp-web-chrome">
        <span className="lp-web-dot" />
        <span className="lp-web-dot" />
        <span className="lp-web-dot" />
        <span className="lp-web-url">app.quad.in / app</span>
      </div>
      <div className="lp-web-surface">
        {activeId === "verify" && (
          <div className="lp-mock-block">
            <p className="lp-mock-title">Verification</p>
            <div className="lp-mock-pill warn">Pending</div>
            <p className="lp-mock-sub">Admin clears your campus account.</p>
            <div className="lp-mock-bar" style={{ width: "55%" }} />
          </div>
        )}
        {activeId === "scope" && (
          <div className="lp-mock-block">
            <p className="lp-mock-title">Your layer</p>
            <ul className="lp-mock-list">
              <li>College: set at signup</li>
              <li>Program + batch scoped</li>
            </ul>
            <div className="lp-mock-icons">
              <MessageSquare size={16} />
              <span>Batch room · live</span>
            </div>
          </div>
        )}
        {activeId === "modules" && (
          <div className="lp-mock-grid">
            <div className="lp-mock-tile"><MegaphoneIcon /><span>Wall</span></div>
            <div className="lp-mock-tile"><MessageSquare size={16} /><span>Batch</span></div>
            <div className="lp-mock-tile"><Store size={16} /><span>Bazaar</span></div>
            <div className="lp-mock-tile"><Briefcase size={16} /><span>Roles</span></div>
            <div className="lp-mock-tile"><BookOpen size={16} /><span>Learn</span></div>
            <div className="lp-mock-tile"><Bell size={16} /><span>Events</span></div>
          </div>
        )}
        {activeId === "groups" && (
          <div className="lp-mock-block">
            <p className="lp-mock-title">Groups</p>
            <div className="lp-mock-row">
              <span>Design club</span>
              <span className="lp-mock-pill ok">Sent</span>
            </div>
            <div className="lp-mock-row">
              <span>Placements</span>
              <span className="lp-mock-pill ok">Member</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MegaphoneIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 11v2a1 1 0 0 0 1 1h1l3 5h2l-1-5h4l2 5h2l-1.5-5H21" />
    </svg>
  );
}

function HeroOrbit() {
  const reduce = useReducedMotion();
  const orbitRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (reduce) return;
    const el = orbitRef.current;
    if (!el) return;
    const apply = () => {
      const { rx, ry } = getSpatialFrame();
      el.style.transform = `perspective(1400px) rotateX(${-ry * 5}deg) rotateY(${rx * 6}deg) translateZ(0)`;
      el.style.transformStyle = "preserve-3d";
    };
    const unsub = subscribeSpatialFrame(apply);
    apply();
    return unsub;
  }, [reduce]);

  return (
    <div ref={orbitRef} className="lp-hero-orbit" style={reduce ? undefined : { transformStyle: "preserve-3d" }} aria-hidden>
      <div className="lp-hero-orbit-glow" />
      <motion.div
        className="lp-hero-orbit-ring"
        style={{ width: 280, height: 280, opacity: 0.4 }}
        animate={reduce ? undefined : { rotate: [0, 360] }}
        transition={{ duration: 150, repeat: Infinity, ease: "linear" }}
      />
      <motion.div
        className="lp-hero-orbit-ring"
        style={{ width: 220, height: 220, opacity: 0.7 }}
        animate={reduce ? undefined : { rotate: [0, -360] }}
        transition={{ duration: 110, repeat: Infinity, ease: "linear" }}
      />
      <div className="lp-hero-orbit-core">Q</div>
    </div>
  );
}

function LandingPage() {
  const [activeId, setActiveId] = useState(chapters[0]!.id);
  const reduceLanding = useReducedMotion();

  return (
    <motion.main
      className="landing-page"
      initial={reduceLanding ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 34, mass: 0.72 } }}
    >
      <header className="lp-topbar glass-pro fade-section">
        <div className="brand">
          <span className="quad-wordmark">QUAD</span>
          <span className="brand-strap">Spatial campus OS</span>
        </div>
        <div className="lp-mission lp-mission--header" aria-label="Revenue model">
          <span className="lp-top-pill">$0 for students</span>
          <span>Partners &amp; hiring orgs fund the rails</span>
        </div>
        <nav className="lp-topbar-nav" aria-label="Account">
          <Link to="/login" className="btn btn-ghost" onMouseDown={hapticTap}>
            Log in
          </Link>
          <Link to="/register" className="btn btn-primary" onMouseDown={hapticTap}>
            Get started
          </Link>
        </nav>
      </header>

      <section className="lp-hero glass-pro lp-hero--split lp-hero--nexus">
        <div className="lp-hero-copy">
          <p className="caps">Campus network · spatial web shell</p>
          <h1 className="lp-hero-title">A verified field for your class — not another infinite feed.</h1>
          <p className="lp-hero-sub">
            No student fees, ever. One glass command surface for your wall, batch, roles, and groups, while partners who
            hire from you fund the product — you are never the paywall.
          </p>
          <div className="lp-mission" style={{ marginTop: "0.85rem" }}>
            <span className="subtle" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <Building2 size={16} style={{ color: "var(--primary)" }} />
              B2B placements &amp; brand stories
            </span>
            <span className="subtle" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
              <HeartHandshake size={16} style={{ color: "var(--accent)" }} />
              You bring the people — we build the room
            </span>
          </div>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary" onMouseDown={hapticTap}>
              Start free <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="btn btn-ghost" onMouseDown={hapticTap}>
              I already have access
            </Link>
          </div>
          <div className="lp-hero-bento" aria-label="What ships today">
            <div className="lp-bento-stat">
              <strong>1</strong>
              <span>Steady frame for every route</span>
            </div>
            <div className="lp-bento-stat">
              <strong>10+</strong>
              <span>Modules in one command deck</span>
            </div>
            <div className="lp-bento-stat">
              <strong>0</strong>
              <span>Cost to the student seat</span>
            </div>
          </div>
        </div>
        <HeroOrbit />
      </section>

      <AdSlot
        id="landing-hero-lane"
        format="banner"
        title="For teams who hire from this generation"
        description="Sponsor a lane, support verified campus work, and connect with the programs you care about. Students are never the product you pay to reach."
        cta="Contact partnerships"
        mode="partner"
      />

      <section className="lp-signal-strip fade-section" aria-label="Interface contract">
        {heroSignals.map((row) => (
          <div key={row.kbd} className="lp-signal glass">
            <kbd>{row.kbd}</kbd>
            <p>{row.text}</p>
          </div>
        ))}
      </section>

      <section className="lp-manifest fade-section">
        <article className="lp-manifest-card glass-pro">
          <div className="lp-manifest-glow" aria-hidden />
          <Zap size={22} className="lp-badge-icon" style={{ color: "var(--accent)" }} />
          <h3>Interaction-first: the UI moves with you</h3>
          <p className="subtle" style={{ margin: 0, maxWidth: "34ch" }}>
            Parallax depth, cross-faded routes, and a 3D nexus field sit behind the glass so the product feels like a
            place — not a document.
          </p>
        </article>
        <article className="lp-manifest-card glass-pro">
          <div className="lp-manifest-glow" aria-hidden />
          <Orbit size={22} className="lp-badge-icon" style={{ color: "var(--primary)" }} />
          <h3>Same shell from marketing to mission control</h3>
          <p className="subtle" style={{ margin: 0, maxWidth: "34ch" }}>
            Login, register, and the campus deck share one viewport contract: inner scroll, outer frame, no jarring
            full-page whiplash.
          </p>
        </article>
      </section>

      <section className="lp-badges fade-section">
        <motion.article
          className="glass-pro"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5 }}
          whileHover={{ y: -4 }}
        >
          <ShieldCheck size={20} className="lp-badge-icon" />
          <h3>Trust, first</h3>
          <p>Admins verify. You do not get lost in a global firehose.</p>
        </motion.article>
        <motion.article
          className="glass-pro"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          whileHover={{ y: -4 }}
        >
          <Layers size={20} className="lp-badge-icon" />
          <h3>Scoped like campus</h3>
          <p>College, program, and batch stay honest to how you actually work.</p>
        </motion.article>
        <motion.article
          className="glass-pro"
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -4 }}
        >
          <Gem size={20} className="lp-badge-icon" />
          <h3>Free to learn</h3>
          <p>Revenue is partner-side: placements, brand, and the teams who hire you.</p>
        </motion.article>
      </section>

      <section className="lp-journey-intro glass-pro fade-section">
        <p className="caps" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Radio size={14} aria-hidden />
          Live product tour
        </p>
        <h2>Scroll the chapters — the preview tracks what you are reading</h2>
        <p className="subtle">
          The mini shell at left syncs to your position. Every story maps to a real module: same glass language, same
          data contract, partners on the outside rails.
        </p>
      </section>

      <div className="lp-journey">
        <aside className="lp-journey-sticky" aria-hidden>
          <p className="caps">Live module preview</p>
          <WebPreview activeId={activeId} />
          <ol className="lp-journey-dots">
            {chapters.map((c) => (
              <li key={c.id} className={c.id === activeId ? "active" : ""}>
                {c.label.split("·")[0]?.trim()}
              </li>
            ))}
          </ol>
        </aside>

        <div className="lp-journey-chapters">
          {chapters.map((chapter, i) => (
            <motion.section
              key={chapter.id}
              className="lp-chapter glass-pro"
              onViewportEnter={() => setActiveId(chapter.id)}
              viewport={{ amount: 0.45, once: false }}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0, transition: { delay: 0.05 * i, duration: 0.5 } }}
            >
              <div className="lp-chapter-head">
                <span className="lp-chapter-icon">{chapter.icon}</span>
                <p className="caps">{chapter.label}</p>
                <h2 style={{ fontFamily: "var(--font-sans)" }}>{chapter.title}</h2>
                <p className="subtle">{chapter.copy}</p>
                <p className="lp-chapter-flair">
                  <Sparkles size={14} />
                  {chapter.id === "modules"
                    ? "We keep the surface calm so you can move fast under pressure."
                    : "The same interface language in-app — this is not a marketing mock in a different skin."}
                </p>
              </div>
            </motion.section>
          ))}
        </div>
      </div>

      <section className="lp-end glass-pro fade-section">
        <div>
          <h2>Bring your campus. We will hold the frame.</h2>
          <p className="subtle" style={{ maxWidth: "36rem", margin: "0.45rem 0 0" }}>
            Start free as a student, or run the owner console. Partners: ask for the rate card — we are clear about who
            pays, and who never does.
          </p>
        </div>
        <div className="hero-cta" style={{ marginTop: 0 }}>
          <Link to="/register" className="btn btn-primary" onMouseDown={hapticTap}>
            Create a free account
          </Link>
          <Link to="/login" className="btn btn-ghost" onMouseDown={hapticTap}>
            Sign in
          </Link>
        </div>
      </section>

      <AdSlot
        id="landing-discovery-lane"
        format="inline"
        title="Discovery placement · brands & orgs"
        description="A quiet card in-flow for stories that should travel with a cohort, not against it. Built for long-term brand trust, not one-off blasts."
        cta="Request a brief"
        mode="brand"
      />
    </motion.main>
  );
}

export default LandingPage;
