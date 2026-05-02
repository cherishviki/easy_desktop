import { app } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type UserAppState = {
  customPaths: string[];
  hiddenAppIds: string[];
};

const STORE_FILE = "user-apps.json";

export class UserAppStore {
  private readonly filePath: string;
  private state: UserAppState = {
    customPaths: [],
    hiddenAppIds: []
  };

  constructor() {
    this.filePath = path.join(app.getPath("userData"), STORE_FILE);
  }

  load(): UserAppState {
    try {
      const content = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(content) as Partial<UserAppState>;
      this.state = {
        customPaths: uniqueStrings(parsed.customPaths),
        hiddenAppIds: uniqueStrings(parsed.hiddenAppIds)
      };
    } catch {
      this.state = { customPaths: [], hiddenAppIds: [] };
    }

    return this.getAll();
  }

  getAll(): UserAppState {
    return {
      customPaths: [...this.state.customPaths],
      hiddenAppIds: [...this.state.hiddenAppIds]
    };
  }

  async addCustomPath(filePath: string): Promise<UserAppState> {
    const normalizedPath = path.normalize(filePath);
    this.state.customPaths = uniqueStrings([...this.state.customPaths, normalizedPath]);
    await this.save();
    return this.getAll();
  }

  async removeCustomPath(filePath: string): Promise<UserAppState> {
    const normalizedPath = path.normalize(filePath).toLowerCase();
    this.state.customPaths = this.state.customPaths.filter((item) => item.toLowerCase() !== normalizedPath);
    await this.save();
    return this.getAll();
  }

  async hideApp(appId: string): Promise<UserAppState> {
    this.state.hiddenAppIds = uniqueStrings([...this.state.hiddenAppIds, appId]);
    await this.save();
    return this.getAll();
  }

  async unhideApp(appId: string): Promise<UserAppState> {
    this.state.hiddenAppIds = this.state.hiddenAppIds.filter((item) => item !== appId);
    await this.save();
    return this.getAll();
  }

  private async save(): Promise<void> {
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true });
    await fsp.writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}
