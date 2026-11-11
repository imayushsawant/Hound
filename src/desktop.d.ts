import type { HoundAPI, NudgeAPI } from "./shared/api";

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
    };
  }
}
