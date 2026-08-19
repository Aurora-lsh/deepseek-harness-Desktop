# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

The Windows desktop application for DeepSeek Harness. It starts the existing Web profile on a loopback-only ephemeral port and presents the Agent UI and the retained official DeepSeek Chat site in one native shell.

The local Agent renderer has no Node.js integration, uses context isolation and sandboxing, and may navigate only to the local Harness origin. The official Chat renderer uses a separate persistent Electron partition and may navigate only within official DeepSeek HTTPS hosts. External HTTP(S) links open in the system browser. The local Host stops before the desktop process exits.

## Development

Build the repository first, then run the desktop shell:

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

## Windows installer

Create the unsigned per-machine NSIS installer:

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run package:win
```

The installer is written to `apps/desktop/dist/`. The directory page selects a drive; installation is normalized to `X:\DeepSeek Harness\App`, with application data under `X:\DeepSeek Harness\Data`. A fresh install starts on the system drive, while an upgrade starts on the previous install's drive.

This community release has no Authenticode certificate. Windows may show an unknown-publisher SmartScreen warning; release notes publish SHA-256 hashes so downloaded artifacts can be verified independently.

The package keeps its Node runtime under `resources/app` instead of `app.asar`. The CLI maintains profile fallback links to installed plugin directories, so those targets must be ordinary Windows filesystem paths. Packaging verifies the workspace peer closure and directly includes the Web profile's configuration-loaded plugins before Electron Builder runs.

## Runtime data

Harness configuration, sessions, plugins, attachments, Electron preferences, logs, and the official-site login partition live below `X:\DeepSeek Harness\Data`. On first 0.2 launch, existing v0.1 Harness and Electron directories are copied, verified, and then removed. A failed migration preserves the old directories. Full uninstall requires a second destructive-data confirmation and removes the Data directory; an in-place update preserves it.

The runtime log is `X:\DeepSeek Harness\Data\Desktop\logs\runtime.log`.

## Official DeepSeek Chat

The fixed Chat view loads `https://chat.deepseek.com/` directly. Login, messages, uploads, and downloads remain between the user and DeepSeek. The desktop shell does not inspect or store message content; its preload observes only generation-control state to provide an unread badge and a content-free Windows completion notification. Downloads always display a Save As dialog, media access is limited to official DeepSeek pages, and external links use the default browser.

## Known limitations

- Windows x64 is the only packaged target.
- The local Agent still uses the existing loopback HTTP and WebSocket carrier.
- Installers and executables are unsigned and do not establish a SmartScreen reputation.
