# `@deepseek-ai/dsh-desktop`

[English](README.md) | 中文

DeepSeek Harness 的 Windows 桌面应用。它在仅监听回环地址的临时端口上启动现有 Web Profile，并在同一个原生窗口中提供 Agent UI 和持续保留的 DeepSeek 官网 Chat。

本地 Agent Renderer 不启用 Node.js 集成，使用 Context Isolation 和沙箱，并且只允许导航到本地 Harness 地址。官网 Chat Renderer 使用独立、持久化的 Electron 分区，只允许在 DeepSeek 官方 HTTPS 域名内导航。外部 HTTP(S) 链接交给系统浏览器打开。桌面进程退出前会停止本地 Host。

## 开发

先构建仓库，再启动桌面壳：

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

## Windows 安装包

创建未签名、按计算机安装的 NSIS 安装包：

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run package:win
```

安装包写入 `apps/desktop/dist/`。目录页用于选择磁盘；最终安装路径统一为 `X:\DeepSeek Harness\App`，应用数据位于 `X:\DeepSeek Harness\Data`。首次安装默认系统盘，升级默认旧安装位置对应的磁盘。

该社区版本没有 Authenticode 证书。Windows 可能显示“未知发布者”SmartScreen 警告；Release 说明会公布 SHA-256，供用户独立校验安装包。

软件包将 Node 运行时保存在 `resources/app` 中，而不使用 `app.asar`。CLI 会维护指向已安装插件目录的 Profile 后备链接，因此链接目标必须是普通 Windows 文件系统路径。在 Electron Builder 运行前，打包流程会验证工作区对等依赖闭包，并直接纳入 Web Profile 通过配置加载的插件。

## 运行数据

Harness 配置、会话、插件、附件、Electron 偏好、日志和官网登录分区均位于 `X:\DeepSeek Harness\Data`。首次启动 0.2 时，应用会复制并校验 0.1 的 Harness 与 Electron 目录，然后删除旧目录；迁移失败会保留旧目录。完整卸载需要再次确认永久删除数据，并移除 Data 目录；原位升级会保留数据。

运行日志路径为 `X:\DeepSeek Harness\Data\Desktop\logs\runtime.log`。

## DeepSeek 官网 Chat

固定 Chat 页面直接加载 `https://chat.deepseek.com/`。登录、消息、上传和下载均由用户与 DeepSeek 直接完成。桌面壳不检查或保存消息内容；Preload 只观察生成控件状态，以提供未读标记和不含消息正文的 Windows 完成通知。下载始终显示“另存为”，媒体权限仅授予 DeepSeek 官方页面，外部链接使用默认浏览器。

## 已知限制

- 仅打包 Windows x64。
- 本地 Agent 继续使用现有回环 HTTP 和 WebSocket 载体。
- 安装包和可执行文件未签名，无法建立 SmartScreen 信誉。
