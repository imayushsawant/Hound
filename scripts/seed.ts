import Database from "better-sqlite3";
import { join } from "node:path";
import { Repository } from "../electron/main/db/repository.ts";

export function seed(repository: Repository) {
  // Clear existing records to ensure idempotent and clean seeding
  repository.db.exec("DELETE FROM rounds; DELETE FROM applications; DELETE FROM companies; DELETE FROM boards;");

  // 1. Five companies
  const stripe = repository.createCompany({
    name: "Stripe",
    overview: "Financial infrastructure platform for the internet.",
    notes: "Applied through referral from college alum.",
  });

  const linear = repository.createCompany({
    name: "Linear",
    overview: "Issue tracking and project management tool built for high-performance product teams.",
    notes: "Loved the product for years, contacted hiring manager on X.",
  });

  const vercel = repository.createCompany({
    name: "Vercel",
    overview: "Frontend cloud platform and creator of Next.js.",
    notes: "Engineering culture is top notch.",
  });

  const figma = repository.createCompany({
    name: "Figma",
    overview: "Collaborative design platform for modern teams.",
    notes: "Met recruiter at conference.",
  });

  const datadog = repository.createCompany({
    name: "Datadog",
    overview: "Observability and security platform for cloud applications.",
    notes: "Applied on careers page.",
  });

  // 2. Eight applications (including multiple per company: Stripe x2, Linear x2)
  const today = new Date();
  const tenDaysAgo = new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twentyDaysAgo = new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // App 1: Stripe - Backend Engineer (OA stage, upcoming round with scheduled date)
  const stripeBackend = repository.createApplication({
    company_id: stripe.id,
    role: "Backend Engineer",
    status: "OA",
    location: "San Francisco, CA (Remote)",
    work_mode: "full-time",
    source: "Referral",
    applied_date: tenDaysAgo,
    resume_used: "Resume_Backend_2026.pdf",
  });

  repository.createRound({
    application_id: stripeBackend.id,
    position: 0,
    type: "DSA OA",
    title: "Codesignal Assessment",
    scheduled_date: new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: "upcoming",
    next_action: "Complete CodeSignal OA before Friday",
  });

  // App 2: Stripe - Infrastructure Intern (Applied > 7 days ago, no rounds -> derived next_action: "Follow up")
  repository.createApplication({
    company_id: stripe.id,
    role: "Infrastructure Intern",
    status: "Applied",
    location: "Seattle, WA",
    work_mode: "internship",
    source: "Careers portal",
    applied_date: tenDaysAgo,
    resume_used: "Resume_Intern_2026.pdf",
  });

  // App 3: Linear - Full Stack Engineer (Interview stage, multiple rounds)
  const linearFullStack = repository.createApplication({
    company_id: linear.id,
    role: "Full Stack Engineer",
    status: "Interview",
    location: "Remote",
    work_mode: "full-time",
    source: "Outreach",
    applied_date: twentyDaysAgo,
    resume_used: "Resume_FullStack_2026.pdf",
  });

  repository.createRound({
    application_id: linearFullStack.id,
    position: 0,
    type: "Aptitude OA",
    title: "Screening Call",
    scheduled_date: twentyDaysAgo,
    status: "done",
    interview_notes_md: "Spoke with recruiter about background, team structure, and values.",
  });

  repository.createRound({
    application_id: linearFullStack.id,
    position: 1,
    type: "Technical",
    title: "System & Architecture Deep Dive",
    scheduled_date: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: "upcoming",
    next_action: "Review CRDTs and offline-sync patterns",
  });

  // App 4: Linear - Product Engineer (Saved stage, manual override next action)
  repository.createApplication({
    company_id: linear.id,
    role: "Product Engineer",
    status: "Saved",
    location: "Remote",
    work_mode: "full-time",
    source: "LinkedIn",
    applied_date: twoDaysAgo,
    next_action_override: "Tailor portfolio for desktop UI work",
  });

  // App 5: Vercel - Solutions Architect (Offer stage)
  repository.createApplication({
    company_id: vercel.id,
    role: "Solutions Architect",
    status: "Offer",
    location: "New York, NY (Hybrid)",
    work_mode: "full-time",
    source: "Inbound Recruiter",
    applied_date: twentyDaysAgo,
    offer_package: "$175,000 + Equity",
    joining_date: "2026-12-01",
    resume_used: "Resume_General_2026.pdf",
  });

  // App 6: Figma - Systems Software Engineer (Rejected)
  repository.createApplication({
    company_id: figma.id,
    role: "Systems Software Engineer",
    status: "Rejected",
    location: "San Francisco, CA",
    work_mode: "full-time",
    source: "Conference",
    applied_date: twentyDaysAgo,
    rejection_reason: "Headcount filled for H2",
  });

  // App 7: Datadog - Site Reliability Engineer (Applied 2 days ago -> no follow-up needed yet)
  repository.createApplication({
    company_id: datadog.id,
    role: "Site Reliability Engineer",
    status: "Applied",
    location: "Boston, MA (Remote)",
    work_mode: "full-time",
    source: "Referral",
    applied_date: twoDaysAgo,
  });

  // App 8: Datadog - Core Platforms Intern (Upcoming round without explicit next_action -> derived "<title> on <date>")
  const datadogIntern = repository.createApplication({
    company_id: datadog.id,
    role: "Core Platforms Intern",
    status: "Interview",
    location: "New York, NY",
    work_mode: "internship",
    source: "Campus fair",
    applied_date: fiveDaysAgo,
  });

  const nextWeekDate = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  repository.createRound({
    application_id: datadogIntern.id,
    position: 0,
    type: "Technical",
    title: "Technical Pairing",
    scheduled_date: nextWeekDate,
    status: "upcoming",
  });

  // 3. Boards
  repository.createBoard({
    name: "Hacker News Who is Hiring",
    url: "https://news.ycombinator.com",
    check_every_days: 30,
    last_checked_at: twoDaysAgo,
  });

  repository.createBoard({
    name: "Wellfound (AngelList)",
    url: "https://wellfound.com/jobs",
    check_every_days: 7,
    last_checked_at: fiveDaysAgo,
  });
}

// Allow direct CLI execution: `node --experimental-strip-types scripts/seed.ts`
if (process.argv[1]?.replace(/\\/g, "/").endsWith("seed.ts")) {
  const defaultUserData = join(process.env.APPDATA || process.env.HOME || ".", ".hound-dev");
  const migrationsDir = join(process.cwd(), "electron", "main", "db", "migrations");
  const repo = new Repository(defaultUserData, migrationsDir, () => {});
  seed(repo);
  console.log("Successfully seeded 5 companies, 8 applications, rounds, and boards.");
  repo.close();
}
