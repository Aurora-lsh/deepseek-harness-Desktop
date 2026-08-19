# Agent Note: Windows desktop shell reuses the Web profile over loopback

Status: implemented

English | [中文](2026-08-17-windows-desktop-shell.zh.md)

## Problem

Windows users need an installable desktop application without a second implementation of the Harness host or browser client.

The desktop process must own the native window, keep the local execution service private to the machine, and stop the Harness runtime before exit.

## Decision

`apps/desktop` is an Electron main-process shell over the existing `dsh --profile web` application.

The shell starts the published `@deepseek-ai/dsh` CLI entry in an Electron child process with `ELECTRON_RUN_AS_NODE=1`. It passes the required Node `--expose-internals` flag before the CLI entry, passes `--host 127.0.0.1 --port 0` to the CLI, and waits for the existing `dsh web:` readiness line before creating the window.

The renderer loads the loopback URL with Node.js integration disabled, context isolation enabled, sandboxing enabled, and navigation restricted to the runtime Origin; HTTP(S) links outside that Origin open in the system browser.

The child process receives a desktop-owned log stream and is stopped with SIGTERM before Electron quits. A second launch focuses the existing window instead of starting another Harness runtime.

The Windows distribution target is a per-user x64 NSIS installer. The build leaves signing to the release environment and publishes no certificate or signing secret from the repository.

The packaged Node application remains an ordinary `resources/app` directory instead of an ASAR archive. The profile loader maintains Windows directory links from the Harness home to installed plugin directories; a link into ASAR's virtual filesystem cannot be traversed by Node's module resolver from outside the archive. The desktop manifest directly declares the required workspace peers and Web-profile plugins, and packaging verifies the workspace runtime closure before Electron Builder collects dependencies.

## Alternatives considered

- **Direct Electron IPC carrier:** deferred because the existing Web host and RPC carrier already provide a tested assembled product path; replacing client bootstrap and downlink transport would expand the first Windows packaging change into a client protocol change.

- **Run the Harness host in the Electron main process:** rejected because the CLI profile launcher owns signal handling, profile composition, and long-lived teardown; a child process keeps those lifecycles independent from Chromium window events.

- **Embed a second desktop-specific UI:** rejected because it would duplicate the Web client plugin roster and create two product surfaces that could drift.

- **Bind the host to a fixed TCP port or a non-loopback address:** rejected because a fixed port creates collisions and a non-loopback bind exposes the local code-execution API to the network.

## Consequences

The desktop app reuses the Web profile, Web client, host API, session data, settings, credentials, and plugin composition without changing their contracts.

The first desktop release depends on Electron's child-process runtime and a local Web carrier; a future IPC carrier can replace the physical transport without changing the RPC vocabulary.

The package disables Electron rebuilds and declares the Windows x64 optional binary packages directly; the Harness child uses Electron's Node mode with the shipped N-API and platform binaries. The desktop installer pins and distributes `@img/sharp-win32-x64` 0.35.3 under its declared Apache-2.0 and LGPL-3.0-or-later terms, preserving the package license, dependency inventory, and dynamically linked libraries; changing that identity, version, or declared license requires a new distribution review. Keeping the runtime unarchived increases the installed file count but preserves profile plugin resolution; the NSIS installer still compresses those files. Production distribution requires Authenticode signing to avoid SmartScreen warnings.

The desktop app currently shares the normal Harness home with the CLI, while Electron-specific logs live below its application data directory.
