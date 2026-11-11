const { app, BrowserWindow, ipcMain } = require("electron");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, dirname } = require("node:path");
const { pathToFileURL } = require("node:url");
const assert = require("node:assert/strict");

const userData = mkdtempSync(join(tmpdir(), "nudge-shell-test-"));
app.setPath("userData", userData);
app.disableHardwareAcceleration();
let handled = false;
let requests = 0;
const originalHandle = ipcMain.handle.bind(ipcMain);
ipcMain.handle = (channel, listener) =>
  originalHandle(channel, (...args) => {
    if (channel === "app:info") requests++;
    return listener(...args);
  });
const timeout = setTimeout(() => {
  console.error("Shell test timed out");
  app.exit(1);
}, 20000);
const waitFor = (contents, expression) =>
  contents.executeJavaScript(`
  new Promise((resolve, reject) => {
    const deadline = Date.now() + 5000;
    const check = () => {
      if (${expression}) resolve(true);
      else if (Date.now() > deadline) reject(new Error('UI condition timed out'));
      else setTimeout(check, 30);
    };
    check();
  })
`);

app.on("browser-window-created", (_event, window) => {
  if (handled) return;
  handled = true;
  window.webContents.once("did-finish-load", async () => {
    try {
      const contents = window.webContents;
      await waitFor(
        contents,
        `document.querySelector('.workspace-status')?.textContent === 'Local workspace'`,
      );
      assert.equal(await contents.executeJavaScript("document.title"), "Nudge — Your next chapter");
      const info = await contents.executeJavaScript("window.nudge.getAppInfo()");
      assert.equal(info.database.schemaVersion, 1);
      assert.equal(await contents.executeJavaScript("typeof window.require"), "undefined");
      assert.equal(await contents.executeJavaScript("typeof window.process"), "undefined");
      const preferences = contents.getLastWebPreferences();
      assert.equal(preferences.contextIsolation, true);
      assert.equal(preferences.nodeIntegration, false);
      assert.equal(preferences.sandbox, true);

      const before = requests;
      contents.send("data:changed");
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.ok(requests > before, "successful writes must trigger a refetch");

      for (const [route, title] of [
        ["/companies", "Good company. New possibilities."],
        ["/boards", "Good things are out there."],
        ["/settings", "Simple. Local. Yours."],
        ["/", "Small steps. New possibilities."],
      ]) {
        await contents.executeJavaScript(
          `document.querySelector('nav a[href="#${route}"]').click()`,
        );
        await waitFor(
          contents,
          `document.querySelector('h1')?.textContent === ${JSON.stringify(title)}`,
        );
      }
      await contents.executeJavaScript(`location.hash = '#/unknown'`);
      await waitFor(contents, `location.hash === '#/'`);
      assert.equal(
        await contents.executeJavaScript(`document.querySelector('.nudge-add-button').disabled`),
        true,
      );
      assert.equal(
        await contents.executeJavaScript(
          `document.querySelectorAll('input, textarea, select').length`,
        ),
        0,
      );

      window.setMinimumSize(320, 500);
      window.setSize(390, 844);
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(
        await contents.executeJavaScript("document.documentElement.scrollWidth > innerWidth"),
        false,
        "no horizontal page overflow",
      );

      // A renderer without the preload must show an honest, storage-free web preview.
      const web = new BrowserWindow({
        show: false,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      });
      await web.loadFile(join(dirname(process.env.NUDGE_TEST_MAIN), "../renderer/index.html"));
      await waitFor(
        web.webContents,
        `document.querySelector('.workspace-status')?.textContent === 'Web preview'`,
      );
      assert.equal(await web.webContents.executeJavaScript("typeof window.nudge"), "undefined");
      assert.ok(
        await web.webContents.executeJavaScript(
          `document.body.textContent.includes('No database connected')`,
        ),
      );

      console.log(
        "PASS: desktop boot, SQLite IPC, security settings, four routes, fallback, event refetch, responsive layout, storage-free browser mode",
      );
      clearTimeout(timeout);
      app.quit();
    } catch (error) {
      console.error(error);
      clearTimeout(timeout);
      app.exit(1);
    }
  });
});
app.on("quit", () => rmSync(userData, { recursive: true, force: true }));
import(pathToFileURL(process.env.NUDGE_TEST_MAIN).href).catch((error) => {
  console.error(error);
  app.exit(1);
});
