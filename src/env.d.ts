import type { NudgeAPI } from "./shared/api";

declare global {
  interface Window {
    nudge?: NudgeAPI;
  }
}
