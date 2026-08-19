# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

DeepSeek Harness 的 Windows 桌面应用。它创建原生窗口，并在仅监听回环地址的临时端口上启动现有的 `dsh --profile web` Host，因此桌面版本复用 Web Profile 和插件组合，不维护第二套 UI 运行时。

Electron Renderer 不启用 Node.js 集成，启用 Context Isolation 和沙箱，并且只允许导航到本地 Harness 地址。外部 HTTP(S) 链接交给系统浏览器打开。桌面进程退出前会停止本地 Host。

## 开发

先构建仓库，再启动桌面壳：

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

## Windows 安装包

创建未签名的、按用户安装的 NSIS 安装包：

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run package:win
```

安装包写入 `apps/desktop/dist/`。正式分发前应使用组织管理的 Authenticode 证书签名安装包和可执行文件；仓库不保存签名凭据。

软件包将 Node 运行时保存在 `resources/app` 中，而不使用 `app.asar`。CLI 会维护指向已安装插件目录的 Profile 后备链接，因此链接目标必须是普通 Windows 文件系统路径。在 Electron Builder 运行前，打包流程会验证工作区对等依赖闭包，并直接纳入 Web Profile 通过配置加载的插件。

## 运行时数据

桌面应用与 CLI 共用 Harness Home。在 Windows 上，运行日志路径为 `%APPDATA%\@deepseek-ai\dsh-desktop\logs\runtime.log`。

## 已知限制和后续工作

- **回环 Host 传输**：第一版桌面包继续使用 `127.0.0.1` 上现有的 HTTP 和 WebSocket 载体；未来可以增加 IPC 载体，而不改变客户端 RPC 词汇。
- **仅 Windows 安装包**：当前只发布 Windows x64 NSIS 目标。
- **未签名输出**：本地构建的安装包在正式签名前不会通过 Windows SmartScreen 的信任检查。
