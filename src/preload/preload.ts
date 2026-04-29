import { contextBridge, ipcRenderer } from "electron";
import type { LauncherApi, ShortcutUpdate } from "../shared/types";

const api: LauncherApi = {
  listApps: () => ipcRenderer.invoke("apps:list"),
  refreshApps: () => ipcRenderer.invoke("apps:refresh"),
  openApp: (appId: string) => ipcRenderer.invoke("apps:open", appId),
  setShortcut: (update: ShortcutUpdate) => ipcRenderer.invoke("shortcuts:set", update),
  clearShortcut: (appId: string) => ipcRenderer.invoke("shortcuts:clear", appId)
};

contextBridge.exposeInMainWorld("launcher", api);
