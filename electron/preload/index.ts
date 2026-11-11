import { contextBridge, ipcRenderer } from "electron";
import {
  channels,
  type NudgeAPI,
  type CreateCompanyInput,
  type UpdateCompanyInput,
  type CreateApplicationInput,
  type UpdateApplicationInput,
  type CreateRoundInput,
  type UpdateRoundInput,
  type CreateBoardInput,
  type UpdateBoardInput,
} from "../../src/shared/api";

const api: NudgeAPI = {
  getAppInfo: () => ipcRenderer.invoke(channels.appInfo),
  onDataChanged: (listener) => {
    const handler = () => listener();
    ipcRenderer.on(channels.dataChanged, handler);
    return () => ipcRenderer.removeListener(channels.dataChanged, handler);
  },

  // Companies
  listCompanies: () => ipcRenderer.invoke(channels.companiesList),
  getCompany: (id: number) => ipcRenderer.invoke(channels.companiesGet, id),
  createCompany: (input: CreateCompanyInput) => ipcRenderer.invoke(channels.companiesCreate, input),
  updateCompany: (id: number, input: UpdateCompanyInput) =>
    ipcRenderer.invoke(channels.companiesUpdate, id, input),
  deleteCompany: (id: number) => ipcRenderer.invoke(channels.companiesDelete, id),

  // Applications
  listApplications: (filter) => ipcRenderer.invoke(channels.applicationsList, filter),
  getApplication: (id: number) => ipcRenderer.invoke(channels.applicationsGet, id),
  createApplication: (input: CreateApplicationInput) =>
    ipcRenderer.invoke(channels.applicationsCreate, input),
  updateApplication: (id: number, input: UpdateApplicationInput) =>
    ipcRenderer.invoke(channels.applicationsUpdate, id, input),
  deleteApplication: (id: number) => ipcRenderer.invoke(channels.applicationsDelete, id),

  // Rounds
  listRounds: (applicationId: number) =>
    ipcRenderer.invoke(channels.roundsListByApplication, applicationId),
  getRound: (id: number) => ipcRenderer.invoke(channels.roundsGet, id),
  createRound: (input: CreateRoundInput) => ipcRenderer.invoke(channels.roundsCreate, input),
  updateRound: (id: number, input: UpdateRoundInput) =>
    ipcRenderer.invoke(channels.roundsUpdate, id, input),
  deleteRound: (id: number) => ipcRenderer.invoke(channels.roundsDelete, id),

  // Boards
  listBoards: () => ipcRenderer.invoke(channels.boardsList),
  getBoard: (id: number) => ipcRenderer.invoke(channels.boardsGet, id),
  createBoard: (input: CreateBoardInput) => ipcRenderer.invoke(channels.boardsCreate, input),
  updateBoard: (id: number, input: UpdateBoardInput) =>
    ipcRenderer.invoke(channels.boardsUpdate, id, input),
  deleteBoard: (id: number) => ipcRenderer.invoke(channels.boardsDelete, id),
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
  onNavigateRoute: (listener: (route: string) => void) => {
    const handler = (_event: any, route: string) => listener(route);
    ipcRenderer.on("navigate:route", handler);
    return () => ipcRenderer.removeListener("navigate:route", handler);
  },
  closeQuickAdd: () => ipcRenderer.send("quick-add:close"),
});
