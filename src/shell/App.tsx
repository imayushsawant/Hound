import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from "react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Globe2,
  LayoutDashboard,
  LockKeyhole,
  Monitor,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  Table2,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useAppInfo } from "./useAppInfo";
import "./shell.css";

const pages = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/companies", label: "Companies", icon: Building2 },
  { path: "/boards", label: "Boards", icon: Globe2 },
  { path: "/settings", label: "Settings", icon: Settings2 },
] as const;

function NudgeMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`nudge-mark ${small ? "small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path
          d="M8 24V14a7 7 0 0 1 14 0v10M8 17l14-7"
          stroke="currentColor"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <circle cx="25.5" cy="6.5" r="3" fill="currentColor" />
      </svg>
    </span>
  );
}

function Sidebar() {
  return (
    <aside className="nudge-sidebar">
      <NavLink to="/" className="nudge-brand" aria-label="Nudge dashboard">
        <NudgeMark />
        <span>
          hound<span className="brand-dot">.</span>
        </span>
      </NavLink>
      <div className="personal-workspace">
        <span className="workspace-symbol">
          <BriefcaseBusiness size={17} />
        </span>
        <div>
          <strong>Personal workspace</strong>
          <span>A little more organized.</span>
        </div>
      </div>
      <div className="navigation-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        {pages.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === "/"}
            className={({ isActive }) => `nudge-nav-link${isActive ? " active" : ""}`}
          >
            <Icon size={18} strokeWidth={1.7} />
            <span>{label}</span>
            <span className="nav-active-dot" />
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="momentum-card">
          <span className="momentum-spark">
            <Sparkles size={19} strokeWidth={1.6} />
          </span>
          <h3>One step closer.</h3>
          <p>
            Big chapters start with small
            <br />
            steps. Make room for yours.
          </p>
          <div className="momentum-steps" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <NavLink to="/settings" className="sidebar-help">
          <CircleHelp size={17} />
          <span>About your workspace</span>
          <ArrowUpRight size={14} />
        </NavLink>
        <div className="sidebar-privacy">
          <span className="status-dot" />
          Local. Private. Yours.
          <ShieldCheck size={13} />
        </div>
      </div>
    </aside>
  );
}

function Shell() {
  useEffect(() => {
    document.title = "Hound — Your next chapter";
    document.documentElement.lang = "en";
  }, []);
  const location = useLocation();
  const title = pages.find((page) => page.path === location.pathname)?.label ?? "Dashboard";
  const { info, error, desktop } = useAppInfo();
  const connected = Boolean(info?.database.ready);
  const connectionLabel = error
    ? "Connection unavailable"
    : desktop
      ? connected
        ? "Local workspace"
        : "Connecting…"
      : "Web preview";

  return (
    <div className="nudge-app">
      <a href="#nudge-main" className="nudge-skip">
        Skip to content
      </a>
      <Sidebar />
      <div className="nudge-main-shell">
        <header className="nudge-topbar">
          <div className="nudge-breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{title}</strong>
          </div>
          <div className="topbar-meta">
            <span className={`workspace-status ${error ? "error" : ""}`}>
              <span className="status-dot" />
              {connectionLabel}
            </span>
            <span className="topbar-separator" />
            <Monitor size={16} />
            <span className="desktop-label">Made for your desktop</span>
          </div>
        </header>
        <main id="nudge-main" className="nudge-content" key={location.pathname}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/companies" element={<Placeholder kind="companies" />} />
            <Route path="/boards" element={<Placeholder kind="boards" />} />
            <Route
              path="/settings"
              element={
                <Placeholder
                  kind="settings"
                  version={info?.version}
                  connected={connected}
                  desktop={desktop}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="nudge-footer">
            <span>A little clarity for your next chapter.</span>
            <span>
              <LockKeyhole size={12} />
              {desktop
                ? connected
                  ? "Saved on this device"
                  : "Desktop workspace"
                : "Preview only · No database connected"}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: boolean;
}) {
  return (
    <div className="nudge-page-heading">
      <div>
        <div className="nudge-eyebrow">
          <span />
          {eyebrow}
        </div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && (
        <div className="coming-action" title="Application creation is not part of this scaffold">
          <button disabled className="nudge-add-button">
            <Plus size={16} />
            Add application
          </button>
          <span>Coming in the next chapter</span>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  icon: Icon,
  color,
  note,
}: {
  title: string;
  icon: LucideIcon;
  color: string;
  note: string;
}) {
  return (
    <div className="nudge-stat">
      <div className="nudge-stat-heading">
        <span>{title}</span>
        <span className={`stat-symbol ${color}`}>
          <Icon size={17} strokeWidth={1.7} />
        </span>
      </div>
      <div className="nudge-stat-value" aria-label="Not available yet">
        —
        <span className="stat-graph" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      <div className="nudge-stat-note">
        <span className="stat-note-dot" />
        {note}
      </div>
    </div>
  );
}

function ApplicationIllustration() {
  return (
    <div className="application-illustration" aria-hidden="true">
      <div className="illustration-orbit orbit-one" />
      <div className="illustration-orbit orbit-two" />
      <span className="illustration-spark">
        <Sparkles size={16} />
      </span>
      <div className="illustration-card back-card" />
      <div className="illustration-card front-card">
        <span className="illustration-logo">
          <BriefcaseBusiness size={20} strokeWidth={1.6} />
        </span>
        <div className="illustration-lines">
          <i />
          <i />
        </div>
        <div className="illustration-bottom">
          <span />
          <span>
            <Check size={9} />
            Next chapter
          </span>
        </div>
      </div>
      <span className="illustration-check">
        <Check size={17} />
      </span>
      <span className="illustration-dot dot-one" />
      <span className="illustration-dot dot-two" />
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <PageHeading
        eyebrow="YOUR NEXT CHAPTER"
        title="Small steps. New possibilities."
        description="A little structure for your search. A little space for what’s next."
        action
      />
      <div className="nudge-stats">
        <StatCard
          title="Active applications"
          icon={BriefcaseBusiness}
          color="peach"
          note="Every opportunity, in one place"
        />
        <StatCard
          title="In the interview loop"
          icon={CalendarDays}
          color="lavender"
          note="Good conversations ahead"
        />
        <StatCard
          title="Offers received"
          icon={Target}
          color="sage"
          note="Something to look forward to"
        />
        <StatCard
          title="Needs a little nudge"
          icon={Clock3}
          color="butter"
          note="Your next steps, made clearer"
        />
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section className="applications-shell" aria-labelledby="applications-title">
            <div className="applications-heading">
              <div>
                <h2 id="applications-title">
                  Your applications<span className="scaffold-badge">Coming next</span>
                </h2>
                <p>From the first hello to the final offer.</p>
              </div>
              <BriefcaseBusiness size={18} strokeWidth={1.5} />
            </div>
            <div className="applications-view">
              <span className="active-tab">Active applications</span>
              <span>
                <Table2 size={13} />
                Table view
              </span>
            </div>
            <div className="placeholder-table" role="table" aria-label="Future applications table">
              <div className="placeholder-table-head" role="row">
                {["Company", "Role", "Stage", "Next action", "Applied", "Updated"].map((label) => (
                  <span role="columnheader" key={label}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="application-empty">
              <ApplicationIllustration />
              <h3>Your next chapter starts here.</h3>
              <p>
                A home for every opportunity, conversation, and next step.
                <br />
                Application tracking is on its way.
              </p>
              <span className="empty-state-label">
                <span />A clean slate. A world of possibilities.
              </span>
            </div>
            <div className="application-panel-footer">
              <ShieldCheck size={13} />
              <span>Built for your search. Designed to stay yours.</span>
              <span className="footer-scaffold">WORKSPACE PREVIEW</span>
            </div>
          </section>
          <div className="nudge-encouragement">
            <span>
              <Sparkles size={17} />
            </span>
            <p>You don’t have to figure it all out today. Just take the next step.</p>
            <span className="encouragement-signoff">You’ve got this.</span>
          </div>
        </div>
        <aside className="dashboard-secondary" aria-label="Workspace previews">
          <section className="nudge-side-panel">
            <h2>
              <CalendarDays size={16} strokeWidth={1.7} />
              On the horizon
              <span className="mini-dot" />
            </h2>
            <p>A little prep goes a long way.</p>
            <div className="upcoming-placeholder">
              <span className="empty-calendar">
                <CalendarDays size={23} strokeWidth={1.3} />
              </span>
              <h3>Room for what’s next.</h3>
              <p>
                Your upcoming rounds and
                <br />
                follow-ups will appear here.
              </p>
            </div>
            <div className="side-panel-bottom">
              <span>One thing at a time.</span>
              <span className="coming-label">Coming next</span>
            </div>
          </section>
          <section className="nudge-side-panel boards-preview">
            <h2>
              <Globe2 size={16} strokeWidth={1.7} />
              Your opportunity radar
            </h2>
            <p>Good things are out there.</p>
            <div className="board-preview-illustration" aria-hidden="true">
              <span>
                <Globe2 size={17} />
              </span>
              <span>
                <BriefcaseBusiness size={17} />
              </span>
              <span>
                <ArrowUpRight size={18} />
              </span>
            </div>
            <p className="boards-preview-description">
              A place for your favorite job boards.
              <br />
              And a gentle nudge to check in.
            </p>
            <NavLink to="/boards" className="nudge-text-link">
              Explore boards
              <ArrowRight size={14} />
            </NavLink>
          </section>
          <div className="dashboard-privacy">
            <ShieldCheck size={17} strokeWidth={1.5} />
            <p>
              Your journey stays yours.
              <br />
              <span>No cloud. No accounts. Just you.</span>
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

const placeholderContent = {
  companies: {
    eyebrow: "THE TEAMS BEHIND THE OPPORTUNITIES",
    title: "Good company. New possibilities.",
    description: "A place to get to know where your next chapter could begin.",
    icon: Building2,
    heading: "Your company shortlist, all together.",
    body: "Company overviews, notes, and every application to a team will live here. Companies will be created automatically when you add an application.",
    label: "COMPANY PROFILES · COMING NEXT",
  },
  boards: {
    eyebrow: "KEEP YOUR OPPORTUNITY RADAR ON",
    title: "Good things are out there.",
    description: "Your favorite places to look, with a little help remembering to check in.",
    icon: Globe2,
    heading: "Make room for your next opportunity.",
    body: "Save your go-to job boards, set a check-in rhythm, and get a gentle reminder when it’s time to look. Board management is coming next.",
    label: "JOB BOARDS & REMINDERS · COMING NEXT",
  },
  settings: {
    eyebrow: "A WORKSPACE THAT FEELS LIKE YOURS",
    title: "Simple. Local. Yours.",
    description: "A little control over how Nudge fits into your day.",
    icon: Settings2,
    heading: "Your workspace, on your terms.",
    body: "Launch-on-login, tray access, and desktop preferences will be available here. For now, the foundation is ready for your next chapter.",
    label: "DESKTOP PREFERENCES · COMING NEXT",
  },
};

function Placeholder({
  kind,
  version,
  connected,
  desktop,
}: {
  kind: keyof typeof placeholderContent;
  version?: string;
  connected?: boolean;
  desktop?: boolean;
}) {
  const content = placeholderContent[kind];
  const Icon = content.icon;
  return (
    <>
      <PageHeading
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />
      <section className="nudge-placeholder-page">
        <span className="placeholder-page-icon">
          <Icon size={32} strokeWidth={1.35} />
        </span>
        <span className="placeholder-kicker">{content.label}</span>
        <h2>{content.heading}</h2>
        <p>{content.body}</p>
        <NavLink to="/" className="nudge-back-link">
          Back to dashboard
          <ArrowRight size={15} />
        </NavLink>
      </section>
      {kind === "settings" && (
        <div className="workspace-details">
          <div>
            <ShieldCheck size={20} />
            <h3>Private by design</h3>
            <p>
              No accounts, analytics, or cloud services.
              <br />
              Your workspace belongs on your device.
            </p>
          </div>
          <div>
            <Monitor size={20} />
            <h3>
              {desktop
                ? connected
                  ? "Desktop connected"
                  : "Desktop connecting"
                : "You’re in the web preview"}
            </h3>
            <p>
              {desktop
                ? "SQLite is opened only by the main process."
                : "Desktop storage isn’t available in a browser."}
              <br />
              {version ? `Nudge v${version}` : "Nudge · Foundation & shell"}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
