# DeepSeek Harness Desktop（DSH Desktop）

[English](README.md) | 中文

面向 Windows 的 DeepSeek Harness 桌面客户端。下载安装后即可通过图形界面使用 DSH，不需要在 CMD 或 PowerShell 中运行命令。

DSH Desktop 将 DeepSeek Harness 的 Web UI、Agent 功能和插件系统封装为原生桌面应用。应用启动时会在本机回环地址上自动运行 Harness 服务，退出应用时自动关闭该服务。

> 本项目是基于 DeepSeek Harness 构建的社区桌面版本，并非 DeepSeek 官方产品。

## 下载与安装

当前正式版本为 **0.2.0**，支持 Windows x64。

- [下载 Windows 安装包（0.2.0）](https://github.com/Aurora-lsh/deepseek-harness-Desktop/releases/download/desktop-v0.2.0/DeepSeek-Harness-Setup-0.2.0.exe)
- [查看全部 Releases](https://github.com/Aurora-lsh/deepseek-harness-Desktop/releases)

安装时先选择目标磁盘或该磁盘中的任意路径。安装程序会统一创建 `X:\DeepSeek Harness\App` 和 `X:\DeepSeek Harness\Data`，并创建桌面及开始菜单快捷方式。首次安装默认使用系统盘；升级会沿用旧安装位置所在的磁盘。

安装包目前未进行 Authenticode 代码签名。如果 Windows SmartScreen 显示“未知发布者”，请先确认文件来自本仓库的 Releases 页面并核对 Release 中的 SHA-256，再决定是否继续。

## 0.2.0 功能

- **Agent 页面**：工作区、会话、模型、插件、工具调用和 DSH Web UI 的主要功能。
- **模型与推理强度**：读取用户已配置的全部模型；模型切换只影响当前会话，并从下一条消息开始生效。滑块仅显示具体模型支持的低、中、高、极高档位。每条回复下方显示实际模型和推理强度。
- **DeepSeek 官网 Chat**：独立 Chat 页面直接加载 `https://chat.deepseek.com/`，支持官网账号登录、上传、下载、复制、麦克风、未读提示和 Windows 完成通知。外部链接使用系统默认浏览器打开。
- **后台保留**：切换回 Agent 后，官网 Chat 仍保持运行，不会丢失登录、会话或滚动位置。

首次进入官网 Chat 时会显示隐私说明。账号、消息和上传文件直接发送给 DeepSeek；DSH Desktop 不读取或保存消息正文，只观察回复是否完成，以提供未读状态和系统通知。

## 使用方法

1. 从桌面或开始菜单启动 **DeepSeek Harness**。
2. 在设置中配置模型和 API Key。
3. 选择一个本地工作文件夹。
4. 在 Agent 页面输入任务，或从左侧进入 DeepSeek 官网 Chat。

所有本地 Harness 服务都随桌面应用启动，不需要另外安装 Node.js，也不需要手动打开终端。

## 数据、升级与卸载

程序和数据固定保存在所选磁盘：

```text
X:\DeepSeek Harness\App
X:\DeepSeek Harness\Data\Harness
X:\DeepSeek Harness\Data\Desktop
```

从 0.1.x 首次启动 0.2.0 时，应用会把旧的 `%USERPROFILE%\.dsh` 和 `%APPDATA%\@deepseek-ai\dsh-desktop` 复制到新目录、逐文件校验，然后删除旧数据。迁移失败时旧数据保持不变并显示错误。

运行日志位于 `X:\DeepSeek Harness\Data\Desktop\logs\runtime.log`。卸载会再次警告，并在确认后永久删除 `Data` 中的配置、会话、插件和 DeepSeek 官网登录状态。

## 当前限制

- 仅提供 Windows x64 安装包。
- 本地 Harness 服务使用 `127.0.0.1` 上的临时端口，仅供桌面应用在本机访问。
- 安装包尚未进行 Authenticode 代码签名。

## 从源码构建 Windows 安装包

需要 Node.js 22.19 或更高版本以及 pnpm。在仓库根目录执行：

```sh
pnpm install
pnpm run package:desktop:win
```

生成的 NSIS 安装包位于 `apps/desktop/dist/`。桌面应用源码位于 [`apps/desktop`](apps/desktop/)，并复用仓库中的 DSH Web Profile 与插件组合。

## 开源许可

本项目采用 [MIT License](LICENSE)。第三方依赖及其许可信息见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
