import { app } from "electron";
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
  const shortcutPaths = await findShortcutPaths(getWindowsShortcutDirs());
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
    const iconDataUrl = await app.getFileIcon(filePath, { size: "normal" })
      .then((icon) => icon.toDataURL())
      .catch(() => undefined);
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

function getWindowsShortcutDirs(): string[] {
  const home = app.getPath("home");
  const appData = app.getPath("appData");
  const programData = process.env.ProgramData ?? "C:\\ProgramData";
  const publicDir = process.env.PUBLIC ?? path.join(path.parse(home).root, "Users", "Public");

  return [
    app.getPath("desktop"),
    path.join(home, "Desktop"),
    path.join(publicDir, "Desktop"),
    path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs"),
    path.join(programData, "Microsoft", "Windows", "Start Menu", "Programs")
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
