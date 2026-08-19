/**
 * Windows desktop shell for the existing dsh Web profile.
 *
 * The shell owns the native window and starts the unchanged Harness Web host on
 * loopback. Keeping the host in a child process preserves the Web profile's
 * plugin lifecycle and gives desktop shutdown an explicit process owner.
 * @module @deepseek-ai/dsh-desktop/main
 */

import { app, BrowserWindow, dialog, shell } from 'electron'
import { createWriteStream, mkdirSync, type WriteStream } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import {
  isRuntimeUrl,
  parseRuntimeReadyUrl,
  runtimeArguments,
} from './runtime.ts'

const APP_NAME = 'DeepSeek Harness'
const RUNTIME_STARTUP_TIMEOUT_MS = 180_000
const RUNTIME_SHUTDOWN_TIMEOUT_MS = 5_000

let mainWindow: BrowserWindow | undefined
let runtime: ChildProcess | undefined
let runtimeLog: WriteStream | undefined
let quitting = false
let stoppingRuntime: Promise<void> | undefined

/** Return the published CLI entry used by the desktop host child process. */
function cliEntry(): string {
  const require = createRequire(import.meta.url)
  const manifest = require.resolve('@deepseek-ai/dsh/package.json')
  return join(dirname(manifest), 'lib', 'bin.js')
}

/** Open the desktop log file without creating the directory until the app starts. */
function openRuntimeLog(): WriteStream {
  const logDirectory = join(app.getPath('userData'), 'logs')
  mkdirSync(logDirectory, { recursive: true })
  return createWriteStream(join(logDirectory, 'runtime.log'), { flags: 'a', encoding: 'utf8' })
}

/** Write one line to the desktop log and the runtime's captured stream. */
function logRuntime(prefix: string, text: string): void {
  runtimeLog?.write(`[${new Date().toISOString()}] ${prefix} ${text}`)
}

/** Stop the host child and wait for its process tree to close. */
async function stopRuntime(): Promise<void> {
  if (stoppingRuntime !== undefined) return stoppingRuntime
  stoppingRuntime = (async () => {
    const child = runtime
    if (child === undefined || child.exitCode !== null) return
    child.kill('SIGTERM')
    await new Promise<void>((resolve) => {
      let settled = false
      const finish = (): void => {
        if (settled) return
        settled = true
        resolve()
      }
      child.once('exit', finish)
      setTimeout(() => {
        if (!settled) {
          child.kill()
          finish()
        }
      }, RUNTIME_SHUTDOWN_TIMEOUT_MS)
    })
  })()
  return stoppingRuntime
}

/** Start dsh web on a loopback-only ephemeral port and resolve its ready URL. */
function startRuntime(): Promise<URL> {
  runtimeLog = openRuntimeLog()
  const child = spawn(process.execPath, runtimeArguments(cliEntry()), {
    cwd: app.getPath('home'),
    env: {
      ...process.env,
      DSH_DESKTOP: '1',
      ELECTRON_RUN_AS_NODE: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  runtime = child

  return new Promise<URL>((resolve, reject) => {
    let settled = false
    let stdoutBuffer = ''
    const timeout = setTimeout(() => {
      fail(new Error(`dsh web did not become ready within ${String(RUNTIME_STARTUP_TIMEOUT_MS)} ms`))
    }, RUNTIME_STARTUP_TIMEOUT_MS)
    const succeed = (url: URL): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolve(url)
    }
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      reject(error)
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      logRuntime('stdout', chunk)
      stdoutBuffer += chunk
      const lines = stdoutBuffer.split(/\r?\n/)
      stdoutBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const url = parseRuntimeReadyUrl(line)
        if (url === undefined) continue
        succeed(url)
      }
    })
    child.stderr.on('data', (chunk: string) => {
      logRuntime('stderr', chunk)
    })
    child.once('error', (error) => {
      fail(error instanceof Error ? error : new Error(String(error)))
    })
    child.once('exit', (code, signal) => {
      if (settled) return
      fail(new Error(`dsh web exited before readiness (code=${String(code)}, signal=${String(signal)})`))
    })
  })
}

/** Create the native window with browser-only renderer privileges. */
function createMainWindow(url: URL): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: '#101114',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) void shell.openExternal(target)
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, target) => {
    if (isRuntimeUrl(target, url.origin)) return
    event.preventDefault()
    if (/^https?:\/\//.test(target)) void shell.openExternal(target)
  })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  void window.loadURL(url.toString())
  return window
}

/** Display a startup failure without exposing a console window to the user. */
async function showStartupFailure(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  logRuntime('desktop', `startup failed: ${message}\n`)
  await dialog.showMessageBox({
    type: 'error',
    title: `${APP_NAME} could not start`,
    message: 'DeepSeek Harness could not start its local runtime.',
    detail: `${message}\n\nThe runtime log is in the application data directory.`,
  })
}

/** Boot the host after Electron has initialized its application data paths. */
async function startApplication(): Promise<void> {
  app.setAppUserModelId('ai.deepseek.harness')
  try {
    const url = await startRuntime()
    mainWindow = createMainWindow(url)
  } catch (error: unknown) {
    await showStartupFailure(error)
    app.quit()
  }
}

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow === undefined) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  })
  app.on('before-quit', (event) => {
    if (quitting) return
    quitting = true
    event.preventDefault()
    void stopRuntime().finally(() => {
      runtimeLog?.end()
      runtimeLog = undefined
      app.quit()
    })
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
  void app.whenReady().then(startApplication).catch(async (error: unknown) => {
    await showStartupFailure(error)
    app.quit()
  })
}
