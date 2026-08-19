# DeepSeek Harness Desktop（DSH Desktop）

面向 Windows 的 DeepSeek Harness 桌面客户端。下载安装后即可通过图形界面使用 DSH，不需要在 CMD 或 PowerShell 中运行命令。

DSH Desktop 将 DeepSeek Harness 的 Web UI、Agent 能力和插件系统封装为原生桌面应用。应用启动时会在本机回环地址上自动运行 Harness 服务，退出应用时自动关闭该服务。

> 本项目是基于 DeepSeek Harness 构建的社区桌面版本，并非 DeepSeek 官方产品。

## 下载与安装

当前版本支持 **Windows x64**。

- [下载 Windows 安装包（0.1.0-rc.7）](https://github.com/Aurora-lsh/deepseek-harness-Desktop/releases/download/desktop-v0.1.0-rc.7/DeepSeek-Harness-Setup-0.1.0-rc.7.exe)
- [查看全部 Releases](https://github.com/Aurora-lsh/deepseek-harness-Desktop/releases)

下载后双击安装程序，按提示选择安装位置。安装程序会创建桌面快捷方式和开始菜单快捷方式。

安装包目前未进行 Authenticode 代码签名。如果 Windows SmartScreen 显示未知发布者提示，请确认安装包来自本仓库的 Releases 页面后再决定是否继续。

## 使用方法

1. 从桌面或开始菜单启动 **DeepSeek Harness**。
2. 在设置中配置模型和 API Key。
3. 选择一个本地工作文件夹。
4. 在对话框中输入任务，DSH 会在所选工作区内执行工作。

桌面版支持工作区选择、会话管理、模型配置、工具调用、插件配置和 DSH Web UI 的主要功能。所有服务都在本机启动，不需要另外安装 Node.js，也不需要手动打开终端。

## 运行数据

桌面版与 DSH CLI 共用 Harness Home，默认位置为 `%USERPROFILE%\.dsh`。

Windows 运行日志位于：

```text
%APPDATA%\@deepseek-ai\dsh-desktop\logs\runtime.log
```

遇到启动失败或文件夹选择失败时，可以先退出应用、重新启动，再查看该日志中的错误信息。

## 当前限制

- 仅提供 Windows x64 安装包。
- 当前 Release 为候选版本，功能和配置格式仍可能调整。
- 本地 Harness 服务使用 `127.0.0.1` 上的临时端口，仅供桌面应用在本机访问。
- 安装包尚未进行 Authenticode 代码签名。

## 从源码构建 Windows 安装包

需要 Node.js 22.19 或更高版本以及 pnpm。在仓库根目录执行：

```sh
pnpm install
pnpm run package:desktop:win
```

生成的 NSIS 安装包位于 `apps/desktop/dist/`。

桌面应用源码位于 [`apps/desktop`](apps/desktop/)，并复用仓库中的 DSH Web Profile 与插件组合。

## 开源许可

本项目采用 [MIT License](LICENSE)。第三方依赖及其许可信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
