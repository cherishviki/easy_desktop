import { shell } from "electron";
import { spawn } from "node:child_process";
import { uIOhook } from "uiohook-napi";
import type { DesktopApp } from "../shared/types";
import { CANCEL_KEYCODES, eventToPrintableCharacter } from "./keyboardMapper";

const TRIGGER = "/";
const RESET_AFTER_MS = 1500;

export class GlobalShortcutService {
  private apps: DesktopApp[] = [];
  private buffer = "";
  private active = false;
  private resetTimer: NodeJS.Timeout | null = null;

  setApps(apps: DesktopApp[]): void {
    this.apps = apps;
  }

  start(): void {
    uIOhook.on("keydown", (event) => {
      this.handleKey(event);
    });

    uIOhook.start();
  }

  stop(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    uIOhook.stop();
  }

  private handleKey(event: { keycode: number; shiftKey?: boolean }): void {
    if (CANCEL_KEYCODES.has(event.keycode)) {
      this.reset();
      return;
    }

    const char = eventToPrintableCharacter(event);
    if (!char) {
      return;
    }

    if (!this.active) {
      if (char === TRIGGER) {
        this.active = true;
        this.buffer = "";
        this.armResetTimer();
      }
      return;
    }

    if (char === TRIGGER) {
      this.buffer = "";
      this.armResetTimer();
      return;
    }

    this.buffer += char;
    this.armResetTimer();

    const maxLength = this.getMaxShortcutLength();
    if (maxLength > 0 && this.buffer.length > maxLength) {
      this.reset();
      return;
    }

    const matchedApp = this.apps.find((item) => item.shortcut === this.buffer);
    if (matchedApp) {
      void this.launchAndErase(matchedApp);
      this.reset();
    }
  }

  private async launchAndErase(app: DesktopApp): Promise<void> {
    await shell.openPath(app.path);
    sendBackspaces(app.shortcut!.length + TRIGGER.length);
  }

  private getMaxShortcutLength(): number {
    return this.apps.reduce((max, app) => Math.max(max, app.shortcut?.length ?? 0), 0);
  }

  private armResetTimer(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }

    this.resetTimer = setTimeout(() => {
      this.reset();
    }, RESET_AFTER_MS);
  }

  private reset(): void {
    this.active = false;
    this.buffer = "";

    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }
}

function sendBackspaces(count: number): void {
  const script = [
    "$shell = New-Object -ComObject WScript.Shell",
    `1..${count} | ForEach-Object { $shell.SendKeys('{BACKSPACE}') }`
  ].join("; ");

  const child = spawn("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script
  ], {
    windowsHide: true,
    stdio: "ignore"
  });

  child.unref();
}
