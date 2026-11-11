import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  LayoutDashboard,
  ListFilter,
  MapPin,
  Monitor,
  MoreHorizontal,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  X,
  Zap,
  HoundMark,
  CompanyLogo,
} from "./icons";
import {
  boardDue,
  createSeed,
  dayLabel,
  followUpDate,
  formatDate,
  isActive,
  isoDate,
  nextAction,
  readStore,
  relativeLastUpdated,
  roundTypes,
  stages,
  uid,
  validStore,
  type Application,
  type Board,
  type Company,
  type Round,
  type Stage,
  type Store,
} from "./data";

type Page = "Overview" | "Applications" | "Companies" | "Job boards" | "Reminders" | "Settings";
type Modal = "application" | "board" | "help" | null;
type Toast = { message: string; error?: boolean };
const activeCount = (s: Store) => s.applications.filter(isActive).length;
const dueApplications = (s: Store) =>
  s.applications.filter(
    (a) => a.stage === "Applied" && !a.followUpDone && followUpDate(a) <= isoDate(),
  );

function App() {
  const [store, setStore] = useState<Store>(readStore);
  const [ready, setReady] = useState(!window.houndDesktop);
  const [page, setPage] = useState<Page>("Overview");
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [newCompany, setNewCompany] = useState("");
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const skipDesktopSave = useRef(false);
  const notify = useCallback((message: string, error = false) => setToast({ message, error }), []);
  useEffect(() => {
    if (!window.houndDesktop) return;
    let live = true;
    window.houndDesktop
      .load()
      .then((data) => {
        if (live && validStore(data)) {
          skipDesktopSave.current = true;
          setStore(data);
        }
      })
      .catch(() =>
        notify("Could not read the desktop workspace. Browser backup is available.", true),
      )
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, [notify]);
  useEffect(() => {
    if (!ready) return;
    if (window.houndDesktop && skipDesktopSave.current) {
      skipDesktopSave.current = false;
      return;
    }
    try {
      localStorage.setItem("hound-workspace-v1", JSON.stringify(store));
    } catch {
      notify("Device storage is full or unavailable. Export a backup to keep your changes.", true);
    }
    window.houndDesktop
      ?.save(store)
      .catch(() => notify("Could not save to disk. Please export a backup.", true));
  }, [store, ready, notify]);
  useEffect(() => {
    if (!window.houndDesktop) return;
    return window.houndDesktop.onDataChanged(() => {
      window
        .houndDesktop!.load()
        .then((data) => {
          if (validStore(data))
            setStore((current) => {
              if (JSON.stringify(current) === JSON.stringify(data)) return current;
              skipDesktopSave.current = true;
              return data;
            });
        })
        .catch(() => notify("Could not refresh the local workspace.", true));
    });
  }, [notify]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.key.toLowerCase() === "n" && !e.shiftKey && !e.altKey && !e.metaKey) ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "j")
      ) {
        e.preventDefault();
        setModal("application");
      }
      if (e.key === "Escape") {
        setModal(null);
        setNotificationsOpen(false);
        setMobileNav(false);
      }
    };
    window.addEventListener("keydown", listener);
    const off = window.houndDesktop?.onQuickAdd(() => setModal("application"));
    return () => {
      window.removeEventListener("keydown", listener);
      off?.();
    };
  }, []);
  useEffect(() => {
    if (!ready || !store.settings.notifications) return;
    const check = () => {
      const reminders = [
        ...dueApplications(store).map((a) => ({
          id: `follow-${a.id}`,
          title: "Time for a follow-up",
          body: `${store.companies.find((c) => c.id === a.companyId)?.name} · ${a.role}`,
        })),
        ...store.boards
          .filter(boardDue)
          .map((b) => ({
            id: `board-${b.id}-${b.checked}`,
            title: `Check ${b.name}`,
            body: `Your ${b.frequency}-day job board check is due.`,
          })),
        ...store.applications
          .filter(isActive)
          .flatMap((a) =>
            a.rounds
              .filter((r) => r.status === "Upcoming" && r.date.slice(0, 10) === isoDate())
              .map((r) => ({
                id: `round-${r.id}`,
                title: `Today: ${r.type}`,
                body: `${store.companies.find((c) => c.id === a.companyId)?.name} · ${new Date(r.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`,
              })),
          ),
      ];
      reminders.forEach((r) => {
        const key = `hound-notified-${isoDate()}-${r.id}`;
        if (localStorage.getItem(key)) return;
        if (window.houndDesktop) window.houndDesktop.notify(r.title, r.body);
        else if ("Notification" in window && Notification.permission === "granted")
          new Notification(r.title, { body: r.body });
        else return;
        localStorage.setItem(key, "yes");
      });
    };
    check();
    const timer = setInterval(check, 60000);
    return () => clearInterval(timer);
  }, [store, ready]);
  const navigate = (next: Page) => {
    setPage(next);
    setSelectedApp(null);
    setSelectedCompany(null);
    setQuery("");
    setMobileNav(false);
    setNotificationsOpen(false);
  };
  const updateApplication = (id: string, patch: Partial<Application>) =>
    setStore((s) => ({
      ...s,
      applications: s.applications.map((a) =>
        a.id === id ? { ...a, ...patch, updated: isoDate() } : a,
      ),
    }));
  const addApplication = (application: Application, company?: Company) => {
    setStore((s) => ({
      ...s,
      companies: company ? [...s.companies, company] : s.companies,
      applications: [application, ...s.applications],
    }));
    setModal(null);
    setNewCompany("");
    notify("Application added. Here’s to your next chapter.");
  };
  const openApp = (id: string) => {
    setSelectedApp(id);
    setNotificationsOpen(false);
    setQuery("");
  };
  const openCompany = (id: string) => {
    setPage("Companies");
    setSelectedCompany(id);
    setSelectedApp(null);
  };
  const checkBoard = (id: string) => {
    setStore((s) => ({
      ...s,
      boards: s.boards.map((b) => (b.id === id ? { ...b, checked: new Date().toISOString() } : b)),
    }));
    notify("Checked off. One small step forward.");
  };
  const reminderCount = dueApplications(store).length + store.boards.filter(boardDue).length;
  const app = store.applications.find((a) => a.id === selectedApp);
  const company = store.companies.find((c) => c.id === selectedCompany);
  const addButton = (
    <button
      className="button primary"
      onClick={() => {
        setNewCompany("");
        setModal("application");
      }}
    >
      <Plus size={16} /> Add application
    </button>
  );

  return (
    <div className="app-shell">
      {mobileNav && <div className="nav-scrim" onClick={() => setMobileNav(false)} />}
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("Overview");
          }}
        >
          <HoundMark size={35} />
          <span>
            hound<span className="brand-period">.</span>
          </span>
        </a>
        <div className="workspace-switch">
          <span className="workspace-avatar">
            A<span />
          </span>
          <div>
            Personal workspace<small>Let’s find your next thing.</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">
          {(
            [
              { label: "Overview", icon: LayoutDashboard },
              { label: "Applications", icon: BriefcaseBusiness },
              { label: "Companies", icon: Building2 },
            ] as const
          ).map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${page === label ? "active" : ""}`}
              onClick={() => navigate(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Applications" && <span className="nav-count">{activeCount(store)}</span>}
            </button>
          ))}
          <span className="nav-label tools-label">STAY ON TRACK</span>
          {(
            [
              { label: "Job boards", icon: Globe },
              { label: "Reminders", icon: Bell },
            ] as const
          ).map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${page === label ? "active" : ""}`}
              onClick={() => navigate(label)}
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === "Reminders" && reminderCount > 0 && <span className="reminder-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="small-momentum">
            <div className="momentum-icon">
              <Sparkles size={17} />
            </div>
            <h3>A little every day.</h3>
            <p>
              Your next opportunity is out there.
              <br />
              Keep showing up.
            </p>
            <div className="momentum-line">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <button
            className={`nav-item ${page === "Settings" ? "active" : ""}`}
            onClick={() => navigate("Settings")}
          >
            <Settings2 size={18} />
            <span>Settings</span>
          </button>
          <button className="nav-item" onClick={() => setModal("help")}>
            <HelpCircle size={18} />
            <span>Help & shortcuts</span>
            <span className="shortcut-question">?</span>
          </button>
          <div className="local-status">
            <span className="status-dot" />
            <span>Local. Private. Yours.</span>
            <ShieldCheck size={13} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileNav(true)}
            >
              <LayoutDashboard size={19} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{app ? "Application details" : company ? company.name : page}</strong>
          </div>
          <div className="topbar-right">
            <span className="local-pill">
              <span className="status-dot" />
              Local workspace
            </span>
            <span className="topbar-divider" />
            <div className="notification-wrap">
              <button
                className={`icon-button notification-button ${notificationsOpen ? "pressed" : ""}`}
                aria-label="Notifications"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <Bell size={18} />
                {reminderCount > 0 && <i />}
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <div className="popover-heading">
                    <strong>Your reminders</strong>
                    <span className="small-count">{reminderCount}</span>
                  </div>
                  {dueApplications(store)
                    .slice(0, 3)
                    .map((a) => (
                      <button className="notification-row" key={a.id} onClick={() => openApp(a.id)}>
                        <Clock3 size={16} />
                        <span>
                          Follow up with {store.companies.find((c) => c.id === a.companyId)?.name}
                          <small>{a.role}</small>
                        </span>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  {store.boards.filter(boardDue).map((b) => (
                    <button
                      className="notification-row"
                      key={b.id}
                      onClick={() => navigate("Job boards")}
                    >
                      <Globe size={16} />
                      <span>
                        Check {b.name}
                        <small>Fresh opportunities might be waiting.</small>
                      </span>
                    </button>
                  ))}
                  {!reminderCount && (
                    <p className="popover-empty">You’re all caught up. Nice work.</p>
                  )}
                  <button className="popover-footer" onClick={() => navigate("Reminders")}>
                    View all reminders <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
            <button
              className="profile-avatar"
              aria-label="Your settings"
              onClick={() => navigate("Settings")}
            >
              {store.settings.name.charAt(0).toUpperCase() || "A"}
            </button>
          </div>
        </header>
        <main className="main-content">
          {app ? (
            <ApplicationDetail
              application={app}
              company={store.companies.find((c) => c.id === app.companyId)!}
              onBack={() => setSelectedApp(null)}
              onUpdate={(patch) => updateApplication(app.id, patch)}
              onCompany={() => openCompany(app.companyId)}
              onDelete={() => {
                setStore((s) => ({
                  ...s,
                  applications: s.applications.filter((a) => a.id !== app.id),
                }));
                setSelectedApp(null);
                notify("Application deleted.");
              }}
            />
          ) : company ? (
            <CompanyDetail
              company={company}
              store={store}
              onBack={() => setSelectedCompany(null)}
              onOpen={openApp}
              onStage={(id, stage) => {
                updateApplication(id, { stage });
                notify("Application stage updated.");
              }}
              onSave={(patch) => {
                if (patch.name && patch.name.trim().toLowerCase() !== company.name.trim().toLowerCase()) {
                  const exists = store.companies.some(
                    (c) => c.id !== company.id && c.name.trim().toLowerCase() === patch.name!.trim().toLowerCase(),
                  );
                  if (exists) {
                    notify(`A company named "${patch.name.trim()}" already exists.`, true);
                    return false;
                  }
                }
                setStore((s) => ({
                  ...s,
                  companies: s.companies.map((c) => (c.id === company.id ? { ...c, ...patch } : c)),
                }));
                notify("Company updated.");
                return true;
              }}
              onAdd={() => {
                setNewCompany(company.name);
                setModal("application");
              }}
            />
          ) : (
            <>
              {page === "Overview" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">
                        <Sparkles className="sun-glyph" size={13} /> YOUR NEXT CHAPTER
                      </div>
                      <h1>A little progress. New possibilities.</h1>
                      <p>A clear view of your job search, and what comes next.</p>
                    </div>
                    {addButton}
                  </div>
                  <div className="stats-grid">
                    <Stat
                      title="Active applications"
                      value={activeCount(store)}
                      icon={<BriefcaseBusiness size={18} />}
                      color="peach"
                      detail={
                        <>
                          <span className="positive">
                            <TrendingUp size={12} />{" "}
                            {
                              store.applications.filter(
                                (a) => isActive(a) && a.applied >= isoDate(-7),
                              ).length
                            }{" "}
                            this week
                          </span>
                          <span>Keep the momentum</span>
                        </>
                      }
                    />
                    <Stat
                      title="In the interview loop"
                      value={store.applications.filter((a) => a.stage === "Interview").length}
                      icon={<CalendarDays size={18} />}
                      color="purple"
                      detail={
                        <>
                          <span className="stat-dots">
                            <i />
                            <i />
                            <i />
                          </span>
                          <span>Good conversations ahead</span>
                        </>
                      }
                    />
                    <Stat
                      title="Offers received"
                      value={store.applications.filter((a) => a.stage === "Offer").length}
                      icon={<Target size={18} />}
                      color="green"
                      detail={
                        <>
                          <span className="positive">
                            <Sparkles size={12} /> Looking good
                          </span>
                          <span>You’ve earned this</span>
                        </>
                      }
                    />
                    <Stat
                      title="Needs a little nudge"
                      value={reminderCount}
                      icon={<Clock3 size={18} />}
                      color="yellow"
                      detail={
                        <>
                          <button className="text-link warm" onClick={() => navigate("Reminders")}>
                            View reminders <ArrowRight size={12} />
                          </button>
                          <span>Stay one step ahead</span>
                        </>
                      }
                    />
                  </div>
                  <div className="dashboard-grid">
                    <div className="dashboard-main">
                      <ApplicationsTable
                        store={store}
                        query={query}
                        onQuery={setQuery}
                        onOpen={openApp}
                        onStage={(id, stage) => {
                          updateApplication(id, { stage });
                          notify("Application stage updated.");
                        }}
                        onAdd={() => setModal("application")}
                        compact
                      />
                      <div className="encouragement">
                        <span className="encouragement-icon">
                          <TrendingUp size={17} />
                        </span>
                        <p>
                          Progress isn’t always a big leap. Sometimes it’s just one more
                          application.
                        </p>
                        <span>You’ve got this.</span>
                      </div>
                    </div>
                    <div className="dashboard-aside">
                      <Upcoming
                        store={store}
                        onOpen={openApp}
                        onAll={() => navigate("Reminders")}
                      />
                      <BoardWidget
                        boards={store.boards}
                        onCheck={checkBoard}
                        onAll={() => navigate("Job boards")}
                      />
                      <div className="privacy-note">
                        <ShieldCheck size={15} />
                        <p>
                          Your journey stays yours.
                          <br />
                          <span>Everything is saved on this device.</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {page === "Applications" && (
                <>
                  <PageHeading
                    eyebrow="ONE OPPORTUNITY AT A TIME"
                    title="Your applications"
                    description="Every application is a step toward what’s next."
                    action={addButton}
                  />
                  <ApplicationsTable
                    store={store}
                    query={query}
                    onQuery={setQuery}
                    onOpen={openApp}
                    onStage={(id, stage) => updateApplication(id, { stage })}
                    onAdd={() => setModal("application")}
                  />
                </>
              )}
              {page === "Companies" && (
                <>
                  <PageHeading
                    eyebrow="PLACES YOU COULD CALL YOUR OWN"
                    title="Your company shortlist"
                    description="Get to know the teams behind your next opportunity."
                    action={
                      <button
                        className="button primary"
                        onClick={() => {
                          setNewCompany("");
                          setModal("application");
                        }}
                      >
                        <Plus size={16} /> New company
                      </button>
                    }
                  />
                  <div className="section-toolbar">
                    <label className="search-field">
                      <Search size={16} />
                      <input
                        aria-label="Search companies"
                        placeholder="Find a company..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      {query ? (
                        <button
                          type="button"
                          className="search-clear"
                          onClick={() => setQuery("")}
                          title="Clear search"
                          aria-label="Clear search"
                        >
                          <X size={14} />
                        </button>
                      ) : (
                        <kbd>⌕</kbd>
                      )}
                    </label>
                    <span className="muted small">
                      {store.companies.length} {store.companies.length === 1 ? "company" : "companies"} in your orbit
                    </span>
                  </div>
                  <div className="companies-grid">
                    {store.companies
                      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
                      .map((c) => {
                        const compApps = store.applications.filter((a) => a.companyId === c.id);
                        const dates = compApps
                          .map((a) => a.updated || a.applied)
                          .filter(Boolean)
                          .sort((d1, d2) => new Date(d2).getTime() - new Date(d1).getTime());
                        const mostRecentActivity =
                          dates.length > 0 ? relativeLastUpdated(dates[0]) : "No activity";
                        return (
                          <button
                            className="company-card"
                            key={c.id}
                            onClick={() => openCompany(c.id)}
                          >
                            <div className="company-card-top">
                              <CompanyLogo name={c.name} color={c.color} size={44} />
                              <ArrowUpRight size={17} />
                            </div>
                            <h3>{c.name}</h3>
                            <span className="company-domain">{c.domain || "Company profile"}</span>
                            <p>
                              {c.description ||
                                "A new possibility. Add a company overview to get to know this team."}
                            </p>
                            <div className="company-card-footer">
                              <span title="Total applications">
                                <BriefcaseBusiness size={13} />
                                {compApps.length} {compApps.length === 1 ? "application" : "applications"}
                              </span>
                              <span title="Most recent activity">
                                <Clock3 size={13} />
                                {mostRecentActivity}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                  {!store.companies.some((c) =>
                    c.name.toLowerCase().includes(query.toLowerCase()),
                  ) && (
                    <Empty title="No companies found" description="Try a different company name." />
                  )}
                </>
              )}
              {page === "Job boards" && (
                <>
                  <PageHeading
                    eyebrow="A GOOD OPPORTUNITY IS OUT THERE"
                    title="Keep an eye out"
                    description="Your favorite job boards, with a gentle nudge to check in."
                    action={
                      <button className="button primary" onClick={() => setModal("board")}>
                        <Plus size={16} />
                        Add job board
                      </button>
                    }
                  />
                  <div className="info-banner">
                    <Globe size={19} />
                    <div>
                      <strong>A small habit. A world of possibilities.</strong>
                      <p>
                        Set a check-in rhythm for each board. Hound will remind you when it’s time.
                      </p>
                    </div>
                  </div>
                  <div className="board-list">
                    {store.boards.map((b) => (
                      <div className="board-card" key={b.id}>
                        <span className="board-letter" style={{ background: b.color }}>
                          {b.name === "LinkedIn" ? "in" : b.name.charAt(0)}
                        </span>
                        <div className="board-card-name">
                          <h3>
                            {b.name}
                            <a
                              href={b.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${b.name}`}
                            >
                              <ExternalLink size={14} />
                            </a>
                          </h3>
                          <span>{new URL(b.url).hostname}</span>
                        </div>
                        <label className="board-frequency">
                          Check every
                          <select
                            aria-label={`Check frequency for ${b.name}`}
                            value={b.frequency}
                            onChange={(e) =>
                              setStore((s) => ({
                                ...s,
                                boards: s.boards.map((x) =>
                                  x.id === b.id ? { ...x, frequency: +e.target.value } : x,
                                ),
                              }))
                            }
                          >
                            {[1, 2, 3, 7, 14].map((n) => (
                              <option key={n} value={n}>
                                {n === 1 ? "day" : `${n} days`}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="board-last">
                          <span>Last checked</span>
                          <strong>{formatDate(b.checked)}</strong>
                        </div>
                        <span className={`due-label ${boardDue(b) ? "is-due" : ""}`}>
                          <span />
                          {boardDue(b) ? "Check-in due" : "Up to date"}
                        </span>
                        <button className="button secondary" onClick={() => checkBoard(b.id)}>
                          <Check size={15} />
                          Mark checked
                        </button>
                        <button
                          className="icon-button danger-hover"
                          aria-label={`Remove ${b.name}`}
                          onClick={() => {
                            if (confirm(`Remove ${b.name} from your job boards?`))
                              setStore((s) => ({
                                ...s,
                                boards: s.boards.filter((x) => x.id !== b.id),
                              }));
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {!store.boards.length && (
                    <Empty
                      title="Build your opportunity radar"
                      description="Add a job board and set your first check-in reminder."
                      action={
                        <button className="button primary" onClick={() => setModal("board")}>
                          Add a job board
                        </button>
                      }
                    />
                  )}
                </>
              )}
              {page === "Reminders" && (
                <>
                  <PageHeading
                    eyebrow="A LITTLE FOLLOW-THROUGH GOES A LONG WAY"
                    title="What comes next"
                    description="Upcoming conversations, follow-ups, and small things that matter."
                  />
                  <Reminders
                    store={store}
                    onOpen={openApp}
                    onFollowUp={(id) => {
                      updateApplication(id, { followUpDone: true });
                      notify("Follow-up complete. Nice work.");
                    }}
                    onCheck={checkBoard}
                  />
                </>
              )}
              {page === "Settings" && (
                <Settings store={store} setStore={setStore} notify={notify} />
              )}
            </>
          )}
          <footer className="page-footer">
            <span>Made for the journey, not just the destination.</span>
            <span>
              Hound <span className="footer-dot">·</span> Your personal job search companion
            </span>
          </footer>
        </main>
      </div>
      {modal === "application" && (
        <ApplicationModal
          companies={store.companies}
          initialCompany={newCompany}
          onClose={() => setModal(null)}
          onSave={addApplication}
        />
      )}
      {modal === "board" && (
        <BoardModal
          onClose={() => setModal(null)}
          onSave={(board) => {
            setStore((s) => ({ ...s, boards: [...s.boards, board] }));
            setModal(null);
            notify("Job board added to your radar.");
          }}
        />
      )}
      {modal === "help" && (
        <ModalFrame
          title="A few handy shortcuts"
          subtitle="A little less clicking. A little more momentum."
          onClose={() => setModal(null)}
        >
          <div className="shortcut-row">
            <span>Add an application</span>
            <span>
              <kbd>Ctrl</kbd> + <kbd>N</kbd>
            </span>
          </div>
          <div className="shortcut-row">
            <span>Quick-add an application</span>
            <span>
              <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>J</kbd>
            </span>
          </div>
          <div className="shortcut-row">
            <span>Close dialogs and menus</span>
            <kbd>Esc</kbd>
          </div>
          <div className="help-note">
            <ShieldCheck size={21} />
            <div>
              <strong>Your workspace is local-only.</strong>
              <p>
                No accounts. No cloud. Your applications stay on this device. Export a backup in
                Settings whenever you need one.
              </p>
            </div>
          </div>
          <p className="muted small">
            In the installed desktop app, quick-add works globally. Hound can stay in your system
            tray and launch when you log in.
          </p>
        </ModalFrame>
      )}
      {toast && (
        <div role="status" className={`toast ${toast.error ? "error" : ""}`}>
          <CircleCheck size={18} />
          <span>{toast.message}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
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
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({
  title,
  value,
  icon,
  color,
  detail,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color: string;
  detail: ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>
        <span className={`stat-icon ${color}`}>{icon}</span>
      </div>
      <div className="stat-number">
        {String(value).padStart(2, "0")}
        <span className={`stat-sparkline ${color}`}>
          <svg viewBox="0 0 80 28">
            <path
              d={
                color === "green"
                  ? "M2 24H24V18H41V18H57V8H77"
                  : color === "purple"
                    ? "M2 24L16 20L28 22L42 12L55 16L68 6L78 4"
                    : "M2 24L15 24L26 16L38 19L50 10L61 12L78 3"
              }
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}
function StageBadge({ stage, onChange }: { stage: Stage; onChange?: (stage: Stage) => void }) {
  return (
    <span className={`stage-badge stage-${stage.toLowerCase()}`}>
      <span className="stage-dot" />
      {stage}
      {onChange && (
        <>
          <ChevronDown size={11} />
          <select
            aria-label="Change application stage"
            value={stage}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onChange(e.target.value as Stage)}
          >
            {stages.map((s) => (
              <option value={s} key={s}>
                {s}
              </option>
            ))}
          </select>
        </>
      )}
    </span>
  );
}
function ApplicationsTable({
  store,
  query,
  onQuery,
  onOpen,
  onStage,
  onAdd,
  compact = false,
  companyId,
}: {
  store: Store;
  query: string;
  onQuery: (q: string) => void;
  onOpen: (id: string) => void;
  onStage: (id: string, stage: Stage) => void;
  onAdd: () => void;
  compact?: boolean;
  companyId?: string;
}) {
  const [tab, setTab] = useState("Active");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [stage, setStage] = useState("All stages");
  const [sort, setSort] = useState<{ key: string; asc: boolean }>({ key: "default", asc: true });
  const [page, setPage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const rowsPerPage = compact ? 8 : 10;
  useEffect(() => setPage(0), [query, tab, stage, includeInactive]);
  const results = useMemo(
    () =>
      store.applications
        .filter((a) => {
          if (companyId && a.companyId !== companyId) return false;
          const company = store.companies.find((c) => c.id === a.companyId);
          const companyName = company?.name || "";
          // By default on Dashboard: active applications exclude Rejected, Withdrawn, and Offer unless toggled
          const isTerminalOffer = a.stage === "Offer";
          const isInactive = !isActive(a); // Rejected, Withdrawn
          const matchesActiveRule = includeInactive || (!isInactive && !isTerminalOffer);

          const matchesTab =
            tab === "All" ||
            (tab === "Active" && matchesActiveRule) ||
            (tab === "Archived" && !matchesActiveRule);

          const matchesStage = stage === "All stages" || a.stage === stage;
          const matchesQuery = `${companyName} ${a.role} ${a.location}`
            .toLowerCase()
            .includes(query.toLowerCase());

          return matchesTab && matchesStage && matchesQuery;
        })
        .sort((a, b) => {
          if (sort.key === "default") return 0;
          const get = (x: Application) => {
            if (sort.key === "company") {
              return store.companies.find((c) => c.id === x.companyId)?.name || "";
            }
            if (sort.key === "action") {
              return nextAction(x);
            }
            if (sort.key === "stage") {
              return x.stage;
            }
            if (sort.key === "role") {
              return x.role;
            }
            if (sort.key === "applied") {
              return x.applied;
            }
            if (sort.key === "updated") {
              return x.updated;
            }
            return String(x[sort.key as keyof Application] || "");
          };
          return get(a).localeCompare(get(b)) * (sort.asc ? 1 : -1);
        }),
    [store, query, tab, stage, sort, includeInactive],
  );
  const safePage = Math.min(page, Math.max(0, Math.ceil(results.length / rowsPerPage) - 1));
  const changeSort = (key: string) => setSort((s) => ({ key, asc: s.key === key ? !s.asc : true }));
  const rows = results.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage);
  return (
    <section className={`applications-panel ${compact ? "compact-panel" : ""}`}>
      <div className="panel-title-row">
        <div>
          <h2>
            {companyId
              ? `Applications (${results.length})`
              : compact
                ? "Your applications"
                : "Application pipeline"}
            <span className="small-count">
              {companyId
                ? store.applications.filter((a) => a.companyId === companyId).length
                : store.applications.length}
            </span>
          </h2>
          {compact && !companyId && <p>Keep every opportunity moving forward.</p>}
          {companyId && <p>All roles tracked at this company.</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Table options"
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <MoreHorizontal size={19} />
        </button>
      </div>
      <div className="table-tabs">
        {["Active", "All", "Archived"].map((t) => {
          const appList = companyId
            ? store.applications.filter((a) => a.companyId === companyId)
            : store.applications;
          return (
            <button className={tab === t ? "selected" : ""} key={t} onClick={() => setTab(t)}>
              {t}
              <span>
                {t === "All"
                  ? appList.length
                  : t === "Active"
                    ? appList.filter(isActive).length
                    : appList.filter((a) => !isActive(a)).length}
              </span>
            </button>
          );
        })}
        <div className="table-view-label">
          <span className="view-table-icon">
            <i />
            <i />
            <i />
          </span>
          Table view
        </div>
      </div>
      <div className="table-toolbar">
        <label className="search-field">
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search applications..."
            aria-label="Search applications"
          />
          {query ? (
            <button className="clear-search" onClick={() => onQuery("")} aria-label="Clear search">
              <X size={13} />
            </button>
          ) : (
            <kbd>⌕</kbd>
          )}
        </label>
        <div className="table-toolbar-actions">
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              color: "#747d68",
              cursor: "pointer",
              userSelect: "none",
              marginRight: "6px",
            }}
          >
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              style={{ cursor: "pointer", accentColor: "#6c8452" }}
            />
            <span>Show offers & archived</span>
          </label>
          <label className={`filter-select ${stage !== "All stages" ? "filter-selected" : ""}`}>
            <ListFilter size={14} />
            <span>{stage}</span>
            <ChevronDown size={12} />
            <select
              aria-label="Filter by stage"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option>All stages</option>
              {stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <button
            className={`button sort-button ${sort.key !== "default" ? "sort-active" : ""}`}
            onClick={() => changeSort("updated")}
          >
            <ArrowDownUp size={14} />
            <span>Sort</span>
          </button>
        </div>
      </div>
      {filterOpen && (
        <div className="table-options">
          <span>Quick view</span>
          <button
            onClick={() => {
              setTab("Active");
              setStage("Interview");
              setFilterOpen(false);
            }}
          >
            Interviewing
          </button>
          <button
            onClick={() => {
              setTab("Active");
              setStage("Offer");
              setFilterOpen(false);
            }}
          >
            Offers
          </button>
          <button
            onClick={() => {
              setStage("All stages");
              setSort({ key: "default", asc: true });
              onQuery("");
              setFilterOpen(false);
            }}
          >
            Reset filters
          </button>
        </div>
      )}
      <div className="table-scroll">
        <table className="applications-table">
          <thead>
            <tr>
              {[
                { label: "Company", key: "company" },
                { label: "Role", key: "role" },
                { label: "Stage", key: "stage" },
                { label: "Next action", key: "action" },
                { label: "Applied", key: "applied" },
                { label: "Updated", key: "updated" },
              ].map((h) => (
                <th key={h.key}>
                  <button onClick={() => changeSort(h.key)}>
                    {h.label}
                    <ChevronDown className={sort.key === h.key ? "sort-visible" : ""} size={11} />
                  </button>
                </th>
              ))}
              <th className="row-arrow-head" />
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const c = store.companies.find((c) => c.id === a.companyId)!;
              const action = nextAction(a);
              const due = a.stage === "Applied" && !a.followUpDone && followUpDate(a) <= isoDate();
              return (
                <tr key={a.id} onClick={() => onOpen(a.id)}>
                  <td>
                    <button
                      className="company-cell"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(a.id);
                      }}
                    >
                      <CompanyLogo name={c.name} color={c.color} size={31} />
                      <strong>{c.name}</strong>
                    </button>
                  </td>
                  <td className="role-cell">
                    {a.role}
                    <span>{a.mode}</span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <StageBadge stage={a.stage} onChange={(s) => onStage(a.id, s)} />
                  </td>
                  <td>
                    <span className={`next-action ${due ? "action-due" : ""}`}>
                      <span className="action-icon">
                        {due ? (
                          <Clock3 size={12} />
                        ) : a.stage === "Offer" ? (
                          <Sparkles size={12} />
                        ) : a.stage === "Interview" ? (
                          <CalendarDays size={12} />
                        ) : (
                          <span className="tiny-dot" />
                        )}
                      </span>
                      <span>{action}</span>
                    </span>
                  </td>
                  <td className="date-cell">{formatDate(a.applied)}</td>
                  <td className="date-cell" title={formatDate(a.updated)}>
                    {relativeLastUpdated(a.updated)}
                  </td>
                  <td>
                    <button className="row-arrow" aria-label={`Open ${c.name} ${a.role}`}>
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!results.length && (
        <Empty
          title="A clean slate"
          description={
            query || stage !== "All stages"
              ? "No applications match those filters. Try broadening your search."
              : "Your next chapter starts with one application."
          }
          action={
            <button className="text-link" onClick={onAdd}>
              Add an application <Plus size={14} />
            </button>
          }
        />
      )}
      <div className="table-footer">
        <span>
          Showing{" "}
          <strong>
            {results.length ? safePage * rowsPerPage + 1 : 0}–
            {Math.min((safePage + 1) * rowsPerPage, results.length)}
          </strong>{" "}
          of <strong>{results.length}</strong> applications
        </span>
        <div className="pagination">
          <button
            disabled={safePage === 0}
            aria-label="Previous page"
            onClick={() => setPage(Math.max(0, safePage - 1))}
          >
            <ChevronLeft size={14} />
          </button>
          {Array.from({ length: Math.max(1, Math.ceil(results.length / rowsPerPage)) }, (_, i) => (
            <button className={safePage === i ? "current" : ""} onClick={() => setPage(i)} key={i}>
              {i + 1}
            </button>
          ))}
          <button
            disabled={(safePage + 1) * rowsPerPage >= results.length}
            aria-label="Next page"
            onClick={() => setPage(safePage + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
function Upcoming({
  store,
  onOpen,
  onAll,
}: {
  store: Store;
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  const rounds = store.applications
    .filter(isActive)
    .flatMap((a) => a.rounds.filter((r) => r.status === "Upcoming").map((r) => ({ ...r, app: a })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  return (
    <section className="side-panel upcoming-panel">
      <div className="side-panel-heading">
        <h2>
          <CalendarDays size={16} />
          Coming up
        </h2>
        <span className="small-count">{rounds.length}</span>
      </div>
      <p className="side-subtitle">A little prep goes a long way.</p>
      <div className="upcoming-list">
        {rounds.map((r, i) => {
          const company = store.companies.find((c) => c.id === r.app.companyId)!;
          return (
            <button
              className={`upcoming-card ${i === 0 ? "upcoming-first" : ""}`}
              key={r.id}
              onClick={() => onOpen(r.app.id)}
            >
              <div className="upcoming-date">
                <span>
                  <span className={`event-dot event-${i}`} />
                  {dayLabel(r.date)}
                </span>
                <span>
                  {new Date(r.date).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="upcoming-company">
                <CompanyLogo name={company.name} color={company.color} size={31} />
                <div>
                  <strong>
                    {r.type === "Technical"
                      ? "Technical interview"
                      : r.type === "HLD"
                        ? "System design"
                        : r.type}
                  </strong>
                  <span>
                    {company.name} <i>·</i> {r.app.role}
                  </span>
                </div>
              </div>
              <div className="prep-link">
                <FileText size={12} />
                Review your prep notes
                <ArrowUpRight size={12} />
              </div>
            </button>
          );
        })}
        {!rounds.length && (
          <p className="side-subtitle no-rounds">
            No interviews scheduled yet.
            <br />
            Your next conversation is out there.
          </p>
        )}
      </div>
      <button className="side-panel-footer" onClick={onAll}>
        View all upcoming <ArrowRight size={14} />
      </button>
    </section>
  );
}
function BoardWidget({
  boards,
  onCheck,
  onAll,
}: {
  boards: Board[];
  onCheck: (id: string) => void;
  onAll: () => void;
}) {
  return (
    <section className="side-panel boards-widget">
      <div className="side-panel-heading">
        <h2>
          <Globe size={16} />
          Your job boards
        </h2>
        <button className="icon-button" aria-label="Manage job boards" onClick={onAll}>
          <ArrowUpRight size={16} />
        </button>
      </div>
      <p className="side-subtitle">Keep your opportunity radar on.</p>
      <div>
        {boards.slice(0, 3).map((b) => (
          <div className="board-widget-row" key={b.id}>
            <a href={b.url} target="_blank" rel="noreferrer" className="board-widget-name">
              <span className={`mini-board-logo ${b.id}`} style={{ color: b.color }}>
                {b.name === "LinkedIn" ? "in" : b.name === "Wellfound" ? "w." : b.name[0]}
              </span>
              <span>
                <strong>{b.name}</strong>
                <small className={boardDue(b) ? "board-due" : ""}>
                  {boardDue(b) ? "Due for a check-in" : "You’re up to date"}
                </small>
              </span>
            </a>
            <button
              className={`board-check ${!boardDue(b) ? "checked" : ""}`}
              title={`Mark ${b.name} checked`}
              aria-label={`Mark ${b.name} checked`}
              onClick={() => onCheck(b.id)}
            >
              <Check size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="board-widget-tip">
        <Bell size={12} />
        <span>A gentle nudge when it’s time to look.</span>
      </div>
    </section>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BriefcaseBusiness size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function ModalFrame({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const dialog = ref.current;
    const focusables = () => [
      ...(dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input, select, textarea, a[href], [tabindex="0"]',
      ) || []),
    ];
    const firstInput = dialog?.querySelector<HTMLElement>("input, textarea") || focusables()[0];
    firstInput?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (e.shiftKey && document.activeElement === items[0]) {
        e.preventDefault();
        items[items.length - 1]?.focus();
      }
      if (!e.shiftKey && document.activeElement === items[items.length - 1]) {
        e.preventDefault();
        items[0]?.focus();
      }
    };
    dialog?.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <span className="modal-brand">
            <HoundMark size={30} />
          </span>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <h2 id="modal-title">{title}</h2>
        {subtitle && <p className="modal-subtitle">{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}
function ApplicationModal({
  companies,
  initialCompany,
  onClose,
  onSave,
}: {
  companies: Company[];
  initialCompany: string;
  onClose: () => void;
  onSave: (a: Application, c?: Company) => void;
}) {
  const [companyName, setCompanyName] = useState(initialCompany);
  const [role, setRole] = useState("");
  const [stage, setStage] = useState<Stage>("Applied");
  const [showMore, setShowMore] = useState(false);
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("Company website");
  const [location, setLocation] = useState("");
  const [mode, setMode] = useState("Full-time");
  const [applied, setApplied] = useState(isoDate());
  const [resume, setResume] = useState("");
  const [action, setAction] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !role.trim()) return;
    const existing = companies.find(
      (c) => c.name.trim().toLowerCase() === companyName.trim().toLowerCase(),
    );
    const company: Company = existing || {
      id: uid(),
      name: companyName.trim(),
      domain: url ? new URL(url).hostname : "",
      color: ["#6962dd", "#dd7949", "#438d76", "#3c7cc2"][companies.length % 4],
      description: "",
      notes: "",
    };
    onSave(
      {
        id: uid(),
        companyId: company.id,
        role: role.trim(),
        location,
        mode,
        source,
        stage,
        applied: applied || isoDate(),
        updated: isoDate(),
        url,
        resume,
        nextAction: action,
        rounds: [],
        offer: "",
        joining: "",
        rejection: "",
        topics: "",
      },
      existing ? undefined : company,
    );
  };
  return (
    <ModalFrame
      wide
      title="A new possibility."
      subtitle="Add an application. We’ll help you keep it moving."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <label className="full-width">
            Company <span>*</span>
            <input
              required
              autoFocus
              list="company-suggestions"
              placeholder="e.g. Linear"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <datalist id="company-suggestions">
              {companies.map((c) => (
                <option value={c.name} key={c.id} />
              ))}
            </datalist>
          </label>
          <label>
            Role <span>*</span>
            <input
              required
              placeholder="e.g. Frontend Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
          <label>
            Status
            <select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
              {stages.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <div className="full-width" style={{ marginTop: "4px" }}>
            <button
              type="button"
              className="text-link"
              onClick={() => setShowMore(!showMore)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 600,
                color: "#6c8452",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              <ChevronDown
                size={14}
                style={{
                  transform: showMore ? "rotate(180deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
              />
              {showMore ? "Fewer details" : "More details"}
            </button>
          </div>

          {showMore && (
            <>
              <label className="full-width">
                Job posting URL
                <input
                  type="url"
                  placeholder="https://company.com/careers/your-next-role"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              <label>
                Source
                <select value={source} onChange={(e) => setSource(e.target.value)}>
                  {[
                    "Company website",
                    "LinkedIn",
                    "Wellfound",
                    "Referral",
                    "Recruiter",
                    "Other",
                  ].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <input
                  placeholder="e.g. San Francisco or Remote"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
              <label>
                Work mode
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option>Full-time</option>
                  <option>Internship</option>
                </select>
              </label>
              <label>
                Applied date
                <input
                  type="date"
                  value={applied}
                  onChange={(e) => setApplied(e.target.value)}
                />
              </label>
              <label className="full-width">
                Resume used
                <input
                  placeholder="e.g. Resume_Frontend.pdf"
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                />
              </label>
              <label className="full-width">
                Next action <span className="optional">Optional</span>
                <input
                  placeholder="Leave blank to let Hound work it out"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                />
                <small>We’ll automatically remind you to follow up 7 days after applying.</small>
              </label>
            </>
          )}
        </div>
        <div className="modal-footer">
          <span>
            <ShieldCheck size={13} />
            Saved only on this device
          </span>
          <div>
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button primary" type="submit">
              <Plus size={15} />
              Add application
            </button>
          </div>
        </div>
      </form>
    </ModalFrame>
  );
}
function MarkdownEditor({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [preview, setPreview] = useState(false);
  return (
    <div className="markdown-editor">
      <div className="markdown-toolbar">
        <label>{label}</label>
        <div className="segmented">
          <button
            type="button"
            className={!preview ? "selected" : ""}
            onClick={() => setPreview(false)}
          >
            Write
          </button>
          <button
            type="button"
            className={preview ? "selected" : ""}
            onClick={() => setPreview(true)}
          >
            Preview
          </button>
        </div>
      </div>
      {preview ? (
        <div className="markdown-preview">
          {value ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="muted">Nothing here yet. Every good note starts somewhere.</p>
          )}
        </div>
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Capture a thought… Markdown is supported."}
          rows={5}
        />
      )}
      <div className="markdown-hint">
        <FileText size={11} />
        Markdown supported<span>**bold** · *italic* · # heading · - list</span>
      </div>
    </div>
  );
}
function ApplicationDetail({
  application: a,
  company,
  onBack,
  onUpdate,
  onCompany,
  onDelete,
}: {
  application: Application;
  company: Company;
  onBack: () => void;
  onUpdate: (patch: Partial<Application>) => void;
  onCompany: () => void;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState("Overview");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(a);
  const [roundEditor, setRoundEditor] = useState<Round | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const set = (key: keyof Application, value: string) => setDraft((s) => ({ ...s, [key]: value }));
  useEffect(() => {
    setDraft(a);
  }, [a]);
  const addRound = () =>
    setRoundEditor({
      id: uid(),
      type: "Technical",
      date: `${isoDate(1)}T10:00`,
      status: "Upcoming",
      nextAction: "",
      resume: a.resume,
      prep: "",
      notes: "",
    });
  return (
    <div className="detail-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to applications
      </button>
      <div className="detail-heading">
        <div className="detail-heading-main">
          <CompanyLogo name={company.name} color={company.color} size={58} />
          <div>
            <button className="company-name-link" onClick={onCompany}>
              {company.name}
              <ArrowUpRight size={13} />
            </button>
            <h1>{a.role}</h1>
            <div className="detail-meta">
              <span>
                <MapPin size={14} />
                {a.location || "Location not specified"}
              </span>
              <span>
                <BriefcaseBusiness size={14} />
                {a.mode}
              </span>
              <span>
                <CalendarDays size={14} />
                Applied {formatDate(a.applied)}
              </span>
            </div>
          </div>
        </div>
        <StageBadge stage={a.stage} onChange={(stage) => onUpdate({ stage })} />
      </div>
      <div className="detail-tabs">
        {["Overview", "Rounds & timeline", "Outcome"].map((t) => (
          <button className={tab === t ? "selected" : ""} key={t} onClick={() => setTab(t)}>
            {t}
            {t === "Rounds & timeline" && <span className="small-count">{a.rounds.length}</span>}
          </button>
        ))}
      </div>
      {tab === "Overview" && (
        <div className="detail-grid">
          <div className="detail-main">
            <section className="content-card">
              <div className="card-heading">
                <h2>Application overview</h2>
                <button
                  className="text-link"
                  onClick={() => {
                    setEditing(!editing);
                    setDraft(a);
                  }}
                >
                  {editing ? "Cancel editing" : "Edit details"}
                  <Settings2 size={14} />
                </button>
              </div>
              {editing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onUpdate(draft);
                    setEditing(false);
                  }}
                >
                  <div className="form-grid">
                    <label>
                      Role
                      <input
                        required
                        value={draft.role}
                        onChange={(e) => set("role", e.target.value)}
                      />
                    </label>
                    <label>
                      Location
                      <input
                        value={draft.location}
                        onChange={(e) => set("location", e.target.value)}
                      />
                    </label>
                    <label>
                      Work mode
                      <select value={draft.mode} onChange={(e) => set("mode", e.target.value)}>
                        <option>Full-time</option>
                        <option>Internship</option>
                      </select>
                    </label>
                    <label>
                      Source
                      <input value={draft.source} onChange={(e) => set("source", e.target.value)} />
                    </label>
                    <label>
                      Applied date
                      <input
                        type="date"
                        required
                        value={draft.applied}
                        onChange={(e) => set("applied", e.target.value)}
                      />
                    </label>
                    <label>
                      Resume used
                      <input value={draft.resume} onChange={(e) => set("resume", e.target.value)} />
                    </label>
                    <label className="full-width">
                      Posting URL
                      <input
                        type="url"
                        value={draft.url}
                        onChange={(e) => set("url", e.target.value)}
                      />
                    </label>
                    <label className="full-width">
                      Manual next action
                      <input
                        placeholder="Leave blank to derive from rounds and follow-ups"
                        value={draft.nextAction}
                        onChange={(e) => set("nextAction", e.target.value)}
                      />
                      <small>A manual value takes priority over automatic next actions.</small>
                    </label>
                  </div>
                  <div className="form-save">
                    <button className="button primary" type="submit">
                      <Check size={15} />
                      Save changes
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="overview-details">
                  {[
                    ["Role", a.role],
                    ["Location", a.location || "Not specified"],
                    ["Work mode", a.mode],
                    ["Source", a.source],
                    [
                      "Applied date",
                      formatDate(a.applied, { month: "long", day: "numeric", year: "numeric" }),
                    ],
                    ["Resume used", a.resume || "Not added"],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>
                        {label === "Resume used" && <FileText size={14} />} {val}
                      </dd>
                    </div>
                  ))}
                  <div className="full-width">
                    <dt>Job posting</dt>
                    <dd>
                      {a.url ? (
                        <a className="text-link" href={a.url} target="_blank" rel="noreferrer">
                          {a.url}
                          <ExternalLink size={13} />
                        </a>
                      ) : (
                        "Not added"
                      )}
                    </dd>
                  </div>
                </dl>
              )}
            </section>
            <section className="content-card">
              <div className="card-heading">
                <h2>About {company.name}</h2>
                <button className="text-link" onClick={onCompany}>
                  Company page
                  <ArrowUpRight size={14} />
                </button>
              </div>
              <p className="company-overview">
                {company.description ||
                  "Get to know this team. Add an overview on the company page."}
              </p>
              {company.domain && (
                <a
                  className="text-link"
                  href={`https://${company.domain}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Globe size={14} />
                  {company.domain}
                  <ExternalLink size={12} />
                </a>
              )}
            </section>
          </div>
          <aside>
            <section className="content-card next-step-card">
              <span className="stat-icon peach">
                <Zap size={18} />
              </span>
              <h3>Your next small step</h3>
              <p>{nextAction(a)}</p>
              <small>
                {a.nextAction
                  ? "Set by you. Edit details to change it."
                  : "Automatically based on your timeline."}
              </small>
              <button className="text-link warm" onClick={() => setTab("Rounds & timeline")}>
                View timeline
                <ArrowRight size={14} />
              </button>
            </section>
            <section className="content-card detail-activity">
              <h3>At a glance</h3>
              <div>
                <span>Added to your journey</span>
                <strong>{formatDate(a.applied)}</strong>
              </div>
              <div>
                <span>Last updated</span>
                <strong>{dayLabel(a.updated)}</strong>
              </div>
              <div>
                <span>Interview rounds</span>
                <strong>{a.rounds.length}</strong>
              </div>
            </section>
            <button className="delete-application" onClick={() => setDeleteConfirm(true)}>
              <Trash2 size={13} />
              Delete application
            </button>
          </aside>
        </div>
      )}
      {tab === "Rounds & timeline" && (
        <section className="content-card timeline-card">
          <div className="card-heading">
            <div>
              <h2>Every conversation, in one place.</h2>
              <p className="muted small">Prepare thoughtfully. Reflect while it’s fresh.</p>
            </div>
            <button className="button primary" onClick={addRound}>
              <Plus size={15} />
              Add round
            </button>
          </div>
          <div className="timeline">
            <div className="timeline-item applied-event">
              <span className="timeline-marker">
                <Check size={15} />
              </span>
              <div>
                <span className="timeline-date">{formatDate(a.applied)}</span>
                <h3>Application sent</h3>
                <p>Your next chapter started with a click.</p>
              </div>
            </div>
            {a.rounds
              .slice()
              .sort((x, y) => x.date.localeCompare(y.date))
              .map((r, i) => (
                <div className={`timeline-item ${r.status.toLowerCase()}`} key={r.id}>
                  <span className="timeline-marker">
                    {r.status === "Completed" ? (
                      <Check size={15} />
                    ) : r.status === "Cancelled" ? (
                      <X size={15} />
                    ) : (
                      <CalendarDays size={15} />
                    )}
                  </span>
                  <div className="timeline-round">
                    <div className="timeline-round-top">
                      <div>
                        <span className="timeline-date">
                          {formatDate(r.date)} ·{" "}
                          {new Date(r.date).toLocaleTimeString([], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                        <h3>
                          {r.type} <span className="round-number">Round {i + 1}</span>
                        </h3>
                      </div>
                      <span className={`round-status ${r.status.toLowerCase()}`}>{r.status}</span>
                      <button
                        className="button secondary small-button"
                        onClick={() => setRoundEditor(r)}
                      >
                        Edit round
                      </button>
                    </div>
                    {r.nextAction && (
                      <p className="round-action">
                        <ArrowRight size={13} />
                        {r.nextAction}
                      </p>
                    )}
                    {r.prep && (
                      <div className="timeline-note">
                        <strong>PREP NOTES</strong>
                        <div className="markdown-preview">
                          <ReactMarkdown>{r.prep}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                    {r.notes && (
                      <div className="timeline-note">
                        <strong>INTERVIEW NOTES</strong>
                        <div className="markdown-preview">
                          <ReactMarkdown>{r.notes}</ReactMarkdown>
                        </div>
                      </div>
                    )}
                    {r.resume && (
                      <span className="round-resume">
                        <FileText size={13} />
                        {r.resume}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
          {!a.rounds.length && (
            <Empty
              title="Your story is still unfolding"
              description="Add an assessment, interview, or follow-up to start your timeline."
              action={
                <button className="button secondary" onClick={addRound}>
                  <Plus size={15} />
                  Add your first round
                </button>
              }
            />
          )}
        </section>
      )}
      {tab === "Outcome" && <Outcome application={a} onSave={onUpdate} />}
      {roundEditor && (
        <RoundModal
          round={roundEditor}
          onClose={() => setRoundEditor(null)}
          onSave={(round) => {
            onUpdate({
              rounds: a.rounds.some((r) => r.id === round.id)
                ? a.rounds.map((r) => (r.id === round.id ? round : r))
                : [...a.rounds, round],
            });
            setRoundEditor(null);
          }}
          onDelete={
            a.rounds.some((r) => r.id === roundEditor.id)
              ? () => {
                  onUpdate({ rounds: a.rounds.filter((r) => r.id !== roundEditor.id) });
                  setRoundEditor(null);
                }
              : undefined
          }
        />
      )}
      {deleteConfirm && (
        <ModalFrame
          title="Remove this application?"
          subtitle="This application and all of its interview notes will be permanently removed. The company will stay in your shortlist."
          onClose={() => setDeleteConfirm(false)}
        >
          <div className="confirm-actions">
            <button className="button secondary" onClick={() => setDeleteConfirm(false)}>
              Keep application
            </button>
            <button className="button danger" onClick={onDelete}>
              <Trash2 size={15} />
              Delete application
            </button>
          </div>
        </ModalFrame>
      )}
    </div>
  );
}
function RoundModal({
  round,
  onClose,
  onSave,
  onDelete,
}: {
  round: Round;
  onClose: () => void;
  onSave: (r: Round) => void;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState(round);
  const set = (key: keyof Round, value: string) => setDraft((s) => ({ ...s, [key]: value }));
  return (
    <ModalFrame
      wide
      title={onDelete ? "Make the most of this round." : "Your next conversation."}
      subtitle="A little preparation makes a big difference."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <div className="form-grid">
          <label>
            Round type
            <select value={draft.type} onChange={(e) => set("type", e.target.value)}>
              {roundTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Date & time
            <input
              type="datetime-local"
              required
              value={draft.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </label>
          <label>
            Status
            <select value={draft.status} onChange={(e) => set("status", e.target.value)}>
              <option>Upcoming</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </label>
          <label>
            Resume used
            <input value={draft.resume} onChange={(e) => set("resume", e.target.value)} />
          </label>
          <label className="full-width">
            Next action
            <input
              placeholder="e.g. Review React performance patterns"
              value={draft.nextAction}
              onChange={(e) => set("nextAction", e.target.value)}
            />
          </label>
          <div className="full-width">
            <MarkdownEditor
              label="Prep notes"
              value={draft.prep}
              onChange={(v) => set("prep", v)}
              placeholder="## Before the conversation&#10;- Topics to review&#10;- Questions to ask"
            />
          </div>
          <div className="full-width">
            <MarkdownEditor
              label="Interview notes"
              value={draft.notes}
              onChange={(v) => set("notes", v)}
              placeholder="What came up? How did it go? What would you do differently?"
            />
          </div>
        </div>
        <div className="modal-footer">
          {onDelete ? (
            <button
              type="button"
              className="text-link danger-text"
              onClick={() => {
                if (confirm("Delete this round and its notes?")) onDelete();
              }}
            >
              <Trash2 size={14} />
              Delete round
            </button>
          ) : (
            <span>
              <ShieldCheck size={13} />
              Just for you
            </span>
          )}
          <div>
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary">
              <Check size={15} />
              Save round
            </button>
          </div>
        </div>
      </form>
    </ModalFrame>
  );
}
function Outcome({
  application,
  onSave,
}: {
  application: Application;
  onSave: (patch: Partial<Application>) => void;
}) {
  const [draft, setDraft] = useState(application);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="content-card outcome-card"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          offer: draft.offer,
          joining: draft.joining,
          rejection: draft.rejection,
          topics: draft.topics,
        });
        setSaved(true);
      }}
    >
      <div className="card-heading">
        <div>
          <h2>Every experience brings something.</h2>
          <p className="muted small">Capture the outcome, and what you learned along the way.</p>
        </div>
        <span className="stat-icon green">
          <Target size={20} />
        </span>
      </div>
      <div className="form-grid">
        <label className="full-width">
          Offer package
          <textarea
            rows={3}
            placeholder="Base salary, equity, signing bonus, and the little extras..."
            value={draft.offer}
            onChange={(e) => {
              setDraft((s) => ({ ...s, offer: e.target.value }));
              setSaved(false);
            }}
          />
        </label>
        <label>
          Joining date
          <input
            type="date"
            value={draft.joining}
            onChange={(e) => {
              setDraft((s) => ({ ...s, joining: e.target.value }));
              setSaved(false);
            }}
          />
        </label>
        <label>
          Rejection reason
          <input
            placeholder="If things didn’t work out, what happened?"
            value={draft.rejection}
            onChange={(e) => {
              setDraft((s) => ({ ...s, rejection: e.target.value }));
              setSaved(false);
            }}
          />
        </label>
        <div className="full-width">
          <MarkdownEditor
            label="Technical topics asked"
            value={draft.topics}
            onChange={(v) => {
              setDraft((s) => ({ ...s, topics: v }));
              setSaved(false);
            }}
            placeholder="- React rendering and hooks&#10;- System design trade-offs&#10;- Data structures and algorithms"
          />
        </div>
      </div>
      <div className="form-save">
        <button className="button primary" type="submit">
          <Check size={15} />
          {saved ? "Saved" : "Save outcome"}
        </button>
      </div>
    </form>
  );
}
function CompanyDetail({
  company,
  store,
  onBack,
  onOpen,
  onSave,
  onStage,
  onAdd,
}: {
  company: Company;
  store: Store;
  onBack: () => void;
  onOpen: (id: string) => void;
  onSave: (patch: Partial<Company>) => boolean | void;
  onStage: (id: string, stage: Stage) => void;
  onAdd: () => void;
}) {
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(company.name);
  const [overview, setOverview] = useState(company.description);
  const [notes, setNotes] = useState(company.notes);
  const [tableQuery, setTableQuery] = useState("");
  const [nameError, setNameError] = useState("");
  const [savedOverview, setSavedOverview] = useState(false);
  const [savedNotes, setSavedNotes] = useState(false);

  useEffect(() => {
    setName(company.name);
    setOverview(company.description);
    setNotes(company.notes);
    setNameError("");
  }, [company]);

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Company name cannot be empty.");
      return;
    }
    const success = onSave({ name: trimmed });
    if (success !== false) {
      setEditingName(false);
      setNameError("");
    }
  };

  return (
    <div className="detail-page">
      <button className="back-link" onClick={onBack}>
        <ArrowLeft size={15} />
        Back to companies
      </button>
      <div className="detail-heading">
        <div className="detail-heading-main">
          <CompanyLogo name={company.name} color={company.color} size={58} />
          <div>
            {editingName ? (
              <form onSubmit={handleNameSubmit} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setNameError("");
                    }}
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: "1px solid #c07a4e",
                      color: "#4a5141",
                    }}
                  />
                  <button className="button primary" type="submit" style={{ padding: "5px 10px", fontSize: "11px" }}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setName(company.name);
                      setEditingName(false);
                      setNameError("");
                    }}
                    style={{ padding: "5px 10px", fontSize: "11px" }}
                  >
                    Cancel
                  </button>
                </div>
                {nameError && (
                  <span style={{ color: "#d9534f", fontSize: "11px", fontWeight: 500 }}>{nameError}</span>
                )}
              </form>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1>{company.name}</h1>
                <button
                  className="icon-button"
                  aria-label="Rename company"
                  title="Rename company"
                  onClick={() => setEditingName(true)}
                >
                  <Settings2 size={16} />
                </button>
              </div>
            )}
            {company.domain && (
              <a
                className="text-link"
                href={`https://${company.domain}`}
                target="_blank"
                rel="noreferrer"
              >
                {company.domain}
                <ExternalLink size={13} />
              </a>
            )}
          </div>
        </div>
        <button className="button primary" onClick={onAdd}>
          <Plus size={15} />
          Add application
        </button>
      </div>

      <div className="company-detail-grid">
        <section className="content-card">
          <div className="card-heading">
            <h2>Company overview</h2>
            {savedOverview && <span className="muted small" style={{ color: "#6c8452" }}>Saved</span>}
          </div>
          <p className="muted small" style={{ marginBottom: "10px" }}>
            Add an overview to keep key context in one place.
          </p>
          <textarea
            rows={5}
            placeholder="What does this company do? Team culture, size, mission..."
            value={overview}
            onChange={(e) => {
              setOverview(e.target.value);
              setSavedOverview(false);
            }}
            style={{ width: "100%", resize: "vertical" }}
          />
          <div className="form-save" style={{ marginTop: "10px" }}>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                onSave({ description: overview });
                setSavedOverview(true);
              }}
            >
              <Check size={14} />
              Save overview
            </button>
          </div>
        </section>

        <section className="content-card">
          <div className="card-heading">
            <h2>Your notes</h2>
            {savedNotes && <span className="muted small" style={{ color: "#6c8452" }}>Saved</span>}
          </div>
          <p className="muted small" style={{ marginBottom: "10px" }}>
            Thoughts, interviewers, referrals, or preparation ideas.
          </p>
          <textarea
            rows={5}
            placeholder="Private notes about this company..."
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              setSavedNotes(false);
            }}
            style={{ width: "100%", resize: "vertical" }}
          />
          <div className="form-save" style={{ marginTop: "10px" }}>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                onSave({ notes });
                setSavedNotes(true);
              }}
            >
              <Check size={14} />
              Save notes
            </button>
          </div>
        </section>
      </div>

      <div style={{ marginTop: "24px" }}>
        <ApplicationsTable
          store={store}
          query={tableQuery}
          onQuery={setTableQuery}
          onOpen={onOpen}
          onStage={onStage}
          onAdd={onAdd}
          companyId={company.id}
        />
      </div>
    </div>
  );
}
function Reminders({
  store,
  onOpen,
  onFollowUp,
  onCheck,
}: {
  store: Store;
  onOpen: (id: string) => void;
  onFollowUp: (id: string) => void;
  onCheck: (id: string) => void;
}) {
  const upcoming = store.applications
    .filter(isActive)
    .flatMap((a) =>
      a.rounds.filter((r) => r.status === "Upcoming").map((r) => ({ app: a, round: r })),
    )
    .sort((a, b) => a.round.date.localeCompare(b.round.date));
  const followups = store.applications
    .filter((a) => a.stage === "Applied" && !a.followUpDone)
    .sort((a, b) => a.applied.localeCompare(b.applied));
  return (
    <div className="reminders-grid">
      <section className="content-card">
        <div className="card-heading">
          <h2>
            <CalendarDays size={17} />
            Upcoming conversations <span className="small-count">{upcoming.length}</span>
          </h2>
        </div>
        {upcoming.map(({ app, round }) => {
          const c = store.companies.find((c) => c.id === app.companyId)!;
          return (
            <button className="reminder-round-row" onClick={() => onOpen(app.id)} key={round.id}>
              <div className="calendar-block">
                <span>{new Date(round.date).toLocaleDateString("en-US", { month: "short" })}</span>
                <strong>{new Date(round.date).getDate()}</strong>
              </div>
              <div>
                <h3>
                  {round.type} · {c.name}
                </h3>
                <p>{app.role}</p>
                <span>
                  {dayLabel(round.date)} at{" "}
                  {new Date(round.date).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <ArrowUpRight size={17} />
            </button>
          );
        })}
        {!upcoming.length && (
          <Empty
            title="Room for good things"
            description="Add an interview round to see it here."
          />
        )}
      </section>
      <div>
        <section className="content-card">
          <div className="card-heading">
            <h2>
              <Clock3 size={17} />
              Follow-ups<span className="small-count">{followups.length}</span>
            </h2>
          </div>
          <p className="muted small reminder-intro">A friendly follow-up, 7 days after applying.</p>
          {followups.map((a) => {
            const c = store.companies.find((c) => c.id === a.companyId)!;
            return (
              <div className="followup-row" key={a.id}>
                <CompanyLogo name={c.name} color={c.color} size={32} />
                <button className="followup-main" onClick={() => onOpen(a.id)}>
                  <strong>{c.name}</strong>
                  <span>{a.role}</span>
                </button>
                <span className={`followup-due ${followUpDate(a) <= isoDate() ? "is-due" : ""}`}>
                  {dayLabel(followUpDate(a))}
                </span>
                <button
                  className="board-check"
                  aria-label={`Complete follow-up for ${c.name}`}
                  onClick={() => onFollowUp(a.id)}
                >
                  <Check size={15} />
                </button>
              </div>
            );
          })}
          {!followups.length && <p className="muted small">All followed up. You’re doing great.</p>}
        </section>
        <section className="content-card reminder-boards">
          <div className="card-heading">
            <h2>
              <Globe size={17} />
              Job board check-ins
            </h2>
          </div>
          {store.boards.filter(boardDue).map((b) => (
            <div className="followup-row" key={b.id}>
              <span className="mini-board-logo" style={{ color: b.color }}>
                {b.name[0]}
              </span>
              <div className="followup-main">
                <strong>{b.name}</strong>
                <span>
                  Every {b.frequency} {b.frequency === 1 ? "day" : "days"}
                </span>
              </div>
              <span className="followup-due is-due">Due now</span>
              <button
                className="board-check"
                aria-label={`Check ${b.name}`}
                onClick={() => onCheck(b.id)}
              >
                <Check size={15} />
              </button>
            </div>
          ))}
          {!store.boards.some(boardDue) && (
            <p className="muted small">Your opportunity radar is up to date.</p>
          )}
        </section>
      </div>
    </div>
  );
}
function BoardModal({ onClose, onSave }: { onClose: () => void; onSave: (b: Board) => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [frequency, setFrequency] = useState(1);
  return (
    <ModalFrame
      title="Broaden your radar."
      subtitle="Add a favorite place to look for your next role."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: uid(),
            name: name.trim(),
            url,
            frequency,
            checked: new Date().toISOString(),
            color: "#cf7048",
          });
        }}
      >
        <div className="form-grid single-column">
          <label>
            Job board name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work at a Startup"
            />
          </label>
          <label>
            Website URL
            <input
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label>
            Check-in frequency
            <select value={frequency} onChange={(e) => setFrequency(+e.target.value)}>
              {[1, 2, 3, 7, 14].map((n) => (
                <option key={n} value={n}>
                  Every {n === 1 ? "day" : `${n} days`}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="modal-footer">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" type="submit">
            <Plus size={15} />
            Add job board
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
function Settings({
  store,
  setStore,
  notify,
}: {
  store: Store;
  setStore: React.Dispatch<React.SetStateAction<Store>>;
  notify: (s: string, error?: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(store.settings.name);
  const [busy, setBusy] = useState(false);
  const setting = (patch: Partial<Store["settings"]>) =>
    setStore((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const toggleNotifications = async () => {
    if (store.settings.notifications) return setting({ notifications: false });
    if (!window.houndDesktop) {
      if (!("Notification" in window))
        return notify("Native reminders are available in the installed desktop app.", true);
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        return notify(
          "Notifications are blocked. Allow them in your browser settings, or use the desktop app.",
          true,
        );
    }
    setting({ notifications: true });
    notify("Reminders enabled. We’ll give you a gentle nudge.");
  };
  const exportData = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(store, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `hound-backup-${isoDate()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Your workspace backup is ready.");
  };
  const importData = async (file?: File) => {
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!validStore(data)) throw new Error("Invalid backup");
      if (
        !confirm(
          "Replace your current workspace with this backup? Export a backup first if you want to keep your current data.",
        )
      )
        return;
      setStore(data);
      setName(data.settings.name);
      notify("Workspace restored. Welcome back.");
    } catch {
      notify("That file isn’t a valid Hound backup. Your workspace has not changed.", true);
    }
    if (inputRef.current) inputRef.current.value = "";
  };
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your space, your way."
        description="A few preferences to make Hound feel like yours."
      />
      <div className="settings-layout">
        <section className="content-card">
          <div className="card-heading">
            <h2>Personal workspace</h2>
            <span className="stat-icon peach">
              <Settings2 size={18} />
            </span>
          </div>
          <form
            className="name-setting"
            onSubmit={(e) => {
              e.preventDefault();
              setting({ name: name.trim() || "Alex" });
              notify("Looking good. Your name is updated.");
            }}
          >
            <label>
              Your name
              <input
                required
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <button className="button secondary" type="submit">
              Save name
            </button>
          </form>
          <div className="settings-row">
            <div>
              <h3>Native reminders</h3>
              <p>A gentle nudge for interviews, follow-ups, and job boards.</p>
            </div>
            <button
              role="switch"
              aria-checked={store.settings.notifications}
              aria-label="Native reminders"
              className={`toggle ${store.settings.notifications ? "on" : ""}`}
              onClick={toggleNotifications}
            >
              <span />
            </button>
          </div>
          <div className="settings-row">
            <div>
              <h3>Launch on login</h3>
              <p>
                {window.houndDesktop
                  ? "Have Hound ready when your day begins."
                  : "Available in the installed Electron desktop app."}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={store.settings.launchOnLogin}
              aria-label="Launch on login"
              disabled={!window.houndDesktop || busy}
              className={`toggle ${store.settings.launchOnLogin ? "on" : ""}`}
              onClick={async () => {
                setBusy(true);
                try {
                  const enabled = !store.settings.launchOnLogin;
                  await window.houndDesktop!.setLogin(enabled);
                  setting({ launchOnLogin: enabled });
                  notify(
                    enabled ? "Hound will launch when you log in." : "Launch on login disabled.",
                  );
                } catch {
                  notify("This device could not update startup preferences.", true);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <span />
            </button>
          </div>
          <div className="settings-row">
            <div>
              <h3>Global quick-add</h3>
              <p>
                {window.houndDesktop
                  ? "Works even when Hound is tucked away in your tray."
                  : "Works while this preview is focused. Global access is available on desktop."}
              </p>
            </div>
            <span className="key-combo">
              <kbd>Ctrl</kbd>
              <kbd>Shift</kbd>
              <kbd>J</kbd>
            </span>
          </div>
        </section>
        <section className="content-card">
          <div className="card-heading">
            <h2>Your data belongs to you</h2>
            <ShieldCheck size={20} />
          </div>
          <p className="settings-description">
            Everything stays on this device. No cloud, no tracking, no account required. Keep a
            backup somewhere safe.
          </p>
          <div className="settings-row">
            <div>
              <h3>Export your workspace</h3>
              <p>All companies, applications, rounds, notes, and preferences.</p>
            </div>
            <button className="button secondary" onClick={exportData}>
              <Download size={15} />
              Export backup
            </button>
          </div>
          <div className="settings-row">
            <div>
              <h3>Restore from a backup</h3>
              <p>Import a Hound JSON backup to replace this workspace.</p>
            </div>
            <button className="button secondary" onClick={() => inputRef.current?.click()}>
              <Upload size={15} />
              Import backup
            </button>
            <input
              className="hidden"
              ref={inputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => importData(e.target.files?.[0])}
            />
          </div>
          <div className="settings-row">
            <div>
              <h3>Start with a clean slate</h3>
              <p>Remove the example data and make this journey yours.</p>
            </div>
            <button
              className="button secondary danger-text"
              onClick={() => {
                if (
                  confirm(
                    "Clear all applications, companies, and job boards? Export a backup first. This cannot be undone.",
                  )
                ) {
                  const fresh = createSeed();
                  setStore({
                    ...fresh,
                    companies: [],
                    applications: [],
                    boards: [],
                    settings: store.settings,
                  });
                  notify("A fresh start. Your next chapter is yours to write.");
                }
              }}
            >
              Clear workspace
            </button>
          </div>
        </section>
        <div className="settings-about">
          <HoundMark size={33} />
          <div>
            <strong>Hound</strong>
            <span>Your personal job search companion. v1.0</span>
          </div>
          <span className="local-pill">
            <Monitor size={13} />
            {window.houndDesktop ? "Desktop app" : "Browser preview"}
          </span>
        </div>
      </div>
    </>
  );
}
export default App;
