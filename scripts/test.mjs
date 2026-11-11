import { spawnSync } from "node:child_process";
import electron from "electron";

const testFiles = [
  "tests/database.test.ts",
  "tests/data_layer.test.ts",
  "tests/integration_audit.test.ts",
];
const runner = process.env.TEST_WITH_ELECTRON ? electron : process.execPath;
const result = spawnSync(
  runner,
  ["--experimental-strip-types", "--test", ...testFiles],
  {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    stdio: "inherit",
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
