import { app } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type ShortcutMap = Record<string, string>;

const STORE_FILE = "shortcuts.json";

export class ShortcutStore {
  private readonly filePath: string;
  private shortcuts: ShortcutMap = {};

  constructor() {
    this.filePath = path.join(app.getPath("userData"), STORE_FILE);
  }

  load(): ShortcutMap {
    try {
      const content = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(content) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        this.shortcuts = Object.fromEntries(
          Object.entries(parsed).filter(([, value]) => typeof value === "string")
        ) as ShortcutMap;
      }
    } catch {
      this.shortcuts = {};
    }

    return { ...this.shortcuts };
  }

  getAll(): ShortcutMap {
    return { ...this.shortcuts };
  }

  async set(appId: string, shortcut: string): Promise<ShortcutMap> {
    this.shortcuts[appId] = shortcut;
    await this.save();
    return this.getAll();
  }

  async clear(appId: string): Promise<ShortcutMap> {
    delete this.shortcuts[appId];
    await this.save();
    return this.getAll();
  }

  private async save(): Promise<void> {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    await fsp.writeFile(this.filePath, JSON.stringify(this.shortcuts, null, 2), "utf8");
  }
}

export function validateShortcut(shortcut: string): string | null {
  if (!shortcut) {
    return "快捷键不能为空";
  }

  if (shortcut.includes("/")) {
    return "快捷键不能包含 /";
  }

  if (!/^[\x21-\x7E]+$/.test(shortcut)) {
    return "快捷键只能包含英文、数字和可直接输入的符号，不能包含空格";
  }

  return null;
}

export function findDuplicate(
  shortcuts: ShortcutMap,
  appId: string,
  shortcut: string
): string | null {
  const duplicate = Object.entries(shortcuts).find(([id, value]) => id !== appId && value === shortcut);
  return duplicate?.[0] ?? null;
}
