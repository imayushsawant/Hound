import type { Repository } from "./db/repository.ts";
import { channels } from "../../src/shared/api.ts";
import type {
  CreateCompanyInput,
  UpdateCompanyInput,
  CreateApplicationInput,
  UpdateApplicationInput,
  CreateRoundInput,
  UpdateRoundInput,
  CreateBoardInput,
  UpdateBoardInput,
} from "../../src/shared/api.ts";

export function registerDataIpcHandlers(
  ipcMain: Electron.IpcMain,
  repository: Repository,
  trusted: (event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) => void,
) {
  // Companies
  ipcMain.handle(channels.companiesList, (event) => {
    trusted(event);
    return repository.listCompanies();
  });

  ipcMain.handle(channels.companiesGet, (event, id: number) => {
    trusted(event);
    return repository.getCompany(id);
  });

  ipcMain.handle(channels.companiesCreate, (event, input: CreateCompanyInput) => {
    trusted(event);
    return repository.createCompany(input);
  });

  ipcMain.handle(channels.companiesUpdate, (event, id: number, input: UpdateCompanyInput) => {
    trusted(event);
    return repository.updateCompany(id, input);
  });

  ipcMain.handle(channels.companiesDelete, (event, id: number) => {
    trusted(event);
    return repository.deleteCompany(id);
  });

  // Applications
  ipcMain.handle(channels.applicationsList, (event, filter?: { companyId?: number; status?: string }) => {
    trusted(event);
    return repository.listApplications(filter);
  });

  ipcMain.handle(channels.applicationsGet, (event, id: number) => {
    trusted(event);
    return repository.getApplication(id);
  });

  ipcMain.handle(channels.applicationsCreate, (event, input: CreateApplicationInput) => {
    trusted(event);
    return repository.createApplication(input);
  });

  ipcMain.handle(channels.applicationsUpdate, (event, id: number, input: UpdateApplicationInput) => {
    trusted(event);
    return repository.updateApplication(id, input);
  });

  ipcMain.handle(channels.applicationsDelete, (event, id: number) => {
    trusted(event);
    return repository.deleteApplication(id);
  });

  // Rounds
  ipcMain.handle(channels.roundsListByApplication, (event, applicationId: number) => {
    trusted(event);
    return repository.listRounds(applicationId);
  });

  ipcMain.handle(channels.roundsGet, (event, id: number) => {
    trusted(event);
    return repository.getRound(id);
  });

  ipcMain.handle(channels.roundsCreate, (event, input: CreateRoundInput) => {
    trusted(event);
    return repository.createRound(input);
  });

  ipcMain.handle(channels.roundsUpdate, (event, id: number, input: UpdateRoundInput) => {
    trusted(event);
    return repository.updateRound(id, input);
  });

  ipcMain.handle(channels.roundsDelete, (event, id: number) => {
    trusted(event);
    return repository.deleteRound(id);
  });

  // Boards
  ipcMain.handle(channels.boardsList, (event) => {
    trusted(event);
    return repository.listBoards();
  });

  ipcMain.handle(channels.boardsGet, (event, id: number) => {
    trusted(event);
    return repository.getBoard(id);
  });

  ipcMain.handle(channels.boardsCreate, (event, input: CreateBoardInput) => {
    trusted(event);
    return repository.createBoard(input);
  });

  ipcMain.handle(channels.boardsUpdate, (event, id: number, input: UpdateBoardInput) => {
    trusted(event);
    return repository.updateBoard(id, input);
  });

  ipcMain.handle(channels.boardsDelete, (event, id: number) => {
    trusted(event);
    return repository.deleteBoard(id);
  });
}
