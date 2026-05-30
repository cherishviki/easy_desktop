import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray
} from "electron";
import fs from "node:fs";
import path from "node:path";
import type { DesktopApp, ShortcutResult, ShortcutUpdate } from "../shared/types";
import { createAppId, scanUserDesktop } from "./appScanner";
import { findDuplicate, ShortcutStore, validateShortcut } from "./shortcutStore";
import { GlobalShortcutService } from "./globalShortcuts";
import { UserAppStore } from "./userAppStore";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let appsCache: DesktopApp[] = [];
let windowBounds: { x?: number; y?: number; width: number; height: number } = { width: 980, height: 680 };

const START_HIDDEN_ARG = "--hidden";
configureElectronStorage();

const store = new ShortcutStore();
const userAppStore = new UserAppStore();
const globalShortcuts = new GlobalShortcutService();

function configureElectronStorage(): void {
  const appDataPath = app.getPath("appData");
  const sessionDataPath = path.join(appDataPath, "EasyDesktop", "Session");
  const cachePath = path.join(sessionDataPath, "Cache");

  fs.mkdirSync(sessionDataPath, { recursive: true });
  fs.mkdirSync(cachePath, { recursive: true });

  app.setPath("sessionData", sessionDataPath);
  app.commandLine.appendSwitch("disk-cache-dir", cachePath);
  app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
  app.commandLine.appendSwitch("disable-gpu");
  app.commandLine.appendSwitch("disable-software-rasterizer");
}

function createApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "文件",
      submenu: [
        {
          label: "添加应用",
          accelerator: "CmdOrCtrl+O",
          click: () => {
            void chooseAppsToAdd().then(sendAppsUpdated).catch(showAddAppError);
          }
        },
        {
          label: "添加文件夹",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => {
            void chooseFoldersToAdd().then(sendAppsUpdated).catch(showAddFolderError);
          }
        },
        {
          label: "刷新应用列表",
          accelerator: "F5",
          click: () => {
            void refreshApps().then(sendAppsUpdated);
          }
        },
        { type: "separator" },
        {
          label: "退出",
          accelerator: "Alt+F4",
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]
    },
    {
      label: "视图",
      submenu: [
        { label: "重新加载", role: "reload" },
        { label: "强制重新加载", role: "forceReload" },
        { type: "separator" },
        { label: "重置缩放", role: "resetZoom" },
        { label: "放大", role: "zoomIn" },
        { label: "缩小", role: "zoomOut" },
        { type: "separator" },
        { label: "全屏", role: "togglefullscreen" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        { label: "最小化", role: "minimize" },
        {
          label: "显示窗口",
          click: () => {
            showOrCreateWindow();
          }
        }
      ]
    },
    {
      label: "帮助",
      submenu: [
        {
          label: "关于 Easy Desktop",
          click: () => {
            if (!mainWindow) {
              return;
            }

            void dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "关于 Easy Desktop",
              message: "Easy Desktop",
              detail: "Windows 桌面应用启动器"
            });
          }
        }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function showOrCreateWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow();
  mainWindow?.show();
  mainWindow?.focus();
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 980,
    height: 680,
    minWidth: 760,
    minHeight: 520,
    title: "Easy Desktop",
    backgroundColor: "#f7f4ed",
    show: !shouldStartHidden(),
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      const bounds = mainWindow?.getBounds();
      if (bounds) {
        windowBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      }
      mainWindow?.destroy();
      mainWindow = null;
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  if (shouldStartHidden()) {
    mainWindow.once("ready-to-show", () => {
      mainWindow?.hide();
    });
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
        showOrCreateWindow();
      }
    },
    {
      label: "刷新应用列表",
      click: () => {
        void refreshApps().then(sendAppsUpdated);
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
    showOrCreateWindow();
  });
}

async function refreshApps(): Promise<DesktopApp[]> {
  const userApps = userAppStore.getAll();
  appsCache = await scanUserDesktop(store.getAll(), userApps.customPaths, userApps.hiddenAppIds);
  globalShortcuts.setApps(appsCache);
  return appsCache;
}

function shouldStartHidden(): boolean {
  return process.argv.includes(START_HIDDEN_ARG);
}

function getLoginItemArgs(): string[] {
  return process.defaultApp ? [app.getAppPath(), START_HIDDEN_ARG] : [START_HIDDEN_ARG];
}

function getStartupEnabled(): boolean {
  return app.getLoginItemSettings({
    path: process.execPath,
    args: getLoginItemArgs()
  }).openAtLogin;
}

function getAddDialogDefaultPath(): string | undefined {
  const home = app.getPath("home");
  const root = path.parse(home).root;
  const programData = getEnvValue("ProgramData");
  const appData = getEnvValue("APPDATA");
  const candidates = [
    programData
      ? path.join(programData, "Microsoft", "Windows", "Start Menu", "Programs")
      : path.join(root, "ProgramData", "Microsoft", "Windows", "Start Menu", "Programs"),
    appData
      ? path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs")
      : undefined,
    app.getPath("desktop"),
    path.join(home, "Desktop")
  ].filter((item): item is string => Boolean(item));

  return candidates.find((item) => fs.existsSync(item));
}

function getEnvValue(name: string): string | undefined {
  const key = Object.keys(process.env).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? process.env[key] : undefined;
}

function sendAppsUpdated(apps: DesktopApp[]): void {
  mainWindow?.webContents.send("apps:updated", apps);
}

function showAddAppError(error: unknown): void {
  showSelectionError("添加应用失败", error);
}

function showAddFolderError(error: unknown): void {
  showSelectionError("添加文件夹失败", error);
}

function showSelectionError(title: string, error: unknown): void {
  const message = error instanceof Error ? error.message : title;
  if (mainWindow) {
    void dialog.showMessageBox(mainWindow, {
      type: "error",
      title,
      message
    });
  }
}

async function chooseAppsToAdd(): Promise<DesktopApp[]> {
  const dialogOptions: Electron.OpenDialogOptions = {
    title: "选择要添加的应用或文件",
    defaultPath: getAddDialogDefaultPath(),
    buttonLabel: "添加",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "应用和快捷方式", extensions: ["exe", "lnk", "appref-ms"] },
      { name: "所有文件", extensions: ["*"] }
    ]
  };

  return choosePathsToAdd(dialogOptions);
}

async function chooseFoldersToAdd(): Promise<DesktopApp[]> {
  const dialogOptions: Electron.OpenDialogOptions = {
    title: "选择要添加的文件夹",
    defaultPath: app.getPath("desktop"),
    buttonLabel: "添加文件夹",
    properties: ["openDirectory", "multiSelections"]
  };

  return choosePathsToAdd(dialogOptions);
}

async function choosePathsToAdd(dialogOptions: Electron.OpenDialogOptions): Promise<DesktopApp[]> {
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions);

  if (result.canceled || result.filePaths.length === 0) {
    return appsCache;
  }

  for (const selectedPath of result.filePaths) {
    await userAppStore.addCustomPath(selectedPath);
    await userAppStore.unhideApp(createAppId(selectedPath));
  }

  return refreshApps();
}

function setStartupEnabled(enabled: boolean): boolean {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: getLoginItemArgs()
  });

  return getStartupEnabled();
}

function registerIpc(): void {
  ipcMain.handle("apps:list", async () => appsCache);

  ipcMain.handle("apps:refresh", async () => refreshApps());

  ipcMain.handle("apps:add", async (): Promise<DesktopApp[]> => {
    return chooseAppsToAdd();
  });

  ipcMain.handle("folders:add", async (): Promise<DesktopApp[]> => {
    return chooseFoldersToAdd();
  });

  ipcMain.handle("apps:remove", async (_event, appId: string): Promise<ShortcutResult> => {
    const desktopApp = appsCache.find((item) => item.id === appId);
    if (!desktopApp) {
      return { ok: false, message: "找不到应用" };
    }

    await store.clear(appId);
    if (desktopApp.source === "custom") {
      await userAppStore.removeCustomPath(desktopApp.path);
    } else {
      await userAppStore.hideApp(appId);
    }

    return { ok: true, apps: await refreshApps() };
  });

  ipcMain.handle("startup:get", async () => getStartupEnabled());

  ipcMain.handle("startup:set", async (_event, enabled: boolean) => setStartupEnabled(enabled));

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
  userAppStore.load();
  registerIpc();
  await refreshApps();
  createApplicationMenu();
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
