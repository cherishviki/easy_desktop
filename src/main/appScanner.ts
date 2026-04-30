import { app, shell } from "electron";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { DesktopApp } from "../shared/types";

const DESKTOP_EXTENSIONS = new Set([".lnk", ".url"]);
type DesktopEntry = {
  path: string;
  type: DesktopApp["extension"];
};
const COMMON_CHINESE_NAMES = new Map<string, string>([
  ["wechat", "微信"],
  ["weixin", "微信"],
  ["wechatwork", "企业微信"],
  ["wxwork", "企业微信"],
  ["qq", "QQ"],
  ["tim", "TIM"],
  ["tencent meeting", "腾讯会议"],
  ["voov meeting", "腾讯会议"],
  ["dingtalk", "钉钉"],
  ["feishu", "飞书"],
  ["lark", "飞书"],
  ["baidunetdisk", "百度网盘"],
  ["baidu netdisk", "百度网盘"],
  ["wps office", "WPS Office"],
  ["wps", "WPS Office"],
  ["netease cloud music", "网易云音乐"],
  ["cloudmusic", "网易云音乐"]
]);

export function createAppId(filePath: string): string {
  return crypto.createHash("sha1").update(filePath.toLowerCase()).digest("hex");
}

export async function scanUserDesktop(shortcuts: Record<string, string>): Promise<DesktopApp[]> {
  const desktopEntries = await findDesktopEntries(getDesktopShortcutDirs());
  const apps: DesktopApp[] = [];
  const seen = new Set<string>();

  for (const entry of desktopEntries) {
    const filePath = entry.path;
    const dedupeKey = filePath.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);

    const id = createAppId(filePath);
    const iconDataUrl = await getDesktopEntryIconDataUrl(filePath, entry.type);
    const rawName = path.basename(filePath, entry.type === "folder" ? undefined : entry.type);

    apps.push({
      id,
      name: localizeAppName(rawName),
      path: filePath,
      extension: entry.type,
      iconDataUrl,
      shortcut: shortcuts[id]
    });
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}

function getDesktopShortcutDirs(): string[] {
  const home = app.getPath("home");
  const publicDir = process.env.PUBLIC ?? path.join(path.parse(home).root, "Users", "Public");

  return [
    app.getPath("desktop"),
    path.join(home, "Desktop"),
    path.join(publicDir, "Desktop")
  ];
}

async function findDesktopEntries(dirs: string[]): Promise<DesktopEntry[]> {
  const uniqueDirs = [...new Set(dirs.map((dir) => path.normalize(dir)))];
  const entries = await Promise.all(uniqueDirs.map((dir) => collectDesktopEntries(dir)));
  return entries.flat();
}

async function collectDesktopEntries(dir: string): Promise<DesktopEntry[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const desktopEntries: DesktopEntry[] = [];

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      desktopEntries.push({ path: filePath, type: "folder" });
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (DESKTOP_EXTENSIONS.has(extension)) {
      desktopEntries.push({ path: filePath, type: extension as DesktopApp["extension"] });
    }
  }

  return desktopEntries;
}

function localizeAppName(name: string): string {
  const normalized = name.replace(/[_-]+/g, " ").trim().toLowerCase();
  return COMMON_CHINESE_NAMES.get(normalized) ?? name;
}

async function getDesktopEntryIconDataUrl(filePath: string, entryType: DesktopApp["extension"]): Promise<string | undefined> {
  const iconSources = await getIconSources(filePath, entryType);

  for (const iconSource of iconSources) {
    const iconDataUrl = await app.getFileIcon(iconSource, { size: "normal" })
      .then((icon) => icon.isEmpty() ? undefined : icon.toDataURL())
      .catch(() => undefined);

    if (iconDataUrl) {
      return iconDataUrl;
    }
  }

  return undefined;
}

async function getIconSources(filePath: string, entryType: DesktopApp["extension"]): Promise<string[]> {
  const sources: string[] = [];

  if (entryType === ".lnk") {
    const shortcut = readWindowsShortcut(filePath);
    if (shortcut?.icon) {
      sources.push(resolveIconPath(shortcut.icon, shortcut.cwd || path.dirname(filePath)));
    }
    if (shortcut?.target) {
      sources.push(expandEnvironmentVariables(shortcut.target));
    }
  }

  if (entryType === ".url") {
    const iconFile = await readInternetShortcutIcon(filePath);
    if (iconFile) {
      sources.push(expandEnvironmentVariables(iconFile));
    }
  }

  sources.push(filePath);

  return [...new Set(sources.filter(Boolean))];
}

function readWindowsShortcut(filePath: string): Electron.ShortcutDetails | undefined {
  if (process.platform !== "win32") {
    return undefined;
  }

  try {
    return shell.readShortcutLink(filePath);
  } catch {
    return undefined;
  }
}

async function readInternetShortcutIcon(filePath: string): Promise<string | undefined> {
  const content = await fs.readFile(filePath, "utf8").catch(() => "");
  const iconFile = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.toLowerCase().startsWith("iconfile="));

  return iconFile?.slice("IconFile=".length).trim() || undefined;
}

function expandEnvironmentVariables(value: string): string {
  return value.replace(/%([^%]+)%/g, (match, name: string) => {
    const envKey = Object.keys(process.env).find((key) => key.toLowerCase() === name.toLowerCase());
    return envKey ? process.env[envKey] ?? match : match;
  });
}

function resolveIconPath(iconPath: string, baseDir: string): string {
  const expandedPath = expandEnvironmentVariables(iconPath);
  return path.isAbsolute(expandedPath) ? expandedPath : path.resolve(baseDir, expandedPath);
}
