# Easy Desktop

Windows 桌面应用启动器。启动后读取当前用户桌面上的 `.lnk` 和 `.url` 快捷方式，在页面中配置多字符快捷键；工具在后台监听键盘，输入 `/快捷键` 后打开对应应用。

## 本地开发

当前项目不使用全局 npm 包。依赖安装在项目本地 `node_modules`，npm 缓存可放在项目内：

```powershell
$env:npm_config_cache='C:\Users\cherish\Desktop\projects\easy_desktop\.npm-cache'
$env:ELECTRON_CACHE='C:\Users\cherish\Desktop\projects\easy_desktop\.electron-cache'
npm.cmd install
```

如果之前为了绕过沙箱执行过 `npm.cmd install --ignore-scripts`，需要在普通 PowerShell 或管理员 PowerShell 里重新执行一次：

```powershell
$env:npm_config_cache='C:\Users\cherish\Desktop\projects\easy_desktop\.npm-cache'
$env:ELECTRON_CACHE='C:\Users\cherish\Desktop\projects\easy_desktop\.electron-cache'
npm.cmd rebuild esbuild electron uiohook-napi
```

启动开发模式：

```powershell
npm.cmd run dev
```

执行检查：

```powershell
npm.cmd run typecheck
npm.cmd run build
```

## 快捷键规则

- 支持多个字符。
- 只允许 ASCII 可打印字符。
- 不允许包含 `/`。
- 不允许重复。
- 输入 `/快捷键` 命中后会打开应用，并发送 Backspace 清除触发文本。
