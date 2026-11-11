import { contextBridge, ipcRenderer } from "electron";
import { channels, type NudgeAPI } from "../../src/shared/api";

const api: NudgeAPI = {
  getAppInfo: () => ipcRenderer.invoke(channels.appInfo),
  onDataChanged: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(channels.dataChanged, handler);
    return () => ipcRenderer.removeListener(channels.dataChanged, handler);
  },
};

contextBridge.exposeInMainWorld("nudge", api);

contextBridge.exposeInMainWorld("houndDesktop", {
  load: () => ipcRenderer.invoke("workspace:load"),
  save: (data: unknown) => ipcRenderer.invoke("workspace:save", data),
  setLogin: (enabled: boolean) => ipcRenderer.invoke("desktop:login", enabled),
  notify: (title: string, body: string) => ipcRenderer.send("desktop:notify", title, body),
  onDataChanged: api.onDataChanged,
  onQuickAdd: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on("desktop:quick-add", handler);
    return () => ipcRenderer.removeListener("desktop:quick-add", handler);
  },
});
