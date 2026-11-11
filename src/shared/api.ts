export const ApplicationStatuses = [
  "Saved",
  "Applied",
  "OA",
  "Interview",
  "Offer",
  "Rejected",
  "Ghosted",
  "Withdrawn",
] as const;

export type ApplicationStatus = (typeof ApplicationStatuses)[number];

export const WorkModes = ["internship", "full-time"] as const;
export type WorkMode = (typeof WorkModes)[number];

export const RoundStatuses = ["upcoming", "done", "skipped"] as const;
export type RoundStatus = (typeof RoundStatuses)[number];

export interface Company {
  id: number;
  name: string;
  overview: string | null;
  notes: string | null;
  created_at: string;
  updated_at?: string;
  external_key?: string | null;
  domain?: string;
  color?: string;
}

export interface Application {
  id: number;
  company_id: number;
  role: string;
  status: ApplicationStatus;
  location: string | null;
  work_mode: WorkMode | null;
  source: string | null;
  posting_url: string | null;
  applied_date: string | null;
  resume_used: string | null;
  next_action_override: string | null;
  offer_package: string | null;
  joining_date: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  next_action?: string;
  company_name?: string;
}

export interface Round {
  id: number;
  application_id: number;
  position: number;
  type: string;
  title: string | null;
  scheduled_date: string | null;
  status: RoundStatus;
  next_action: string | null;
  resume_used: string | null;
  prep_notes_md: string | null;
  interview_notes_md: string | null;
  topics_asked: string | null;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: number;
  name: string;
  url: string | null;
  check_every_days: number;
  last_checked_at: string | null;
}

export interface CreateCompanyInput {
  name: string;
  overview?: string | null;
  notes?: string | null;
}

export interface UpdateCompanyInput {
  name?: string;
  overview?: string | null;
  notes?: string | null;
}

export interface CreateApplicationInput {
  company_id?: number;
  company_name?: string;
  role: string;
  status?: ApplicationStatus;
  location?: string | null;
  work_mode?: WorkMode | null;
  source?: string | null;
  posting_url?: string | null;
  applied_date?: string | null;
  resume_used?: string | null;
  next_action_override?: string | null;
  offer_package?: string | null;
  joining_date?: string | null;
  rejection_reason?: string | null;
}

export interface UpdateApplicationInput {
  company_id?: number;
  role?: string;
  status?: ApplicationStatus;
  location?: string | null;
  work_mode?: WorkMode | null;
  source?: string | null;
  posting_url?: string | null;
  applied_date?: string | null;
  resume_used?: string | null;
  next_action_override?: string | null;
  offer_package?: string | null;
  joining_date?: string | null;
  rejection_reason?: string | null;
}

export interface CreateRoundInput {
  application_id: number;
  position?: number;
  type: string;
  title?: string | null;
  scheduled_date?: string | null;
  status?: RoundStatus;
  next_action?: string | null;
  resume_used?: string | null;
  prep_notes_md?: string | null;
  interview_notes_md?: string | null;
  topics_asked?: string | null;
}

export interface UpdateRoundInput {
  position?: number;
  type?: string;
  title?: string | null;
  scheduled_date?: string | null;
  status?: RoundStatus;
  next_action?: string | null;
  resume_used?: string | null;
  prep_notes_md?: string | null;
  interview_notes_md?: string | null;
  topics_asked?: string | null;
}

export interface CreateBoardInput {
  name: string;
  url?: string | null;
  check_every_days: number;
  last_checked_at?: string | null;
}

export interface UpdateBoardInput {
  name?: string;
  url?: string | null;
  check_every_days?: number;
  last_checked_at?: string | null;
}

export const channels = {
  appInfo: "app:info",
  dataChanged: "data:changed",

  // Companies CRUD
  companiesList: "db:companies:list",
  companiesGet: "db:companies:get",
  companiesCreate: "db:companies:create",
  companiesUpdate: "db:companies:update",
  companiesDelete: "db:companies:delete",

  // Applications CRUD
  applicationsList: "db:applications:list",
  applicationsGet: "db:applications:get",
  applicationsCreate: "db:applications:create",
  applicationsUpdate: "db:applications:update",
  applicationsDelete: "db:applications:delete",

  // Rounds CRUD
  roundsListByApplication: "db:rounds:list-by-application",
  roundsGet: "db:rounds:get",
  roundsCreate: "db:rounds:create",
  roundsUpdate: "db:rounds:update",
  roundsDelete: "db:rounds:delete",

  // Boards CRUD
  boardsList: "db:boards:list",
  boardsGet: "db:boards:get",
  boardsCreate: "db:boards:create",
  boardsUpdate: "db:boards:update",
  boardsDelete: "db:boards:delete",
} as const;

export interface AppInfo {
  name: string;
  version: string;
  database: { ready: true; schemaVersion: number };
}

export interface NudgeAPI {
  getAppInfo(): Promise<AppInfo>;
  onDataChanged(listener: () => void): () => void;

  // Companies
  listCompanies(): Promise<Company[]>;
  getCompany(id: number): Promise<Company | null>;
  createCompany(input: CreateCompanyInput): Promise<Company>;
  updateCompany(id: number, input: UpdateCompanyInput): Promise<Company>;
  deleteCompany(id: number): Promise<boolean>;

  // Applications
  listApplications(filter?: { companyId?: number; status?: string }): Promise<Application[]>;
  getApplication(id: number): Promise<Application | null>;
  createApplication(input: CreateApplicationInput): Promise<Application>;
  updateApplication(id: number, input: UpdateApplicationInput): Promise<Application>;
  deleteApplication(id: number): Promise<boolean>;

  // Rounds
  listRounds(applicationId: number): Promise<Round[]>;
  getRound(id: number): Promise<Round | null>;
  createRound(input: CreateRoundInput): Promise<Round>;
  updateRound(id: number, input: UpdateRoundInput): Promise<Round>;
  deleteRound(id: number): Promise<boolean>;

  // Boards
  listBoards(): Promise<Board[]>;
  getBoard(id: number): Promise<Board | null>;
  createBoard(input: CreateBoardInput): Promise<Board>;
  updateBoard(id: number, input: UpdateBoardInput): Promise<Board>;
  deleteBoard(id: number): Promise<boolean>;
}
