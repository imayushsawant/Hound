import { useEffect, useState } from "react";
import type { AppInfo } from "../shared/api";

export function useAppInfo() {
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const api = window.nudge;
    if (!api) return;
    let live = true;
    let request = 0;
    const refetch = async () => {
      const current = ++request;
      try {
        const result = await api.getAppInfo();
        if (live && current === request) {
          setInfo(result);
          setError(false);
        }
      } catch {
        if (live && current === request) {
          setInfo(null);
          setError(true);
        }
      }
    };
    const unsubscribe = api.onDataChanged(refetch);
    void refetch();
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  return { info, error, desktop: Boolean(window.nudge) };
}
