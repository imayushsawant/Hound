export const stages = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
  "Saved",
  "OA",
  "Ghosted",
] as const;
export type Stage = (typeof stages)[number];
export const roundTypes = [
  "Aptitude OA",
  "DSA OA",
  "Technical",
  "LLD",
  "HLD",
  "Managerial",
  "HR",
  "Custom",
];
export type Round = {
  id: string;
  position?: number;
  type: string;
  title?: string;
  date: string;
  status: "upcoming" | "done" | "skipped" | "Upcoming" | "Completed" | "Cancelled";
  nextAction: string;
  resume: string;
  prep: string;
  notes: string;
  topics?: string;
};
export type Application = {
  id: string;
  companyId: string;
  role: string;
  location: string;
  mode: string;
  source: string;
  url: string;
  applied: string;
  updated: string;
  stage: Stage;
  nextAction: string;
  nextActionOverride?: string;
  resume: string;
  rounds: Round[];
  offer: string;
  joining: string;
  rejection: string;
  topics: string;
  followUpDone?: boolean;
};
export type Company = {
  id: string;
  name: string;
  domain: string;
  color: string;
  description: string;
  notes: string;
};
export type Board = {
  id: string;
  name: string;
  url: string;
  frequency: number;
  checked: string;
  color: string;
};
export type Store = {
  applications: Application[];
  companies: Company[];
  boards: Board[];
  settings: { notifications: boolean; launchOnLogin: boolean; name: string };
};
export const uid = () => crypto.randomUUID();
export const isoDate = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
  value
    ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(
        "en-US",
        options || { month: "short", day: "numeric" },
      )
    : "—";
export const dayLabel = (date: string) => {
  if (date.slice(0, 10) === isoDate()) return "Today";
  if (date.slice(0, 10) === isoDate(1)) return "Tomorrow";
  return formatDate(date);
};
export const relativeLastUpdated = (date: string) => {
  if (!date) return "—";
  const targetDate = new Date(date.length === 10 ? `${date}T00:00:00` : date);
  const now = new Date();
  const diffMs = now.getTime() - targetDate.getTime();
  if (isNaN(diffMs)) return "—";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
};
export const isActive = (a: Application) => !["Rejected", "Withdrawn"].includes(a.stage);
export const followUpDate = (a: Application) => {
  if (!a.applied) return "";
  const d = new Date(`${a.applied}T12:00:00`);
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function deriveClientNextAction(a: Application): { text: string; isAuto: boolean } {
  // 1. Manual override if set
  if (a.nextActionOverride && a.nextActionOverride.trim()) {
    return { text: a.nextActionOverride.trim(), isAuto: false };
  }
  // 2. Upcoming rounds sorted by scheduled date / position
  const upcoming = (a.rounds || [])
    .filter((r) => r.status && r.status.toLowerCase() === "upcoming")
    .sort((x, y) => {
      const dateA = x.date || "9999-99-99";
      const dateB = y.date || "9999-99-99";
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      return (x.position ?? 0) - (y.position ?? 0);
    })[0];
  if (upcoming) {
    if (upcoming.nextAction && upcoming.nextAction.trim()) {
      return { text: upcoming.nextAction.trim(), isAuto: true };
    }
    const title = upcoming.title && upcoming.title.trim() ? upcoming.title.trim() : upcoming.type;
    if (upcoming.date) {
      return { text: `${title} on ${upcoming.date.slice(0, 10)}`, isAuto: true };
    }
    return { text: title, isAuto: true };
  }
  // 3. Follow up if applied > 7 days ago
  const terminalStatuses: Stage[] = ["Offer", "Rejected", "Ghosted", "Withdrawn"];
  if (a.applied && !terminalStatuses.includes(a.stage)) {
    const appliedTime = new Date(a.applied).getTime();
    if (!isNaN(appliedTime)) {
      const diffDays = (Date.now() - appliedTime) / (1000 * 60 * 60 * 24);
      if (diffDays > 7 && !a.followUpDone) {
        return { text: "Follow up", isAuto: true };
      }
    }
  }
  return { text: "", isAuto: true };
}

export function nextAction(a: Application): string {
  return deriveClientNextAction(a).text;
}
export function createSeed(): Store {
  const companies: Company[] = [
    {
      id: "linear",
      name: "Linear",
      domain: "linear.app",
      color: "#6962dd",
      description:
        "The purpose-built tool for planning and building products. Linear helps ambitious teams streamline issues, projects, and product roadmaps.",
      notes:
        "Product-led team with a strong focus on craft. Read their engineering blog before interviewing.",
    },
    {
      id: "notion",
      name: "Notion",
      domain: "notion.so",
      color: "#252525",
      description: "A connected workspace for your notes, documents, projects, and knowledge.",
      notes: "",
    },
    {
      id: "stripe",
      name: "Stripe",
      domain: "stripe.com",
      color: "#635bff",
      description:
        "Financial infrastructure for the internet. Millions of businesses use Stripe to accept payments and grow their revenue.",
      notes: "",
    },
    {
      id: "figma",
      name: "Figma",
      domain: "figma.com",
      color: "#ed6d52",
      description: "A collaborative platform for teams who build products together.",
      notes: "Interested in the editor performance and multiplayer teams.",
    },
    {
      id: "vercel",
      name: "Vercel",
      domain: "vercel.com",
      color: "#171717",
      description:
        "The platform for frontend developers, providing the speed and reliability innovators need to create at the moment of inspiration.",
      notes: "",
    },
    {
      id: "spotify",
      name: "Spotify",
      domain: "spotify.com",
      color: "#1a9d61",
      description:
        "Connecting creators with millions of fans around the world through music and audio.",
      notes: "",
    },
    {
      id: "airbnb",
      name: "Airbnb",
      domain: "airbnb.com",
      color: "#ed6671",
      description:
        "A community built around belonging, helping people discover unique places to stay and experiences around the world.",
      notes: "",
    },
    {
      id: "ramp",
      name: "Ramp",
      domain: "ramp.com",
      color: "#7a8840",
      description: "A finance automation platform designed to save businesses time and money.",
      notes: "",
    },
    {
      id: "framer",
      name: "Framer",
      domain: "framer.com",
      color: "#1676ed",
      description: "Design and publish beautiful websites, without writing code.",
      notes: "",
    },
    {
      id: "dropbox",
      name: "Dropbox",
      domain: "dropbox.com",
      color: "#0867e8",
      description: "Organize all your content, connect your tools, and bring your team together.",
      notes: "",
    },
    {
      id: "duolingo",
      name: "Duolingo",
      domain: "duolingo.com",
      color: "#66ac28",
      description:
        "Developing the best education in the world and making it universally available.",
      notes: "",
    },
    {
      id: "loom",
      name: "Loom",
      domain: "loom.com",
      color: "#725ee5",
      description: "Video messaging that helps you get your message across.",
      notes: "",
    },
  ];
  const specs: [string, string, Stage, number, string][] = [
    ["linear", "Frontend Engineer", "Interview", -6, ""],
    ["notion", "Software Engineer", "Screening", -5, "Recruiter call · Tomorrow"],
    ["stripe", "Frontend Engineer", "Applied", -8, ""],
    ["figma", "Software Engineer II", "Interview", -12, ""],
    ["vercel", "Design Engineer", "Applied", -3, ""],
    ["spotify", "Frontend Developer", "Interview", -10, ""],
    ["airbnb", "Software Engineer", "Applied", -7, ""],
    ["ramp", "Product Engineer", "Offer", -16, "Review offer package"],
    ["framer", "Frontend Engineer", "Screening", -4, "Schedule recruiter call"],
    ["dropbox", "Software Engineer", "Interview", -14, ""],
    ["duolingo", "Frontend Engineer", "Applied", -2, ""],
    ["linear", "Product Engineer", "Applied", -1, ""],
    ["loom", "Software Engineer", "Rejected", -21, ""],
    ["notion", "Design Engineer", "Withdrawn", -25, ""],
  ];
  const applications = specs.map(([companyId, role, stage, offset, action], i): Application => ({
    id: `app-${i}`,
    companyId,
    role,
    stage,
    applied: isoDate(offset),
    updated: isoDate(-Math.min(i % 4, Math.abs(offset))),
    location: ["San Francisco, CA", "New York, NY", "Remote"][i % 3],
    mode: "Full-time",
    source: ["Company website", "LinkedIn", "Referral"][i % 3],
    url: `https://${companies.find((c) => c.id === companyId)!.domain}/careers`,
    nextAction: action,
    resume: "Resume_Frontend_2026.pdf",
    offer: stage === "Offer" ? "$165,000 base + equity + benefits" : "",
    joining: "",
    rejection: stage === "Rejected" ? "Role filled by an internal candidate." : "",
    topics: "",
    rounds:
      stage === "Interview"
        ? [
            {
              id: `r-${i}-1`,
              type: "HR",
              date: `${isoDate(-3)}T11:00`,
              status: "Completed",
              nextAction: "",
              resume: "Resume_Frontend_2026.pdf",
              prep: "## Before the call\n- Research the team and product\n- Prepare a short introduction\n- Review the job description",
              notes:
                "Good conversation with the recruiter. Team is growing and looking for strong frontend fundamentals.",
            },
            {
              id: `r-${i}-2`,
              type: i === 0 ? "Technical" : i === 3 ? "HLD" : "DSA OA",
              date: `${isoDate(i === 0 ? 0 : i === 3 ? 1 : 2)}T${i === 0 ? "14:00" : i === 3 ? "11:00" : "10:00"}`,
              status: "Upcoming",
              nextAction:
                i === 0 ? "Technical interview" : i === 3 ? "System design" : "Practice DSA",
              resume: "Resume_Frontend_2026.pdf",
              prep: "## Preparation\n- Review core concepts\n- Practice explaining trade-offs\n- Prepare questions for the interviewer",
              notes: "",
            },
          ]
        : [],
  }));
  return {
    applications,
    companies,
    boards: [
      {
        id: "linkedin",
        name: "LinkedIn",
        url: "https://www.linkedin.com/jobs",
        frequency: 1,
        checked: new Date(Date.now() - 27 * 3600000).toISOString(),
        color: "#0a66c2",
      },
      {
        id: "wellfound",
        name: "Wellfound",
        url: "https://wellfound.com/jobs",
        frequency: 2,
        checked: new Date(Date.now() - 52 * 3600000).toISOString(),
        color: "#272727",
      },
      {
        id: "yc",
        name: "Y Combinator",
        url: "https://www.ycombinator.com/jobs",
        frequency: 3,
        checked: new Date().toISOString(),
        color: "#ee702b",
      },
    ],
    settings: { notifications: false, launchOnLogin: false, name: "Alex" },
  };
}
export function readStore(): Store {
  try {
    const raw = localStorage.getItem("hound-workspace-v1");
    if (raw) {
      const data = JSON.parse(raw);
      if (validStore(data)) return data;
    }
  } catch {
    /* A blocked storage context can still use the app in memory. */
  }
  return createSeed();
}
export function validStore(data: unknown): data is Store {
  if (!data || typeof data !== "object") return false;
  const s = data as Store;
  const text = (v: unknown): v is string => typeof v === "string" && v.length <= 200000;
  const date = (v: unknown) =>
    text(v) && (v === "" || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))));
  const unique = (items: { id: string }[]) => new Set(items.map((x) => x.id)).size === items.length;
  const webURL = (v: unknown) => text(v) && (v === "" || /^https?:\/\/\S+$/i.test(v));
  try {
    return (
      Array.isArray(s.companies) &&
      s.companies.every(
        (c) =>
          c &&
          text(c.id) &&
          !!c.id &&
          text(c.name) &&
          !!c.name.trim() &&
          text(c.notes) &&
          text(c.description) &&
          text(c.domain) &&
          /^#[a-f\d]{6}$/i.test(c.color),
      ) &&
      unique(s.companies) &&
      Array.isArray(s.applications) &&
      s.applications.every(
        (a) =>
          a &&
          text(a.id) &&
          !!a.id &&
          text(a.role) &&
          !!a.role.trim() &&
          stages.includes(a.stage) &&
          date(a.applied) &&
          date(a.updated) &&
          date(a.joining) &&
          text(a.nextAction) &&
          text(a.location) &&
          ["Full-time", "Internship"].includes(a.mode) &&
          text(a.source) &&
          webURL(a.url) &&
          text(a.resume) &&
          text(a.offer) &&
          text(a.rejection) &&
          text(a.topics) &&
          Array.isArray(a.rounds) &&
          unique(a.rounds) &&
          a.rounds.every(
            (r) =>
              r &&
              text(r.id) &&
              !!r.id &&
              roundTypes.includes(r.type) &&
              text(r.date) &&
              (r.date === "" || !Number.isNaN(Date.parse(r.date))) &&
              ["Upcoming", "Completed", "Cancelled"].includes(r.status) &&
              text(r.nextAction) &&
              text(r.resume) &&
              text(r.prep) &&
              text(r.notes),
          ) &&
          s.companies.some((c) => c.id === a.companyId),
      ) &&
      unique(s.applications) &&
      Array.isArray(s.boards) &&
      s.boards.every(
        (b) =>
          b &&
          text(b.id) &&
          !!b.id &&
          text(b.name) &&
          !!b.name.trim() &&
          webURL(b.url) &&
          Number.isInteger(b.frequency) &&
          b.frequency > 0 &&
          text(b.checked) &&
          !Number.isNaN(Date.parse(b.checked)) &&
          /^#[a-f\d]{6}$/i.test(b.color),
      ) &&
      unique(s.boards) &&
      !!s.settings &&
      text(s.settings.name) &&
      typeof s.settings.notifications === "boolean" &&
      typeof s.settings.launchOnLogin === "boolean"
    );
  } catch {
    return false;
  }
}
export const boardDue = (b: Board) =>
  Date.now() - new Date(b.checked).getTime() >= b.frequency * 86400000;
