import { spawnSync } from "node:child_process";
import electron from "electron";

// Run against Electron's Node ABI, matching the native SQLite binary installed by postinstall.
const result = spawnSync(
  electron,
  ["--experimental-strip-types", "--test", "tests/database.test.ts"],
  {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
