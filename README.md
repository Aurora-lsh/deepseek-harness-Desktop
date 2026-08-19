# DeepSeek Harness Desktop (DSH Desktop)

English | [中文](README.zh.md)

DeepSeek Harness Desktop is a Windows client for DeepSeek Harness. Install it to use DSH through a graphical interface without running commands in CMD or PowerShell.

DSH Desktop packages the DeepSeek Harness Web UI, Agent features, and plugin system as a native desktop application. It starts the Harness service automatically on a local loopback address and stops the service when the application exits.

> This community desktop edition is built with DeepSeek Harness. It is not an official DeepSeek product.

## Download and install

The current stable version is **0.2.0** for Windows x64.

- [Download the Windows installer (0.2.0)](https://github.com/Aurora-lsh/deepseek-harness-Desktop/releases/download/desktop-v0.2.0/DeepSeek-Harness-Setup-0.2.0.exe)
- [View all releases](https://github.com/Aurora-lsh/deepseek-harness-Desktop/releases)

During installation, select a target drive or any path on that drive. The installer creates `X:\DeepSeek Harness\App` and `X:\DeepSeek Harness\Data`, plus desktop and Start menu shortcuts. A first installation defaults to the system drive; an upgrade keeps the drive containing the previous installation.

The installer is not Authenticode-signed. If Windows SmartScreen displays “Unknown publisher,” confirm that the file came from this repository's Releases page and compare its SHA-256 value with the release checksum before continuing.

## 0.2.0 features

- **Agent page**: workspaces, conversations, models, plugins, tool calls, and the primary DSH Web UI features.
- **Model and reasoning effort**: reads every configured model. A model change affects only the current conversation and takes effect with the next message. The slider shows only the low, medium, high, and extra-high levels supported by the exact model. Each reply displays the actual model and reasoning effort.
- **Official DeepSeek Chat**: a separate Chat page loads `https://chat.deepseek.com/` directly and supports official-account login, uploads, downloads, copy, microphone access, unread indicators, and Windows completion notifications. External links open in the system browser.
- **Retained background state**: switching back to Agent keeps the official Chat page running, including its login, conversation, and scroll position.

The first visit to official DeepSeek Chat displays a privacy notice. Account details, messages, and uploads go directly to DeepSeek. DSH Desktop does not read or store message text; it observes only whether a reply has finished so it can provide unread state and system notifications.

## Usage

1. Start **DeepSeek Harness** from the desktop or Start menu.
2. Configure a model and API key in Settings.
3. Select a local working folder.
4. Enter a task on the Agent page, or open official DeepSeek Chat from the left rail.

All local Harness services start with the desktop application. Node.js and a terminal are not required.

## Data, upgrades, and uninstall

Application files and data use fixed locations on the selected drive:

```text
X:\DeepSeek Harness\App
X:\DeepSeek Harness\Data\Harness
X:\DeepSeek Harness\Data\Desktop
```

On the first 0.2.0 launch after upgrading from 0.1.x, the application copies `%USERPROFILE%\.dsh` and `%APPDATA%\@deepseek-ai\dsh-desktop` to the new data directory, verifies every copied file, and then deletes the old data. If migration fails, the old data remains intact and the application reports the error.

Runtime logs are stored at `X:\DeepSeek Harness\Data\Desktop\logs\runtime.log`. Uninstall displays an additional warning and, after confirmation, permanently deletes the configuration, conversations, plugins, and official DeepSeek login state under `Data`.

## Current limitations

- Only a Windows x64 installer is available.
- The local Harness service listens on a temporary `127.0.0.1` port for desktop-local access only.
- The installer is not Authenticode-signed.

## Build the Windows installer from source

Node.js 22.19 or later and pnpm are required. Run from the repository root:

```sh
pnpm install
pnpm run package:desktop:win
```

The NSIS installer is written to `apps/desktop/dist/`. Desktop source lives in [`apps/desktop`](apps/desktop/) and reuses the repository's DSH Web profile and plugin composition.

## License

This project uses the [MIT License](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party dependencies and licenses.
