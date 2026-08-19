# Agent Note: Windows 桌面壳通过回环地址复用 Web Profile

Status: implemented

[English](2026-08-17-windows-desktop-shell.md) | 中文

## Problem

Windows 用户需要可安装的桌面应用，同时不能为 Harness Host 或浏览器客户端维护第二套实现。

桌面进程需要拥有原生窗口、保证本地执行服务只对本机可达，并在退出前停止 Harness 运行时。

## Decision

`apps/desktop` 是基于现有 `dsh --profile web` 应用的 Electron 主进程桌面壳。

桌面壳通过 `ELECTRON_RUN_AS_NODE=1` 在 Electron 子进程中启动发布后的 `@deepseek-ai/dsh` CLI。它在 CLI 入口前传入必需的 Node `--expose-internals` 标志，向 CLI 传入 `--host 127.0.0.1 --port 0`，并等待现有的 `dsh web:` 就绪行后再创建窗口。

Renderer 不启用 Node.js 集成，启用 Context Isolation 和沙箱，并把导航限制在运行时 Origin 内；超出该 Origin 的 HTTP(S) 链接交给系统浏览器打开。

子进程的输出写入桌面应用自己的日志流，Electron 退出前通过 SIGTERM 停止子进程。重复启动只聚焦已有窗口，不再启动第二个 Harness 运行时。

Windows 分发目标是按用户安装的 x64 NSIS 安装包。签名由发布环境负责，仓库不发布证书或签名密钥。

打包后的 Node 应用保留为普通 `resources/app` 目录，不使用 ASAR 归档。Profile loader 会维护从 Harness Home 指向已安装插件目录的 Windows 目录链接；Node 模块解析器无法从归档外沿链接进入 ASAR 的虚拟文件系统。桌面 manifest 直接声明必需的工作区对等依赖和 Web Profile 插件，打包流程会在 Electron Builder 收集依赖前验证工作区运行时闭包。

## Alternatives considered

- **直接实现 Electron IPC 载体**：暂缓，因为现有 Web Host 和 RPC 载体已经提供经过组装验证的产品路径；替换客户端启动和下行传输会把第一版 Windows 打包扩展成客户端协议改造。

- **在 Electron 主进程内运行 Harness Host**：不采用，因为 CLI Profile 启动器拥有信号处理、Profile 组合和长生命周期清理；子进程可以让这些生命周期与 Chromium 窗口事件相互独立。

- **嵌入第二套桌面专用 UI**：不采用，因为这会复制 Web 客户端插件清单，并产生可能逐渐偏离的两个产品界面。

- **绑定固定 TCP 端口或非回环地址**：不采用，因为固定端口会发生冲突，非回环绑定会把本地代码执行 API 暴露给网络。

## Consequences

桌面应用复用 Web Profile、Web Client、Host API、会话数据、设置、凭据和插件组合，不改变这些部分的接口。

第一版桌面应用依赖 Electron 子进程运行时和本地 Web 载体；未来可以替换物理传输，而不改变 RPC 词汇。

安装包关闭 Electron 原生模块重编译，并直接声明 Windows x64 可选二进制包；Harness 子进程使用 Electron 的 Node 模式以及随包提供的 N-API 和平台二进制。桌面安装包固定并分发 `@img/sharp-win32-x64` 0.35.3，遵循其声明的 Apache-2.0 和 LGPL-3.0-or-later 条款，并保留包内许可证、依赖清单与动态链接库；变更该包身份、版本或声明许可证时必须重新进行分发审查。未归档运行时会增加安装后的文件数量，但能保证 Profile 插件正常解析；NSIS 安装包仍会压缩这些文件。正式分发需要 Authenticode 签名以避免 SmartScreen 警告。

桌面应用目前与 CLI 共用普通 Harness Home，Electron 专用日志保存在其应用数据目录下。
