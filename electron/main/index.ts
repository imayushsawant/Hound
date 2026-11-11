import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
  globalShortcut,
  Menu,
  nativeImage,
  Notification,
  shell,
  Tray,
} from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { channels, type AppInfo } from "../../src/shared/api";
import { Repository } from "./db/repository";
import { registerDataIpcHandlers } from "./ipc";
import { Scheduler } from "./scheduler";

const here = dirname(fileURLToPath(import.meta.url));
const rendererFile = join(here, "../renderer/index.html");
const devURL = process.env.ELECTRON_RENDERER_URL;
let repository: Repository | undefined;
let scheduler: Scheduler | undefined;
let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let quitting = false;

function trusted(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) {
  const expectedURL = devURL ? new URL(devURL).href : pathToFileURL(rendererFile).href;
  if (
    !BrowserWindow.fromWebContents(event.sender) ||
    event.senderFrame !== event.sender.mainFrame ||
    event.senderFrame.url.split("#")[0] !== expectedURL.split("#")[0]
  ) {
    throw new Error("Untrusted IPC sender");
  }
}
function showWindow(quickAdd = false) {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
  if (mainWindow!.isMinimized()) mainWindow!.restore();
  mainWindow!.show();
  mainWindow!.focus();
  if (quickAdd) mainWindow!.webContents.send("desktop:quick-add");
}

function focusApp(route?: string) {
  showWindow();
  if (route && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("navigate:route", route);
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    title: "Hound",
    backgroundColor: "#fafbf9",
    icon: join(here, "../renderer/hound.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(here, "../preload/index.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  mainWindow = window;
  window.on("close", (event) => {
    if (!quitting && tray) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on("closed", () => {
    mainWindow = undefined;
  });
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  if (devURL) void window.loadURL(devURL);
  else void window.loadFile(rendererFile);
}

app.setName("Hound");
if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => showWindow());
app
  .whenReady()
  .then(() => {
    repository = new Repository(app.getPath("userData"), join(here, "migrations"), () => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(channels.dataChanged);
      }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const development = devURL
        ? ` ${new URL(devURL).origin} ${new URL(devURL).origin.replace(/^http/, "ws")}`
        : "";
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            `default-src 'self'; script-src 'self'${devURL ? " 'unsafe-inline'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${development}; object-src 'none'; base-uri 'none'; frame-src 'none'`,
          ],
        },
      });
    });
    ipcMain.handle(channels.appInfo, (event): AppInfo => {
      trusted(event);
      return {
        name: app.getName(),
        version: app.getVersion(),
        database: { ready: true, schemaVersion: repository!.schemaVersion },
      };
    });
    registerDataIpcHandlers(ipcMain, repository!, trusted);
    ipcMain.handle("workspace:load", (event) => {
      trusted(event);
      return repository!.loadWorkspace();
    });
    ipcMain.handle("workspace:save", (event, data: unknown) => {
      trusted(event);
      return repository!.saveWorkspace(data);
    });
    ipcMain.handle("desktop:login", (event, enabled: boolean) => {
      trusted(event);
      if (typeof enabled !== "boolean") throw new Error("Invalid preference");
      app.setLoginItemSettings({ openAtLogin: enabled });
      return app.getLoginItemSettings().openAtLogin;
    });
    ipcMain.on("desktop:notify", (event, title: unknown, body: unknown) => {
      trusted(event);
      if (
        typeof title !== "string" ||
        typeof body !== "string" ||
        title.length > 200 ||
        body.length > 1000
      )
        return;
      if (Notification.isSupported())
        new Notification({ title, body, icon: join(here, "../renderer/hound.png") }).show();
    });
    createWindow();
    scheduler = new Scheduler(repository!, {
      onFocusApp: (route) => focusApp(route),
      iconPath: join(here, "../renderer/hound.png"),
    });
    scheduler.start();
    const icon = nativeImage
      .createFromPath(join(here, "../renderer/hound.png"))
      .resize({ width: 20, height: 20 });
    tray = new Tray(icon);
    tray.setToolTip("Hound — Your next chapter");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "Open Hound", click: () => showWindow() },
        {
          label: "Add application",
          accelerator: "CommandOrControl+Shift+J",
          click: () => showWindow(true),
        },
        { type: "separator" },
        {
          label: "Quit Hound",
          click: () => {
            quitting = true;
            app.quit();
          },
        },
      ]),
    );
    tray.on("double-click", () => showWindow());
    globalShortcut.register("CommandOrControl+Shift+J", () => showWindow(true));
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  })
  .catch((error: unknown) => {
    console.error("Hound could not initialize its local database", error);
    dialog.showErrorBox(
      "Hound couldn't start",
      "The local database could not be opened or migrated. Your existing database has not been reset. Please check the application logs.",
    );
    app.quit();
  });
app.on("before-quit", () => {
  quitting = true;
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
  scheduler?.stop();
  repository?.close();
});
app.on("window-all-closed", () => {
  if (!tray && process.platform !== "darwin") app.quit();
});
