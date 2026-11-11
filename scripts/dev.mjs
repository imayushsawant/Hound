import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// The hosted Make preview has no desktop/display; normal local use launches Electron.
const preview = Boolean(process.env.FIGMA || process.env.PORT || process.env.FIGMA_DEV_SERVER_HOST);
const executable = preview
  ? new URL("bin/vite.js", import.meta.resolve("vite/package.json"))
  : new URL("../bin/electron-vite.js", import.meta.resolve("electron-vite"));
const child = spawn(process.execPath, [fileURLToPath(executable), ...(preview ? [] : ["dev"])], {
  stdio: "inherit",
  env: process.env,
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
