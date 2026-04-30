# Easy Desktop

Windows 桌面应用启动器。启动后读取当前 Windows 用户桌面上的 `.lnk` 快捷方式和文件夹，在页面中配置多字符快捷键；工具会在后台监听键盘，输入 `/快捷键` 后打开对应应用或文件夹。

## 给其他人使用

项目可以打包成一个 Windows 免安装 zip。对方不需要安装 Node.js、npm 或项目依赖，解压后直接运行里面的 `Easy Desktop.exe` 即可。

生成免安装 zip：

```powershell
npm.cmd run dist:zip
```

产物位置：

```text
release/Easy Desktop-0.1.0-win-x64.zip
```

把这个 zip 发给其他 Windows x64 用户即可。应用运行在谁的电脑上，就读取谁自己的桌面和公共桌面：

- 当前用户桌面：Electron 的 `app.getPath("desktop")`
- 当前用户 `Desktop` 目录
- 公共桌面：`C:\Users\Public\Desktop`

快捷键配置也保存在运行者自己的用户数据目录，不会读取开发者电脑上的配置。

如需安装版，也可以执行：

```powershell
npm.cmd run dist:win
```

如果只想生成单文件便携版 exe，可以执行：

```powershell
npm.cmd run dist:portable
```

## 本地开发

当前项目不使用全局 npm 包。依赖安装在项目本地 `node_modules`，npm 缓存可放在项目内：

```powershell
$env:npm_config_cache='C:\Users\cherish\Desktop\projects\easy_desktop\.npm-cache'
$env:ELECTRON_CACHE='C:\Users\cherish\Desktop\projects\easy_desktop\.electron-cache'
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm.cmd install
```

如果之前为了绕过沙箱执行过 `npm.cmd install --ignore-scripts`，需要在普通 PowerShell 或管理员 PowerShell 里重新执行一次：

```powershell
$env:npm_config_cache='C:\Users\cherish\Desktop\projects\easy_desktop\.npm-cache'
$env:ELECTRON_CACHE='C:\Users\cherish\Desktop\projects\easy_desktop\.electron-cache'
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
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
