export const channels = {
  appInfo: "app:info",
  dataChanged: "data:changed",
} as const;

export interface AppInfo {
  name: string;
  version: string;
  database: { ready: true; schemaVersion: number };
}

export interface NudgeAPI {
  getAppInfo(): Promise<AppInfo>;
  onDataChanged(listener: () => void): () => void;
}
