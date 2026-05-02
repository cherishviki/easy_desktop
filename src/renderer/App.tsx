import { useEffect, useMemo, useState } from "react";
import { Check, Eraser, ExternalLink, FolderPlus, RefreshCw, Trash2 } from "lucide-react";
import { createRoot } from "react-dom/client";
import type { DesktopApp } from "../shared/types";
import "./styles.css";

type Drafts = Record<string, string>;
type RowErrors = Record<string, string>;

function App() {
  const [apps, setApps] = useState<DesktopApp[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [errors, setErrors] = useState<RowErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void loadApps();
  }, []);

  const configuredCount = useMemo(
    () => apps.filter((item) => Boolean(item.shortcut)).length,
    [apps]
  );

  async function loadApps() {
    setIsLoading(true);
    const nextApps = await window.launcher.listApps();
    syncApps(nextApps);
    setIsLoading(false);
  }

  function syncApps(nextApps: DesktopApp[]) {
    setApps(nextApps);
    setDrafts(Object.fromEntries(nextApps.map((item) => [item.id, item.shortcut ?? ""])));
  }

  async function refreshApps() {
    setRefreshing(true);
    const nextApps = await window.launcher.refreshApps();
    syncApps(nextApps);
    setErrors({});
    setRefreshing(false);
  }

  async function addApp() {
    setAdding(true);
    const nextApps = await window.launcher.addApp();
    syncApps(nextApps);
    setErrors({});
    setAdding(false);
  }

  async function saveShortcut(app: DesktopApp) {
    const result = await window.launcher.setShortcut({
      appId: app.id,
      shortcut: drafts[app.id] ?? ""
    });

    if (!result.ok) {
      setErrors((current) => ({ ...current, [app.id]: result.message }));
      return;
    }

    setErrors((current) => {
      const next = { ...current };
      delete next[app.id];
      return next;
    });
    syncApps(result.apps);
  }

  async function clearShortcut(app: DesktopApp) {
    const result = await window.launcher.clearShortcut(app.id);

    if (!result.ok) {
      setErrors((current) => ({ ...current, [app.id]: result.message }));
      return;
    }

    setErrors((current) => {
      const next = { ...current };
      delete next[app.id];
      return next;
    });
    syncApps(result.apps);
  }

  async function removeApp(app: DesktopApp) {
    const message = app.source === "custom"
      ? `从 Easy Desktop 移除“${app.name}”？`
      : `从 Easy Desktop 隐藏“${app.name}”？不会删除电脑上的文件。`;

    if (!window.confirm(message)) {
      return;
    }

    const result = await window.launcher.removeApp(app.id);

    if (!result.ok) {
      setErrors((current) => ({ ...current, [app.id]: result.message }));
      return;
    }

    syncApps(result.apps);
  }

  async function openApp(app: DesktopApp) {
    setErrors((current) => {
      const next = { ...current };
      delete next[app.id];
      return next;
    });

    try {
      await window.launcher.openApp(app.id);
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [app.id]: error instanceof Error ? error.message : "打开应用失败"
      }));
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>Easy Desktop</h1>
          <p>{apps.length} 个应用，{configuredCount} 个已绑定快捷键</p>
        </div>
        <div className="topbarActions">
          <button className="secondaryButton" type="button" onClick={addApp} disabled={adding}>
            <FolderPlus size={18} />
            {adding ? "选择中" : "添加应用"}
          </button>
          <button className="primaryButton" type="button" onClick={refreshApps} disabled={refreshing}>
            <RefreshCw size={18} />
            {refreshing ? "刷新中" : "刷新"}
          </button>
        </div>
      </header>

      <section className="hintBar">
        <span>/</span>
        在任意输入位置键入斜杠和已绑定快捷键即可打开应用。
      </section>

      <section className="tableWrap">
        <div className="tableHeader">
          <span>应用</span>
          <span>快捷键</span>
          <span>路径</span>
          <span>操作</span>
        </div>

        {isLoading ? (
          <div className="emptyState">正在读取应用</div>
        ) : apps.length === 0 ? (
          <div className="emptyState">没有应用，点击右上角添加</div>
        ) : (
          apps.map((app) => (
            <article className="appRow" key={app.id}>
              <div className="appName">
                {app.iconDataUrl ? (
                  <img src={app.iconDataUrl} alt="" />
                ) : (
                  <div className="fallbackIcon">{app.name.slice(0, 1).toUpperCase()}</div>
                )}
                <div>
                  <strong>{app.name}</strong>
                  <small>{app.source === "custom" ? "手动添加" : "桌面扫描"} · {app.extension}</small>
                </div>
              </div>

              <div className="shortcutCell">
                <input
                  value={drafts[app.id] ?? ""}
                  placeholder="例如 app1"
                  spellCheck={false}
                  onChange={(event) => {
                    setDrafts((current) => ({ ...current, [app.id]: event.target.value }));
                    setErrors((current) => {
                      const next = { ...current };
                      delete next[app.id];
                      return next;
                    });
                  }}
                />
                {errors[app.id] ? <span className="errorText">{errors[app.id]}</span> : null}
              </div>

              <div className="pathCell" title={app.path}>{app.path}</div>

              <div className="actions">
                <button type="button" title="保存快捷键" onClick={() => saveShortcut(app)}>
                  <Check size={17} />
                </button>
                <button type="button" title="清空快捷键" onClick={() => clearShortcut(app)}>
                  <Eraser size={17} />
                </button>
                <button type="button" title="打开应用" onClick={() => openApp(app)}>
                  <ExternalLink size={17} />
                </button>
                <button type="button" title="从页面移除" onClick={() => removeApp(app)}>
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
