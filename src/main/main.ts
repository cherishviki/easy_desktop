import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray
} from "electron";
import path from "node:path";
import type { DesktopApp, ShortcutResult, ShortcutUpdate } from "../shared/types";
import { scanUserDesktop } from "./appScanner";
import { findDuplicate, ShortcutStore, validateShortcut } from "./shortcutStore";
import { GlobalShortcutService } from "./globalShortcuts";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let appsCache: DesktopApp[] = [];

const store = new ShortcutStore();
const globalShortcuts = new GlobalShortcutService();

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 760,
    minHeight: 520,
    title: "Easy Desktop",
    backgroundColor: "#f7f4ed",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }
}

function createTray(): void {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVR4AWP4//8/AyWYYVQAphg1gG4aNWDUAAYAAG9vAxH+0Y8vAAAAAElFTkSuQmCC"
  );

  tray = new Tray(icon);
  tray.setToolTip("Easy Desktop");
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: "显示窗口",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      }
    },
    {
      label: "刷新应用列表",
      click: () => {
        void refreshApps();
      }
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]));

  tray.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

async function refreshApps(): Promise<DesktopApp[]> {
  appsCache = await scanUserDesktop(store.getAll());
  globalShortcuts.setApps(appsCache);
  return appsCache;
}

function registerIpc(): void {
  ipcMain.handle("apps:list", async () => appsCache);

  ipcMain.handle("apps:refresh", async () => refreshApps());

  ipcMain.handle("apps:open", async (_event, appId: string) => {
    const desktopApp = appsCache.find((item) => item.id === appId);
    if (!desktopApp) {
      throw new Error("找不到应用");
    }

    const error = await shell.openPath(desktopApp.path);
    if (error) {
      throw new Error(error);
    }
  });

  ipcMain.handle("shortcuts:set", async (_event, update: ShortcutUpdate): Promise<ShortcutResult> => {
    const shortcut = update.shortcut.trim();
    const validationError = validateShortcut(shortcut);
    if (validationError) {
      return { ok: false, message: validationError };
    }

    const duplicateAppId = findDuplicate(store.getAll(), update.appId, shortcut);
    if (duplicateAppId) {
      const duplicateApp = appsCache.find((item) => item.id === duplicateAppId);
      return {
        ok: false,
        message: duplicateApp ? `快捷键已被“${duplicateApp.name}”使用` : "快捷键已被其他应用使用"
      };
    }

    await store.set(update.appId, shortcut);
    return { ok: true, apps: await refreshApps() };
  });

  ipcMain.handle("shortcuts:clear", async (_event, appId: string): Promise<ShortcutResult> => {
    await store.clear(appId);
    return { ok: true, apps: await refreshApps() };
  });
}

app.whenReady().then(async () => {
  store.load();
  registerIpc();
  await refreshApps();
  createWindow();
  createTray();
  globalShortcuts.start();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  globalShortcuts.stop();
});
