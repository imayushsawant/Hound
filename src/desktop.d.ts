export {};
declare global {
  interface Window {
    houndDesktop?: {
      load: () => Promise<unknown>;
      save: (data: unknown) => Promise<void>;
      setLogin: (enabled: boolean) => Promise<boolean>;
      notify: (title: string, body: string) => void;
      onQuickAdd: (callback: () => void) => () => void;
      onDataChanged: (callback: () => void) => () => void;
    };
  }
}
