# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

The Windows desktop application for DeepSeek Harness. It creates the native window and starts the existing `dsh --profile web` host on a loopback-only ephemeral port, so the desktop build reuses the Web profile and its plugin composition instead of maintaining a second UI runtime.

The Electron renderer has no Node.js integration, enables context isolation and sandboxing, and may navigate only to the local Harness origin. External HTTP(S) links open in the system browser. The local host is stopped before the desktop process exits.

## Development

Build the repository first, then run the desktop shell:

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run dev
```

## Windows installer

Create an unsigned per-user NSIS installer:

```sh
pnpm run build
pnpm --filter @deepseek-ai/dsh-desktop run package:win
```

The installer is written to `apps/desktop/dist/`. Production distribution should sign the installer and executable with an organization-controlled Authenticode certificate; the repository does not contain signing credentials.

The package keeps its Node runtime under `resources/app` instead of `app.asar`. The CLI maintains profile fallback links to installed plugin directories, so those targets must be ordinary Windows filesystem paths. Packaging verifies the workspace peer closure and directly includes the Web profile's configuration-loaded plugins before Electron Builder runs.

## Runtime data

The desktop application shares the normal Harness home with the CLI. On Windows, its runtime log is `%APPDATA%\@deepseek-ai\dsh-desktop\logs\runtime.log`.

## Known Limitations and Deferred Work

- **Loopback host transport** — the first desktop package keeps the existing Web HTTP and WebSocket carrier on `127.0.0.1`; an IPC carrier can be added later without changing the client RPC vocabulary.
- **Windows-only installer** — this app currently publishes only the Windows x64 NSIS target.
- **Unsigned output** — installers built locally are not trusted by Windows SmartScreen until signed by the release owner.
