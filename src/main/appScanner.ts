import { app, shell } from "electron";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { DesktopApp } from "../shared/types";

const DESKTOP_EXTENSIONS = new Set([".lnk", ".url"]);
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
  const shortcutPaths = await findShortcutPaths(getDesktopShortcutDirs());
  const apps: DesktopApp[] = [];
  const seen = new Set<string>();

  for (const filePath of shortcutPaths) {
    const extension = path.extname(filePath).toLowerCase();
    const dedupeKey = filePath.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);

    const id = createAppId(filePath);
    const iconDataUrl = await getShortcutIconDataUrl(filePath, extension);
    const rawName = path.basename(filePath, extension);

    apps.push({
      id,
      name: localizeAppName(rawName),
      path: filePath,
      extension: extension as DesktopApp["extension"],
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

async function findShortcutPaths(dirs: string[]): Promise<string[]> {
  const uniqueDirs = [...new Set(dirs.map((dir) => path.normalize(dir)))];
  const shortcuts = await Promise.all(uniqueDirs.map((dir) => collectShortcuts(dir)));
  return shortcuts.flat();
}

async function collectShortcuts(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  const shortcuts: string[] = [];

  for (const entry of entries) {
    const filePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      shortcuts.push(...await collectShortcuts(filePath));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (DESKTOP_EXTENSIONS.has(extension)) {
      shortcuts.push(filePath);
    }
  }

  return shortcuts;
}

function localizeAppName(name: string): string {
  const normalized = name.replace(/[_-]+/g, " ").trim().toLowerCase();
  return COMMON_CHINESE_NAMES.get(normalized) ?? name;
}

async function getShortcutIconDataUrl(filePath: string, extension: string): Promise<string | undefined> {
  const iconSources = await getIconSources(filePath, extension);

  for (const iconSource of iconSources) {
    const iconDataUrl = await app.getFileIcon(iconSource, { size: "normal" })
      .then((icon) => icon.toDataURL())
      .catch(() => undefined);

    if (iconDataUrl) {
      return iconDataUrl;
    }
  }

  return undefined;
}

async function getIconSources(filePath: string, extension: string): Promise<string[]> {
  const sources: string[] = [];

  if (extension === ".lnk") {
    const shortcut = readWindowsShortcut(filePath);
    if (shortcut?.icon) {
      sources.push(expandEnvironmentVariables(shortcut.icon));
    }
    if (shortcut?.target) {
      sources.push(expandEnvironmentVariables(shortcut.target));
    }
  }

  if (extension === ".url") {
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
  return value.replace(/%([^%]+)%/g, (match, name: string) => process.env[name] ?? match);
}
