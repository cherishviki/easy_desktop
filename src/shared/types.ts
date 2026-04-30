export type DesktopApp = {
  id: string;
  name: string;
  path: string;
  extension: ".lnk" | "folder";
  iconDataUrl?: string;
  shortcut?: string;
};

export type ShortcutUpdate = {
  appId: string;
  shortcut: string;
};

export type ShortcutResult = {
  ok: true;
  apps: DesktopApp[];
} | {
  ok: false;
  message: string;
};

export type LauncherApi = {
  listApps: () => Promise<DesktopApp[]>;
  refreshApps: () => Promise<DesktopApp[]>;
  openApp: (appId: string) => Promise<void>;
  setShortcut: (update: ShortcutUpdate) => Promise<ShortcutResult>;
  clearShortcut: (appId: string) => Promise<ShortcutResult>;
};
