# Easy Desktop

Easy Desktop 是一个 Windows 桌面应用启动器。它会读取当前 Windows 用户桌面上的 `.lnk` 快捷方式和文件夹，也支持手动添加 `.exe` 应用、快捷方式、普通文件或文件夹。

配置好快捷键后，在任意输入位置键入 `/快捷键`，Easy Desktop 会在后台打开对应应用或文件夹，并清除刚刚输入的触发文本。

## 功能

- 自动扫描当前用户桌面、用户 `Desktop` 目录和公共桌面。
- 支持手动添加 `.exe`、`.lnk`、`.appref-ms`、普通文件或文件夹。
- 点击“添加应用”时，默认打开 Windows 开始菜单的程序目录，便于直接选择已安装应用快捷方式。
- 点击“添加文件夹”时，单独打开文件夹选择窗口，避免应用选择窗口变成只能选文件夹。
- 支持一次选择多个可添加项目。
- 启动时会使用固定的本地缓存目录，避免 Electron/Chromium 在命令行输出磁盘缓存权限错误。
- 顶部应用菜单已中文化，包括“文件、视图、窗口、帮助”。
- 支持为应用配置多字符快捷键。
- 支持从页面移除应用，让列表保持简洁。
- 支持开机自启动；开启后下次登录 Windows 时会自动启动到托盘，并继续监听快捷键。
- 快捷键、手动添加应用、隐藏应用和自启动状态都保存在当前运行者自己的电脑上。

## 使用方式

1. 启动 `Easy Desktop.exe`。
2. 在页面中为应用填写快捷键并保存。
3. 如需添加不在桌面上的应用，点击“添加应用”，在开始菜单程序目录中选择应用快捷方式，或切换到其他位置选择 `.exe`、`.lnk`、`.appref-ms` 或普通文件。
4. 如需添加文件夹，点击“添加文件夹”，选择文件夹所在位置。
5. 如需隐藏不常用应用，点击对应应用的移除按钮。
6. 如需登录 Windows 后自动运行，打开“开机自启动”开关。

快捷键示例：为微信设置 `wx` 后，在任意输入位置输入 `/wx` 即可打开微信。

## 分发版本

项目可以打包成 Windows 免安装 zip。使用者不需要安装 Node.js、npm 或项目依赖，解压后直接运行里面的 `Easy Desktop.exe`。

生成免安装 zip：

```powershell
npm.cmd run dist:zip
```

产物位置：

```text
release/Easy Desktop-0.1.0-win-x64.zip
```

如需安装版：

```powershell
npm.cmd run dist:win
```

如需单文件便携版 exe：

```powershell
npm.cmd run dist:portable
```

## 配置保存位置

应用运行在谁的电脑上，就读取谁自己的桌面和公共桌面：

- 当前用户桌面：Electron 的 `app.getPath("desktop")`
- 当前用户 `Desktop` 目录
- 公共桌面：`C:\Users\Public\Desktop`

快捷键、手动添加应用、隐藏应用和开机自启动状态都属于当前运行者自己的配置，不会读取其他电脑上的配置。

## 本地开发

安装依赖：

```powershell
npm.cmd install
```

如果网络环境需要使用 Electron 镜像，可以在安装或重建前设置镜像：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
npm.cmd install
```

如果之前执行过 `npm.cmd install --ignore-scripts`，需要重新构建原生依赖：

```powershell
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
- 不允许包含空格。
- 不允许重复。
- 输入 `/快捷键` 命中后会打开应用，并发送 Backspace 清除触发文本。
