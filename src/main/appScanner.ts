import { app } from "electron";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { DesktopApp } from "../shared/types";

const DESKTOP_EXTENSIONS = new Set([".lnk", ".url"]);

export function createAppId(filePath: string): string {
  return crypto.createHash("sha1").update(filePath.toLowerCase()).digest("hex");
}

export async function scanUserDesktop(shortcuts: Record<string, string>): Promise<DesktopApp[]> {
  const desktopDir = path.join(app.getPath("home"), "Desktop");
  const entries = await fs.readdir(desktopDir, { withFileTypes: true }).catch(() => []);
  const apps: DesktopApp[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!DESKTOP_EXTENSIONS.has(extension)) {
      continue;
    }

    const filePath = path.join(desktopDir, entry.name);
    const id = createAppId(filePath);
    const iconDataUrl = await app.getFileIcon(filePath, { size: "normal" })
      .then((icon) => icon.toDataURL())
      .catch(() => undefined);

    apps.push({
      id,
      name: path.basename(entry.name, extension),
      path: filePath,
      extension: extension as DesktopApp["extension"],
      iconDataUrl,
      shortcut: shortcuts[id]
    });
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
}
