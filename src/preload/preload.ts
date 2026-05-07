import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApp, LauncherApi, ShortcutUpdate } from "../shared/types";

const api: LauncherApi = {
  listApps: () => ipcRenderer.invoke("apps:list"),
  refreshApps: () => ipcRenderer.invoke("apps:refresh"),
  addApp: () => ipcRenderer.invoke("apps:add"),
  removeApp: (appId: string) => ipcRenderer.invoke("apps:remove", appId),
  getStartupEnabled: () => ipcRenderer.invoke("startup:get"),
  setStartupEnabled: (enabled: boolean) => ipcRenderer.invoke("startup:set", enabled),
  openApp: (appId: string) => ipcRenderer.invoke("apps:open", appId),
  setShortcut: (update: ShortcutUpdate) => ipcRenderer.invoke("shortcuts:set", update),
  clearShortcut: (appId: string) => ipcRenderer.invoke("shortcuts:clear", appId),
  onAppsUpdated: (callback: (apps: DesktopApp[]) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, apps: DesktopApp[]) => {
      callback(apps);
    };
    ipcRenderer.on("apps:updated", listener);
    return () => {
      ipcRenderer.removeListener("apps:updated", listener);
    };
  }
};

contextBridge.exposeInMainWorld("launcher", api);
