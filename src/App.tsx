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
  Pencil,
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
  deriveClientNextAction,
  followUpDate,
  formatDate,
  formatExternalUrl,
  isActive,
  isoDate,
  nextAction,
  readStore,
  relativeLastUpdated,
  roundTypes,
  safeHostname,
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
import { NoteEditor } from "./NoteEditor";

type Page = "Overview" | "Applications" | "Companies" | "Job boards" | "Reminders" | "Settings";
type Modal = "application" | "board" | "help" | null;
type Toast = { message: string; error?: boolean };
type NoteRoute = {
  applicationId: string;
  roundId: string;
  type: "prep" | "interview";
} | null;

function parseHashRoute(): {
  page?: Page;
  appId?: string;
  companyId?: string;
  noteRoute?: NoteRoute;
} {
  const hash = window.location.hash.replace(/^#\/?/, "");
  const noteMatch = hash.match(/^applications\/([^/]+)\/rounds\/([^/]+)\/(prep|interview)$/i);
  if (noteMatch) {
    return {
      noteRoute: {
        applicationId: noteMatch[1],
        roundId: noteMatch[2],
        type: noteMatch[3].toLowerCase() as "prep" | "interview",
      },
    };
  }
  const appMatch = hash.match(/^applications\/([^/]+)$/i);
  if (appMatch) {
    return { appId: appMatch[1] };
  }
  const compMatch = hash.match(/^companies\/([^/]+)$/i);
  if (compMatch) {
    return { companyId: compMatch[1] };
  }
  const jobBoardMatch = hash.match(/^(job-boards|job%20boards)$/i);
  if (jobBoardMatch) {
    return { page: "Job boards" };
  }
  const remindersMatch = hash.match(/^reminders$/i);
  if (remindersMatch) {
    return { page: "Reminders" };
  }
  return {};
}

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
  const [activeNoteRoute, setActiveNoteRoute] = useState<NoteRoute>(null);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
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

  useEffect(() => {
    const handleHash = () => {
      const parsed = parseHashRoute();
      if (parsed.noteRoute) {
        setActiveNoteRoute(parsed.noteRoute);
        setSelectedApp(parsed.noteRoute.applicationId);
      } else if (parsed.appId) {
        setSelectedApp(parsed.appId);
        setActiveNoteRoute(null);
      } else if (parsed.companyId) {
        setSelectedCompany(parsed.companyId);
        setActiveNoteRoute(null);
      } else if (parsed.page) {
        setPage(parsed.page);
        setSelectedApp(null);
        setSelectedCompany(null);
        setActiveNoteRoute(null);
      }
    };
    handleHash();
    window.addEventListener("hashchange", handleHash);
    const offNavigate = window.houndDesktop?.onNavigateRoute?.((route: string) => {
      window.location.hash = route;
    });
    return () => {
      window.removeEventListener("hashchange", handleHash);
      offNavigate?.();
    };
  }, []);

  const navigate = (next: Page) => {
    setPage(next);
    setSelectedApp(null);
    setSelectedCompany(null);
    setActiveNoteRoute(null);
    setQuery("");
    setMobileNav(false);
    setNotificationsOpen(false);
    window.location.hash = "";
  };
  const updateApplication = (id: string, patch: Partial<Application>) =>
    setStore((s) => ({
      ...s,
      applications: s.applications.map((a) =>
        a.id === id ? { ...a, ...patch, updated: new Date().toISOString() } : a,
      ),
    }));
  const updateApplicationRoundNotes = (
    applicationId: string,
    roundId: string,
    type: "prep" | "interview",
    markdown: string,
  ) => {
    setStore((s) => ({
      ...s,
      applications: s.applications.map((a) => {
        if (a.id !== applicationId) return a;
        return {
          ...a,
          updated: new Date().toISOString(),
          rounds: (a.rounds || []).map((r) => {
            if (r.id !== roundId) return r;
            return {
              ...r,
              [type === "prep" ? "prep" : "notes"]: markdown,
            };
          }),
        };
      }),
    }));

    const numericRoundId = Number(roundId);
    if (!isNaN(numericRoundId) && window.nudge?.updateRound) {
      void window.nudge.updateRound(numericRoundId, {
        [type === "prep" ? "prep_notes_md" : "interview_notes_md"]: markdown,
      });
    }
  };
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
    setActiveNoteRoute(null);
    setNotificationsOpen(false);
    setQuery("");
    window.location.hash = `/applications/${id}`;
  };
  const openCompany = (id: string) => {
    setPage("Companies");
    setSelectedCompany(id);
    setSelectedApp(null);
    setActiveNoteRoute(null);
    window.location.hash = `/companies/${id}`;
  };
  const openNotes = (applicationId: string, roundId: string, type: "prep" | "interview") => {
    setActiveNoteRoute({ applicationId, roundId, type });
    window.location.hash = `/applications/${applicationId}/rounds/${roundId}/${type}`;
  };
  const checkBoard = (id: string, openUrl = false) => {
    const b = store.boards.find((x) => x.id === id);
    if (!b) return;
    const nowIso = new Date().toISOString();
    if (openUrl && b.url) {
      window.open(formatExternalUrl(b.url), "_blank");
    }
    setStore((s) => ({
      ...s,
      boards: s.boards.map((item) => (item.id === id ? { ...item, checked: nowIso } : item)),
    }));
    const numId = Number(id);
    if (!isNaN(numId) && window.nudge?.updateBoard) {
      void window.nudge.updateBoard(numId, { last_checked_at: nowIso });
    }
    notify(openUrl ? `Opened and marked ${b.name} checked.` : `Marked ${b.name} checked.`);
  };

  const handleSaveBoard = async (data: { id?: string; name: string; url: string; frequency: number }) => {
    if (data.id) {
      const numId = Number(data.id);
      if (!isNaN(numId) && window.nudge?.updateBoard) {
        await window.nudge.updateBoard(numId, {
          name: data.name,
          url: data.url || null,
          check_every_days: data.frequency,
        });
      }
      setStore((s) => ({
        ...s,
        boards: s.boards.map((b) =>
          b.id === data.id
            ? { ...b, name: data.name, url: data.url, frequency: data.frequency }
            : b,
        ),
      }));
      notify(`Updated ${data.name}.`);
    } else {
      const nowIso = new Date().toISOString();
      if (window.nudge?.createBoard) {
        const created = await window.nudge.createBoard({
          name: data.name,
          url: data.url || null,
          check_every_days: data.frequency,
          last_checked_at: nowIso,
        });
        setStore((s) => ({
          ...s,
          boards: [
            ...s.boards,
            {
              id: String(created.id),
              name: created.name,
              url: created.url || "",
              frequency: created.check_every_days,
              checked: created.last_checked_at || nowIso,
              color: "#cf7048",
            },
          ],
        }));
      } else {
        setStore((s) => ({
          ...s,
          boards: [
            ...s.boards,
            {
              id: uid(),
              name: data.name,
              url: data.url,
              frequency: data.frequency,
              checked: nowIso,
              color: "#cf7048",
            },
          ],
        }));
      }
      notify("Job board added to your radar.");
    }
    setModal(null);
    setEditingBoard(null);
  };

  const handleDeleteBoard = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from your job boards?`)) return;
    const numId = Number(id);
    if (!isNaN(numId) && window.nudge?.deleteBoard) {
      await window.nudge.deleteBoard(numId);
    }
    setStore((s) => ({
      ...s,
      boards: s.boards.filter((x) => x.id !== id),
    }));
    notify(`Removed ${name}.`);
  };
  const reminderCount = dueApplications(store).length + store.boards.filter(boardDue).length;
  const app = store.applications.find((a) => a.id === selectedApp);
  const company = store.companies.find((c) => c.id === selectedCompany);

  const activeNoteApp = activeNoteRoute
    ? store.applications.find((a) => a.id === activeNoteRoute.applicationId)
    : null;
  const activeNoteRound =
    activeNoteApp && activeNoteRoute
      ? (activeNoteApp.rounds || []).find((r) => r.id === activeNoteRoute.roundId)
      : null;
  const activeNoteCompany =
    activeNoteApp
      ? store.companies.find((c) => c.id === activeNoteApp.companyId) || {
          id: activeNoteApp.companyId,
          name: "Company",
          domain: "",
          color: "#6c8452",
          description: "",
          notes: "",
        }
      : null;

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
          {activeNoteApp && activeNoteRound && activeNoteCompany && activeNoteRoute ? (
            <NoteEditor
              application={activeNoteApp}
              company={activeNoteCompany}
              round={activeNoteRound}
              type={activeNoteRoute.type}
              onBack={() => {
                setSelectedApp(activeNoteRoute.applicationId);
                setActiveNoteRoute(null);
                window.location.hash = `/applications/${activeNoteRoute.applicationId}`;
              }}
              onSave={(markdown) => {
                updateApplicationRoundNotes(
                  activeNoteRoute.applicationId,
                  activeNoteRoute.roundId,
                  activeNoteRoute.type,
                  markdown,
                );
              }}
            />
          ) : app ? (
            <ApplicationDetail
              application={app}
              company={
                store.companies.find((c) => c.id === app.companyId) || {
                  id: app.companyId,
                  name: "Company",
                  domain: "",
                  color: "#6c8452",
                  description: "",
                  notes: "",
                }
              }
              onBack={() => {
                setSelectedApp(null);
                setActiveNoteRoute(null);
                window.location.hash = "";
              }}
              onUpdate={(patch) => updateApplication(app.id, patch)}
              onUpdateCompany={(patch) => {
                setStore((s) => ({
                  ...s,
                  companies: s.companies.map((c) => (c.id === app.companyId ? { ...c, ...patch } : c)),
                }));
              }}
              onCompany={() => openCompany(app.companyId)}
              onOpenNotes={(roundId, type) => openNotes(app.id, roundId, type)}
              onDelete={() => {
                setStore((s) => ({
                  ...s,
                  applications: s.applications.filter((a) => a.id !== app.id),
                }));
                setSelectedApp(null);
                setActiveNoteRoute(null);
                window.location.hash = "";
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
                      <button
                        className="button primary"
                        onClick={() => {
                          setEditingBoard(null);
                          setModal("board");
                        }}
                      >
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
                    {store.boards.map((b) => {
                      const isDue = boardDue(b);
                      return (
                        <div className={`board-card ${isDue ? "board-card-due" : ""}`} key={b.id}>
                          <span className="board-letter" style={{ background: b.color || "#798d62" }}>
                            {b.name === "LinkedIn" ? "in" : b.name.charAt(0)}
                          </span>
                          <div className="board-card-name">
                            <h3>
                              {b.name}
                              {b.url && (
                                <a
                                  href={formatExternalUrl(b.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  aria-label={`Open ${b.name}`}
                                >
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </h3>
                            <span>{safeHostname(b.url) || "No URL specified"}</span>
                          </div>
                          <label className="board-frequency">
                            Check every
                            <select
                              aria-label={`Check frequency for ${b.name}`}
                              value={b.frequency}
                              onChange={(e) => {
                                const newFreq = +e.target.value;
                                handleSaveBoard({
                                  id: b.id,
                                  name: b.name,
                                  url: b.url,
                                  frequency: newFreq,
                                });
                              }}
                            >
                              {[1, 2, 3, 5, 7, 14, 30].map((n) => (
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
                          <span className={`due-label ${isDue ? "is-due" : ""}`}>
                            <span />
                            {isDue ? "Check-in due" : "Up to date"}
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            {b.url ? (
                              <button
                                className="button primary"
                                onClick={() => checkBoard(b.id, true)}
                                title="Open URL in system browser and mark checked"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                              >
                                <ExternalLink size={14} />
                                Open and mark checked
                              </button>
                            ) : (
                              <button
                                className="button secondary"
                                onClick={() => checkBoard(b.id, false)}
                                title="Mark checked"
                              >
                                <Check size={14} />
                                Mark checked
                              </button>
                            )}
                            {b.url && (
                              <button
                                className="icon-button"
                                title="Mark checked without opening"
                                aria-label="Mark checked without opening"
                                onClick={() => checkBoard(b.id, false)}
                              >
                                <Check size={14} />
                              </button>
                            )}
                            <button
                              className="icon-button"
                              title={`Edit ${b.name}`}
                              aria-label={`Edit ${b.name}`}
                              onClick={() => {
                                setEditingBoard(b);
                                setModal("board");
                              }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              className="icon-button danger-hover"
                              aria-label={`Remove ${b.name}`}
                              title={`Remove ${b.name}`}
                              onClick={() => handleDeleteBoard(b.id, b.name)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!store.boards.length && (
                    <Empty
                      title="Build your opportunity radar"
                      description="Add a job board and set your first check-in reminder."
                      action={
                        <button
                          className="button primary"
                          onClick={() => {
                            setEditingBoard(null);
                            setModal("board");
                          }}
                        >
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
          board={editingBoard}
          onClose={() => {
            setModal(null);
            setEditingBoard(null);
          }}
          onSave={handleSaveBoard}
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
            <a href={formatExternalUrl(b.url)} target="_blank" rel="noreferrer" className="board-widget-name">
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


function RoundTopicsInput({
  topics,
  onChange,
}: {
  topics: string;
  onChange: (newTopics: string) => void;
}) {
  const [inputVal, setInputVal] = useState("");
  const tags = useMemo(() => {
    if (!topics || !topics.trim()) return [];
    return topics
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }, [topics]);

  const addTag = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const exists = tags.some((t) => t.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      const nextTags = [...tags, trimmed];
      onChange(nextTags.join(", "));
    }
    setInputVal("");
  };

  const removeTag = (idx: number) => {
    const nextTags = tags.filter((_, i) => i !== idx);
    onChange(nextTags.join(", "));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", alignItems: "center" }}>
          {tags.map((tag, i) => (
            <span key={i} className="topic-tag-pill">
              {tag}
              <button
                type="button"
                className="topic-tag-remove"
                onClick={() => removeTag(i)}
                title={`Remove ${tag}`}
                aria-label={`Remove ${tag}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={inputVal}
        placeholder={tags.length === 0 ? "Add technical topics asked (press Enter)..." : "Add another topic..."}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(inputVal);
          }
        }}
        onBlur={() => {
          if (inputVal.trim()) addTag(inputVal);
        }}
        style={{ fontSize: "11px", padding: "4px 8px", borderRadius: "5px" }}
      />
    </div>
  );
}

function isRoundOverdue(r: Round): boolean {
  if (!r.status || r.status.toLowerCase() !== "upcoming") return false;
  if (!r.date) return false;
  const targetTime = new Date(r.date.length === 10 ? `${r.date}T23:59:59` : r.date).getTime();
  return !isNaN(targetTime) && targetTime < Date.now();
}

function ApplicationDetail({
  application: a,
  company,
  onBack,
  onUpdate,
  onUpdateCompany,
  onCompany,
  onDelete,
  onOpenNotes,
}: {
  application: Application;
  company: Company;
  onBack: () => void;
  onUpdate: (patch: Partial<Application>) => void;
  onUpdateCompany: (patch: Partial<Company>) => void;
  onCompany: () => void;
  onDelete: () => void;
  onOpenNotes: (roundId: string, type: "prep" | "interview") => void;
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Overview fields
  const [role, setRole] = useState(a.role);
  const [location, setLocation] = useState(a.location);
  const [mode, setMode] = useState(a.mode);
  const [source, setSource] = useState(a.source);
  const [url, setUrl] = useState(a.url);
  const [applied, setApplied] = useState(a.applied);
  const [stage, setStage] = useState(a.stage);
  const [resume, setResume] = useState(a.resume);
  const [nextActionOverride, setNextActionOverride] = useState(a.nextActionOverride || "");
  const [companyOverview, setCompanyOverview] = useState(company.description || "");

  // Add round bar state
  const [newRoundType, setNewRoundType] = useState<string>("Technical");
  const [newRoundDate, setNewRoundDate] = useState("");
  const [newRoundAction, setNewRoundAction] = useState("");

  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Outcome fields
  const [offer, setOffer] = useState(a.offer || "");
  const [joining, setJoining] = useState(a.joining || "");
  const [rejection, setRejection] = useState(a.rejection || "");

  // Saved indicators
  const [overviewSaved, setOverviewSaved] = useState(false);
  const [outcomeSaved, setOutcomeSaved] = useState(false);
  const overviewTimerRef = useRef<any>(null);
  const outcomeTimerRef = useRef<any>(null);

  const triggerOverviewSaved = () => {
    setOverviewSaved(true);
    if (overviewTimerRef.current) clearTimeout(overviewTimerRef.current);
    overviewTimerRef.current = setTimeout(() => setOverviewSaved(false), 2000);
  };

  const triggerOutcomeSaved = () => {
    setOutcomeSaved(true);
    if (outcomeTimerRef.current) clearTimeout(outcomeTimerRef.current);
    outcomeTimerRef.current = setTimeout(() => setOutcomeSaved(false), 2000);
  };

  useEffect(() => {
    setRole(a.role);
    setLocation(a.location);
    setMode(a.mode);
    setSource(a.source);
    setUrl(a.url);
    setApplied(a.applied);
    setStage(a.stage);
    setResume(a.resume);
    setNextActionOverride(a.nextActionOverride || "");
    setCompanyOverview(company.description || "");
    setOffer(a.offer || "");
    setJoining(a.joining || "");
    setRejection(a.rejection || "");
  }, [a, company]);

  const handleOverviewBlur = (field: keyof Application, value: string, original: string) => {
    if (value !== original) {
      onUpdate({ [field]: value });
      triggerOverviewSaved();
    }
  };

  const handleOutcomeBlur = (field: keyof Application, value: string, original: string) => {
    if (value !== original) {
      onUpdate({ [field]: value });
      triggerOutcomeSaved();
    }
  };

  const handleCompanyOverviewBlur = () => {
    const original = company.description || "";
    if (companyOverview !== original) {
      onUpdateCompany({ description: companyOverview });
      triggerOverviewSaved();
    }
  };

  const derivedNext = useMemo(() => {
    return deriveClientNextAction({
      ...a,
      nextActionOverride,
      rounds: a.rounds,
    });
  }, [a, nextActionOverride]);

  // Handle adding a new round with status auto-advance
  const handleAddRound = () => {
    const roundsList = a.rounds || [];
    const maxPos = roundsList.reduce((max, r) => Math.max(max, r.position ?? 0), -1);
    const nextPos = maxPos + 1;

    // Status auto-advance:
    const oaTypes = ["Aptitude OA", "DSA OA"];
    const interviewTypes = ["Technical", "LLD", "HLD", "Managerial", "HR", "Custom"];
    let nextStage: Stage = a.stage;
    if (oaTypes.includes(newRoundType)) {
      if (a.stage === "Saved" || a.stage === "Applied") {
        nextStage = "OA";
      }
    } else if (interviewTypes.includes(newRoundType)) {
      if (a.stage === "Saved" || a.stage === "Applied" || a.stage === "OA") {
        nextStage = "Interview";
      }
    }

    const created: Round = {
      id: uid(),
      position: nextPos,
      type: newRoundType,
      title: "",
      date: newRoundDate,
      status: "upcoming",
      nextAction: newRoundAction.trim(),
      resume: a.resume || "",
      prep: "",
      notes: "",
      topics: "",
    };

    const updatedRounds = [...roundsList, created];
    onUpdate({
      stage: nextStage,
      rounds: updatedRounds,
    });
    setNewRoundDate("");
    setNewRoundAction("");
    triggerOverviewSaved();
  };

  const handleUpdateRound = (roundId: string, patch: Partial<Round>) => {
    const updated = (a.rounds || []).map((r) => (r.id === roundId ? { ...r, ...patch } : r));
    onUpdate({ rounds: updated });
    triggerOverviewSaved();
  };

  const handleDeleteRound = (roundId: string) => {
    const updated = (a.rounds || []).filter((r) => r.id !== roundId);
    onUpdate({ rounds: updated });
    triggerOverviewSaved();
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const list = [...(a.rounds || [])].sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
    if (toIndex < 0 || toIndex >= list.length) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    const reindexed = list.map((item, i) => ({ ...item, position: i }));
    onUpdate({ rounds: reindexed });
    triggerOverviewSaved();
  };

  // Aggregated technical topics from all rounds (read-only)
  const aggregatedTopics = useMemo(() => {
    const list: string[] = [];
    for (const r of a.rounds || []) {
      const raw = r.topics || (r as any).topics_asked || "";
      if (raw && typeof raw === "string") {
        const parts = raw.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
        list.push(...parts);
      }
    }
    if (a.topics && typeof a.topics === "string") {
      const parts = a.topics.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
      list.push(...parts);
    }
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const t of list) {
      const lower = t.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(t);
      }
    }
    return unique;
  }, [a.rounds, a.topics]);

  const sortedRounds = useMemo(() => {
    return [...(a.rounds || [])].sort((x, y) => (x.position ?? 0) - (y.position ?? 0));
  }, [a.rounds]);

  return (
    <div className="detail-page application-detail-scrollable">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <button className="back-link" onClick={onBack}>
          <ArrowLeft size={15} />
          Back to applications
        </button>
        <button
          className="button secondary danger-hover"
          onClick={() => setDeleteConfirm(true)}
          style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Trash2 size={14} />
          Delete application
        </button>
      </div>

      <div className="detail-heading">
        <div className="detail-heading-main">
          <CompanyLogo name={company.name} color={company.color} size={58} />
          <div>
            <button className="company-name-link" onClick={onCompany} title="Go to company page">
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
              <span>
                <Clock3 size={14} />
                Updated {relativeLastUpdated(a.updated || a.applied)}
              </span>
            </div>
          </div>
        </div>
        <StageBadge
          stage={a.stage}
          onChange={(newStage) => {
            setStage(newStage);
            onUpdate({ stage: newStage });
            triggerOverviewSaved();
          }}
        />
      </div>

      <div className="detail-scroll-content" style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "24px" }}>
        {/* SECTION 1: OVERVIEW */}
        <section className="content-card">
          <div className="card-heading">
            <div>
              <h2>Application overview</h2>
              <p className="muted small">Core application details. Autosaves on blur.</p>
            </div>
            {overviewSaved && (
              <span className="saved-badge">
                <Check size={13} /> Saved
              </span>
            )}
          </div>
          <div className="form-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "11px", fontWeight: 500, color: "#8a9879" }}>
              <span>Company</span>
              <button
                type="button"
                className="company-name-link"
                onClick={onCompany}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  marginTop: "4px",
                }}
              >
                <CompanyLogo name={company.name} color={company.color} size={22} />
                {company.name}
                <ArrowUpRight size={13} />
              </button>
            </div>

            <label>
              Role
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onBlur={() => handleOverviewBlur("role", role, a.role)}
                placeholder="e.g. Senior Software Engineer"
              />
            </label>

            <label>
              Location
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onBlur={() => handleOverviewBlur("location", location, a.location)}
                placeholder="e.g. San Francisco, CA or Remote"
              />
            </label>

            <label>
              Work mode
              <select
                value={mode}
                onChange={(e) => {
                  const val = e.target.value;
                  setMode(val);
                  onUpdate({ mode: val });
                  triggerOverviewSaved();
                }}
              >
                <option value="Full-time">Full-time</option>
                <option value="Internship">Internship</option>
              </select>
            </label>

            <label>
              Source
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                onBlur={() => handleOverviewBlur("source", source, a.source)}
                placeholder="e.g. LinkedIn, Referral, Careers page"
              />
            </label>

            <label>
              Posting URL
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={() => handleOverviewBlur("url", url, a.url)}
                  placeholder="https://..."
                  style={{ flex: 1 }}
                />
                {url ? (
                  <a
                    href={formatExternalUrl(url)}
                    target="_blank"
                    rel="noreferrer"
                    className="button secondary icon-button"
                    title="Open posting in system browser"
                    aria-label="Open posting in system browser"
                    style={{ padding: "8px", height: "36px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <ExternalLink size={15} />
                  </a>
                ) : null}
              </div>
            </label>

            <label>
              Applied date
              <input
                type="date"
                value={applied}
                onChange={(e) => {
                  const val = e.target.value;
                  setApplied(val);
                  onUpdate({ applied: val });
                  triggerOverviewSaved();
                }}
                onBlur={() => handleOverviewBlur("applied", applied, a.applied)}
              />
            </label>

            <label>
              Status
              <select
                value={stage}
                onChange={(e) => {
                  const val = e.target.value as Stage;
                  setStage(val);
                  onUpdate({ stage: val });
                  triggerOverviewSaved();
                }}
              >
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Resume used
              <input
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                onBlur={() => handleOverviewBlur("resume", resume, a.resume)}
                placeholder="e.g. Resume_SWE_2026.pdf"
              />
            </label>

            {/* Next action field with override and auto badge */}
            <div className="full-width" style={{ marginTop: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#687b55", display: "flex", alignItems: "center", gap: "6px" }}>
                  Next action
                  {derivedNext.isAuto ? (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#7e8f6e",
                        background: "#eaf0e3",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontWeight: 500,
                      }}
                    >
                      auto
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#c07a4e",
                        background: "#faede5",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontWeight: 500,
                      }}
                    >
                      override
                    </span>
                  )}
                </span>
                {nextActionOverride ? (
                  <button
                    type="button"
                    className="text-link"
                    style={{ fontSize: "11px", color: "#b35e46", cursor: "pointer" }}
                    onClick={() => {
                      setNextActionOverride("");
                      onUpdate({ nextActionOverride: "" });
                      triggerOverviewSaved();
                    }}
                  >
                    Clear override
                  </button>
                ) : null}
              </div>
              <input
                value={nextActionOverride}
                placeholder={derivedNext.isAuto && derivedNext.text ? `Auto: ${derivedNext.text}` : "Type a custom next action override..."}
                onChange={(e) => setNextActionOverride(e.target.value)}
                onBlur={() => {
                  if (nextActionOverride !== (a.nextActionOverride || "")) {
                    onUpdate({ nextActionOverride });
                    triggerOverviewSaved();
                  }
                }}
                style={{ width: "100%" }}
              />
              <span className="muted small" style={{ fontSize: "10px", marginTop: "4px", display: "block" }}>
                {nextActionOverride
                  ? "Manual override active. Click 'Clear override' to fall back to automatic derivation."
                  : `Automatically derived from rounds and timeline (${derivedNext.text || "none"}). Typing here sets an override.`}
              </span>
            </div>

            <label className="full-width">
              Company overview (shared with company record)
              <textarea
                rows={4}
                value={companyOverview}
                onChange={(e) => setCompanyOverview(e.target.value)}
                onBlur={handleCompanyOverviewBlur}
                placeholder="What does this company do? Team culture, size, mission..."
                style={{ resize: "vertical" }}
              />
            </label>
          </div>
        </section>

        {/* SECTION 2: ROUNDS & TIMELINE */}
        <section className="content-card rounds-section">
          <div className="card-heading">
            <div>
              <h2>Rounds & timeline</h2>
              <p className="muted small">Vertical timeline ordered by position. Drag or use arrows to reorder.</p>
            </div>
            <span className="small-count">{sortedRounds.length} {sortedRounds.length === 1 ? "round" : "rounds"}</span>
          </div>

          {/* Quick Add Round Bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
              alignItems: "flex-end",
              padding: "16px",
              background: "#fbfcf9",
              border: "1px solid #e3e8da",
              borderRadius: "8px",
              marginBottom: "16px",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 500, color: "#687b55" }}>
              Round type
              <select
                value={newRoundType}
                onChange={(e) => setNewRoundType(e.target.value)}
                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #ccd6c0", background: "white", fontSize: "12px" }}
              >
                {roundTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 500, color: "#687b55" }}>
              Scheduled date (optional)
              <input
                type="datetime-local"
                value={newRoundDate}
                onChange={(e) => setNewRoundDate(e.target.value)}
                style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid #ccd6c0", background: "white", fontSize: "12px" }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px", fontWeight: 500, color: "#687b55", flex: "1 1 200px" }}>
              Next action (optional)
              <input
                value={newRoundAction}
                onChange={(e) => setNewRoundAction(e.target.value)}
                placeholder="e.g. Review system design patterns"
                style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid #ccd6c0", background: "white", fontSize: "12px" }}
              />
            </label>
            <button
              type="button"
              className="button primary"
              onClick={handleAddRound}
              style={{ height: "35px", display: "inline-flex", alignItems: "center", gap: "6px", padding: "0 14px" }}
            >
              <Plus size={15} /> Add round
            </button>
          </div>

          {/* Timeline List */}
          {sortedRounds.length > 0 ? (
            <div className="round-timeline">
              {sortedRounds.map((r, index) => {
                const overdue = isRoundOverdue(r);
                return (
                  <div
                    key={r.id}
                    className={`timeline-round-item ${overdue ? "round-overdue" : ""}`}
                    draggable={true}
                    onDragStart={() => setDraggedIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedIndex !== null && draggedIndex !== index) {
                        handleReorder(draggedIndex, index);
                        setDraggedIndex(null);
                      }
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", gap: "10px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="round-drag-handle" title="Drag to reorder">
                          <ArrowDownUp size={14} />
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <button
                            type="button"
                            className="icon-button"
                            disabled={index === 0}
                            onClick={() => handleReorder(index, index - 1)}
                            title="Move up"
                            aria-label="Move up"
                            style={{ opacity: index === 0 ? 0.3 : 1, padding: "1px 4px", fontSize: "9px", height: "auto" }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            className="icon-button"
                            disabled={index === sortedRounds.length - 1}
                            onClick={() => handleReorder(index, index + 1)}
                            title="Move down"
                            aria-label="Move down"
                            style={{ opacity: index === sortedRounds.length - 1 ? 0.3 : 1, padding: "1px 4px", fontSize: "9px", height: "auto" }}
                          >
                            ▼
                          </button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "#8a9879" }}>
                            #{index + 1}
                          </span>
                          <input
                            value={r.title !== undefined && r.title !== null && r.title !== "" ? r.title : r.type}
                            onChange={(e) => handleUpdateRound(r.id, { title: e.target.value })}
                            style={{
                              fontSize: "13px",
                              fontWeight: 600,
                              color: "#4f5f41",
                              border: "1px solid transparent",
                              background: "transparent",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                            onFocus={(e) => (e.target.style.border = "1px solid #ccd6c0")}
                            onBlur={(e) => (e.target.style.border = "1px solid transparent")}
                          />
                        </div>
                        {overdue && (
                          <span className="round-overdue-badge">
                            <Clock3 size={11} /> Overdue
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <select
                          value={r.status ? r.status.toLowerCase() : "upcoming"}
                          onChange={(e) => handleUpdateRound(r.id, { status: e.target.value as any })}
                          style={{
                            fontSize: "11px",
                            padding: "3px 8px",
                            borderRadius: "5px",
                            fontWeight: 600,
                            color: r.status?.toLowerCase() === "done" ? "#4f772d" : r.status?.toLowerCase() === "skipped" ? "#8f9986" : "#b06c3a",
                            background: r.status?.toLowerCase() === "done" ? "#f1f8eb" : r.status?.toLowerCase() === "skipped" ? "#f3f5f0" : "#fff5eb",
                            border: "1px solid #d2dcc8",
                          }}
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="done">Done</option>
                          <option value="skipped">Skipped</option>
                        </select>
                        <button
                          type="button"
                          className="icon-button danger-hover"
                          onClick={() => handleDeleteRound(r.id)}
                          title="Delete round"
                          aria-label="Delete round"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="form-grid" style={{ gap: "10px 14px" }}>
                      <label>
                        Scheduled date & time
                        <input
                          type="datetime-local"
                          value={r.date || ""}
                          onChange={(e) => handleUpdateRound(r.id, { date: e.target.value })}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        />
                      </label>
                      <label>
                        Next action
                        <input
                          value={r.nextAction || ""}
                          placeholder="e.g. Practice dynamic programming"
                          onChange={(e) => handleUpdateRound(r.id, { nextAction: e.target.value })}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        />
                      </label>
                      <label>
                        Resume used
                        <input
                          value={r.resume || ""}
                          placeholder={a.resume || "Resume filename..."}
                          onChange={(e) => handleUpdateRound(r.id, { resume: e.target.value })}
                          style={{ fontSize: "11px", padding: "4px 8px" }}
                        />
                      </label>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#8a9879", display: "block", marginBottom: "6px" }}>
                          Notes
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            type="button"
                            className="button secondary small-button"
                            onClick={() => onOpenNotes(r.id, "prep")}
                            style={{ fontSize: "11px", padding: "4px 9px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                          >
                            <FileText size={12} /> Prep notes
                          </button>
                          <button
                            type="button"
                            className="button secondary small-button"
                            onClick={() => onOpenNotes(r.id, "interview")}
                            style={{ fontSize: "11px", padding: "4px 9px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                          >
                            <FileText size={12} /> Interview notes
                          </button>
                        </div>
                      </div>
                      <div className="full-width" style={{ marginTop: "4px" }}>
                        <span style={{ fontSize: "11px", fontWeight: 500, color: "#8a9879", display: "block", marginBottom: "4px" }}>
                          Technical topics asked
                        </span>
                        <RoundTopicsInput
                          topics={r.topics || ""}
                          onChange={(topics) => handleUpdateRound(r.id, { topics })}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: "24px", textAlign: "center", background: "#fbfcf9", borderRadius: "8px", border: "1px dashed #dbe4d1" }}>
              <p className="muted small" style={{ margin: 0 }}>
                No rounds added yet. Select a round type above and click <strong>Add round</strong> to start your timeline.
              </p>
            </div>
          )}
        </section>

        {/* SECTION 3: OUTCOME */}
        <section className="content-card outcome-card">
          <div className="card-heading">
            <div>
              <h2>Outcome</h2>
              <p className="muted small">Package details, decisions, and technical topics asked.</p>
            </div>
            {outcomeSaved && (
              <span className="saved-badge">
                <Check size={13} /> Saved
              </span>
            )}
          </div>

          {stage === "Offer" && (
            <div className="form-grid">
              <label className="full-width">
                Offer package
                <textarea
                  rows={3}
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  onBlur={() => handleOutcomeBlur("offer", offer, a.offer)}
                  placeholder="Base salary, equity, signing bonus, benefits, and notes..."
                  style={{ resize: "vertical" }}
                />
              </label>
              <label>
                Joining date
                <input
                  type="date"
                  value={joining}
                  onChange={(e) => {
                    const val = e.target.value;
                    setJoining(val);
                    onUpdate({ joining: val });
                    triggerOutcomeSaved();
                  }}
                  onBlur={() => handleOutcomeBlur("joining", joining, a.joining)}
                />
              </label>
            </div>
          )}

          {stage === "Rejected" && (
            <div className="form-grid">
              <label className="full-width">
                Rejection reason
                <textarea
                  rows={3}
                  value={rejection}
                  onChange={(e) => setRejection(e.target.value)}
                  onBlur={() => handleOutcomeBlur("rejection", rejection, a.rejection)}
                  placeholder="Feedback, interviewer notes, or reasons provided..."
                  style={{ resize: "vertical" }}
                />
              </label>
            </div>
          )}

          {stage !== "Offer" && stage !== "Rejected" && (
            <div
              style={{
                padding: "12px 16px",
                background: "#f8faf5",
                borderRadius: "6px",
                border: "1px solid #e7ede0",
                marginBottom: "16px",
              }}
            >
              <p className="muted small" style={{ margin: 0 }}>
                Offer fields appear when status is <strong>Offer</strong>, and rejection reason appears when status is <strong>Rejected</strong>.
              </p>
            </div>
          )}

          {/* Technical topics asked (aggregated read-only from all rounds) */}
          <div style={{ marginTop: "16px", borderTop: "1px solid #edf1e7", paddingTop: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <h3 style={{ fontSize: "12px", fontWeight: 600, color: "#687b55", margin: 0 }}>
                Technical topics asked
              </h3>
              <span className="muted small" style={{ fontSize: "10px" }}>Aggregated from all rounds (read-only)</span>
            </div>
            {aggregatedTopics.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                {aggregatedTopics.map((topic, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "4px 9px",
                      background: "#f0f4ea",
                      border: "1px solid #dbe4d1",
                      borderRadius: "5px",
                      fontSize: "11px",
                      color: "#4e603e",
                      fontWeight: 500,
                    }}
                  >
                    {topic}
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted small" style={{ fontStyle: "italic", margin: "6px 0 0" }}>
                No technical topics recorded across interview rounds yet.
              </p>
            )}
          </div>
        </section>
      </div>



      {deleteConfirm && (
        <ModalFrame
          title="Delete this application?"
          subtitle={`Are you sure you want to permanently delete the application for "${a.role}" at ${company.name}? This action cannot be undone.`}
          onClose={() => setDeleteConfirm(false)}
        >
          <div className="confirm-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
            <button className="button secondary" onClick={() => setDeleteConfirm(false)}>
              Keep application
            </button>
            <button
              className="button danger"
              onClick={() => {
                setDeleteConfirm(false);
                onDelete();
              }}
            >
              <Trash2 size={15} />
              Delete application
            </button>
          </div>
        </ModalFrame>
      )}
    </div>
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
function BoardModal({
  board,
  onClose,
  onSave,
}: {
  board?: Board | null;
  onClose: () => void;
  onSave: (b: { id?: string; name: string; url: string; frequency: number }) => void;
}) {
  const [name, setName] = useState(board ? board.name : "");
  const [url, setUrl] = useState(board ? board.url : "");
  const [frequency, setFrequency] = useState(board ? board.frequency : 7);

  return (
    <ModalFrame
      title={board ? "Edit job board" : "Add job board"}
      subtitle={board ? "Update name, URL, or check frequency." : "Add a favorite place to look for your next role."}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: board?.id,
            name: name.trim(),
            url: url.trim(),
            frequency,
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
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label>
            Check-in frequency
            <select value={frequency} onChange={(e) => setFrequency(+e.target.value)}>
              {[1, 2, 3, 5, 7, 14, 30].map((n) => (
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
            {board ? <Check size={15} /> : <Plus size={15} />}
            {board ? "Save changes" : "Add job board"}
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
              <h3>Follow-up reminder days</h3>
              <p>Days after applying to remind you for a follow-up (default 7 days).</p>
            </div>
            <select
              aria-label="Follow-up reminder days"
              value={store.settings.followUpDays ?? 7}
              onChange={(e) => {
                const days = +e.target.value;
                setting({ followUpDays: days });
                notify(`Follow-up reminder set to ${days} days.`);
              }}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #ccd6c0",
                background: "white",
                fontSize: "12px",
              }}
            >
              {[3, 5, 7, 10, 14, 21].map((n) => (
                <option key={n} value={n}>
                  {n} days
                </option>
              ))}
            </select>
          </div>
          <div className="settings-row">
            <div>
              <h3>Background scheduler</h3>
              <p>Check for due boards, follow-ups, and interviews on app start and every 15 minutes.</p>
            </div>
            <button
              role="switch"
              aria-checked={store.settings.schedulerEnabled ?? true}
              aria-label="Background scheduler"
              className={`toggle ${(store.settings.schedulerEnabled ?? true) ? "on" : ""}`}
              onClick={() => {
                const nextVal = !(store.settings.schedulerEnabled ?? true);
                setting({ schedulerEnabled: nextVal });
                notify(nextVal ? "Background scheduler enabled." : "Background scheduler paused.");
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
