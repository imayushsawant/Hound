import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import electron from "electron";

const env = { ...process.env, NUDGE_TEST_MAIN: resolve("out/main/index.js") };
delete env.ELECTRON_RUN_AS_NODE;
delete env.ELECTRON_RENDERER_URL;
const result = spawnSync(
  electron,
  [
    ...(process.platform === "linux" ? ["--ozone-platform=headless"] : []),
    resolve("tests/shell.cjs"),
  ],
  { env, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
