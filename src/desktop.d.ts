import type { HoundAPI, NudgeAPI } from "./shared/api";

export interface SelectedResumeFile {
  filePath: string;
  fileName: string;
}

export interface SaveResumeInput {
  companyName: string;
  role: string;
  date?: string;
  sourcePath?: string;
  fileName?: string;
  fileBuffer?: ArrayBuffer | Uint8Array;
}

export interface SaveResumeResult {
  success: boolean;
  relativePath: string;
  fileName: string;
  folderPath: string;
  fullPath: string;
  error?: string;
}

export {};
declare global {
  interface Window {
    hound?: HoundAPI;
    nudge?: NudgeAPI;
    houndDesktop?: {
      load: () => Promise<unknown>;
      save: (data: unknown) => Promise<void>;
      setLogin: (enabled: boolean) => Promise<boolean>;
      notify: (title: string, body: string) => void;
      onQuickAdd: (callback: () => void) => () => void;
      onDataChanged: (callback: () => void) => () => void;
      onNavigateRoute?: (callback: (route: string) => void) => () => void;
      closeQuickAdd?: () => void;
      openDataFolder?: () => Promise<boolean>;
      selectResumeFile?: () => Promise<SelectedResumeFile | null>;
      saveResumeFile?: (input: SaveResumeInput) => Promise<SaveResumeResult>;
      openResumesFolder?: () => Promise<string>;
      openPath?: (path: string) => Promise<boolean>;
      showItemInFolder?: (path: string) => Promise<boolean>;
      getResumesPath?: () => Promise<string>;
      getPathForFile?: (file: File) => string;
    };
  }
}
