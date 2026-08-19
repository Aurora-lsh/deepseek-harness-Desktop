/**
 * Windows desktop shell for the local Harness Agent and official DeepSeek Chat.
 * @module @deepseek-ai/dsh-desktop/main
 */

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  shell,
  WebContentsView,
  type Rectangle,
} from 'electron'
import {
  createWriteStream,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
  type WriteStream,
} from 'node:fs'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, type ChildProcess } from 'node:child_process'
import {
  legacyDataLocations,
  migrateLegacyData,
  resolveDesktopDataPaths,
} from './data.ts'
import {
  isOfficialDeepSeekUrl,
  isRuntimeUrl,
  parseRuntimeReadyUrl,
  runtimeArguments,
} from './runtime.ts'

const APP_NAME = 'DeepSeek Harness'
const CHAT_URL = 'https://chat.deepseek.com/'
const CHAT_PARTITION = 'persist:deepseek-official-chat'
const RAIL_WIDTH = 88
const RUNTIME_STARTUP_TIMEOUT_MS = 180_000
const RUNTIME_SHUTDOWN_TIMEOUT_MS = 5_000

interface DesktopPreferences {
  deepSeekPrivacyAccepted?: boolean
}

type ActiveView = 'agent' | 'chat'

const legacyUserData = app.getPath('userData')
const dataPaths = resolveDesktopDataPaths(
  process.execPath,
  app.isPackaged,
  legacyUserData,
  process.env['DSH_DESKTOP_DATA_ROOT'],
)
const installedLayout = app.isPackaged
  && basename(dirname(process.execPath)).toLowerCase() === 'app'
  && process.env['DSH_DESKTOP_DATA_ROOT'] === undefined
let migrationFailure: unknown
if (installedLayout) {
  try {
    migrateLegacyData(legacyDataLocations(app.getPath('home'), app.getPath('appData'), dataPaths))
  } catch (error: unknown) {
    migrationFailure = error
  }
}
mkdirSync(dataPaths.desktop, { recursive: true })
mkdirSync(dataPaths.harness, { recursive: true })
app.setPath('userData', dataPaths.desktop)

let mainWindow: BrowserWindow | undefined
let agentView: WebContentsView | undefined
let chatView: WebContentsView | undefined
let activeView: ActiveView = 'agent'
let chatLoaded = false
let chatGenerating = false
let chatUnread = false
let chatCompletionUrl = CHAT_URL
let runtime: ChildProcess | undefined
let runtimeLog: WriteStream | undefined
let quitting = false
let stoppingRuntime: Promise<void> | undefined

/** Return one source-relative resource in development and packaged builds. */
function desktopResource(name: string): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'resources', name)
}

/** Return the published CLI entry used by the desktop host child process. */
function cliEntry(): string {
  const require = createRequire(import.meta.url)
  const manifest = require.resolve('@deepseek-ai/dsh/package.json')
  return join(dirname(manifest), 'lib', 'bin.js')
}

/** Open the desktop log file below the selected installation Data root. */
function openRuntimeLog(): WriteStream {
  const logDirectory = join(dataPaths.desktop, 'logs')
  mkdirSync(logDirectory, { recursive: true })
  return createWriteStream(join(logDirectory, 'runtime.log'), { flags: 'a', encoding: 'utf8' })
}

/** Write one line to the desktop log and the runtime's captured stream. */
function logRuntime(prefix: string, text: string): void {
  runtimeLog?.write(`[${new Date().toISOString()}] ${prefix} ${text}`)
}

/** Read the small desktop-owned preference document. */
function readPreferences(): DesktopPreferences {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(dataPaths.desktop, 'desktop-preferences.json'), 'utf8'))
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : undefined
    if (code !== 'ENOENT') logRuntime('desktop', `preference read failed: ${String(error)}\n`)
    return {}
  }
}

/** Atomically replace the desktop-owned preference document. */
function writePreferences(preferences: DesktopPreferences): void {
  const path = join(dataPaths.desktop, 'desktop-preferences.json')
  const temporary = `${path}.tmp`
  writeFileSync(temporary, `${JSON.stringify(preferences, null, 2)}\n`, 'utf8')
  renameSync(temporary, path)
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
      DSH_HOME: dataPaths.harness,
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
        if (url !== undefined) succeed(url)
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

/** Keep one child view in the content area to the right of the desktop rail. */
function contentBounds(window: BrowserWindow): Rectangle {
  const size = window.getContentSize()
  const width = size[0] ?? RAIL_WIDTH
  const height = size[1] ?? 0
  return { x: RAIL_WIDTH, y: 0, width: Math.max(0, width - RAIL_WIDTH), height }
}

/** Update both retained browser views after a window resize. */
function layoutViews(window: BrowserWindow): void {
  const bounds = contentBounds(window)
  agentView?.setBounds(bounds)
  chatView?.setBounds(bounds)
}

/** Send active/unread state to the rail without exposing IPC in its renderer. */
function updateRail(): void {
  const window = mainWindow
  if (window === undefined || window.isDestroyed()) return
  const script = `window.dshDesktopSetState(${JSON.stringify(activeView)}, ${JSON.stringify(chatUnread)})`
  void window.webContents.executeJavaScript(script).catch(() => {
    // The shell can still be loading; did-finish-load publishes the current state again.
  })
}

/** Make the main window visible and focused. */
function activateWindow(): void {
  const window = mainWindow
  if (window === undefined) return
  if (window.isMinimized()) window.restore()
  window.show()
  window.focus()
}

/** Display one content view while retaining both renderers and their state. */
function selectView(next: ActiveView): void {
  activeView = next
  agentView?.setVisible(next === 'agent')
  chatView?.setVisible(next === 'chat')
  if (next === 'chat') chatUnread = false
  updateRail()
}

/** Load the official site at most once per application process. */
function ensureChatLoaded(): void {
  const view = chatView
  if (view === undefined || chatLoaded) return
  chatLoaded = true
  void view.webContents.loadURL(CHAT_URL).catch((error: unknown) => {
    chatLoaded = false
    logRuntime('chat', `load failed: ${String(error)}\n`)
  })
}

/** Show the one-time direct-to-DeepSeek privacy notice before loading Chat. */
async function openChat(): Promise<void> {
  const window = mainWindow
  if (window === undefined) return
  const preferences = readPreferences()
  if (preferences.deepSeekPrivacyAccepted !== true) {
    const answer = await dialog.showMessageBox(window, {
      type: 'info',
      title: '使用 DeepSeek 官网 Chat',
      message: 'Chat 页面由 DeepSeek 官网直接提供',
      detail: '登录账号、聊天内容和上传文件会直接发送给 DeepSeek。DeepSeek Harness Desktop 不读取或保存消息正文；为显示未读和系统通知，仅观察生成是否完成。',
      buttons: ['同意并继续', '取消'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    })
    if (answer.response !== 0) return
    writePreferences({ ...preferences, deepSeekPrivacyAccepted: true })
  }
  ensureChatLoaded()
  selectView('chat')
}

/** Open a URL in the Chat view only when it remains on an official DeepSeek host. */
function navigateChat(target: string): void {
  if (!isOfficialDeepSeekUrl(target)) {
    if (/^https?:\/\//.test(target)) void shell.openExternal(target)
    return
  }
  const view = chatView
  if (view !== undefined) void view.webContents.loadURL(target)
}

/** Publish a content-free Windows completion notification for background Chat. */
function notifyChatComplete(url: string): void {
  if (!Notification.isSupported()) return
  const notification = new Notification({
    title: APP_NAME,
    body: 'DeepSeek 官网回复已完成',
    silent: false,
  })
  notification.on('click', () => {
    activateWindow()
    ensureChatLoaded()
    if (isOfficialDeepSeekUrl(url) && chatView?.webContents.getURL() !== url) navigateChat(url)
    selectView('chat')
  })
  notification.show()
}

/** Configure the retained official-site view and its browser permissions. */
function createChatView(): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      partition: CHAT_PARTITION,
      preload: desktopResource('chat-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  const chatSession = view.webContents.session
  chatSession.setPermissionCheckHandler((_contents, permission, origin) => (
    (permission === 'media' || permission === 'clipboard-sanitized-write')
      && isOfficialDeepSeekUrl(origin)
  ))
  chatSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback((permission === 'media' || permission === 'clipboard-sanitized-write')
      && isOfficialDeepSeekUrl(contents.getURL()))
  })
  chatSession.on('will-download', (_event, item) => {
    item.setSaveDialogOptions({
      title: '保存 DeepSeek 下载文件',
      defaultPath: item.getFilename(),
    })
  })
  view.webContents.setWindowOpenHandler(({ url }) => {
    navigateChat(url)
    return { action: 'deny' }
  })
  view.webContents.on('will-navigate', (event, target) => {
    if (isOfficialDeepSeekUrl(target)) return
    event.preventDefault()
    if (/^https?:\/\//.test(target)) void shell.openExternal(target)
  })
  const rememberUrl = (): void => {
    const url = view.webContents.getURL()
    if (isOfficialDeepSeekUrl(url)) chatCompletionUrl = url
  }
  view.webContents.on('did-navigate', rememberUrl)
  view.webContents.on('did-navigate-in-page', rememberUrl)
  return view
}

/** Configure the retained local Harness view. */
function createAgentView(url: URL): WebContentsView {
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  view.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//.test(target)) void shell.openExternal(target)
    return { action: 'deny' }
  })
  view.webContents.on('will-navigate', (event, target) => {
    if (isRuntimeUrl(target, url.origin)) return
    event.preventDefault()
    if (/^https?:\/\//.test(target)) void shell.openExternal(target)
  })
  void view.webContents.loadURL(url.toString())
  return view
}

/** Create the native shell and retain Agent and Chat as sibling browser views. */
function createMainWindow(url: URL): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: '#f5f6f8',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  agentView = createAgentView(url)
  chatView = createChatView()
  window.contentView.addChildView(agentView)
  window.contentView.addChildView(chatView)
  chatView.setVisible(false)
  layoutViews(window)
  window.on('resize', () => { layoutViews(window) })
  window.webContents.on('did-finish-load', updateRail)
  window.webContents.on('will-navigate', (event, target) => {
    let command: URL
    try {
      command = new URL(target)
    } catch {
      return
    }
    if (command.protocol !== 'dsh-desktop:') return
    event.preventDefault()
    if (command.hostname === 'agent') selectView('agent')
    if (command.hostname === 'chat') void openChat()
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
    agentView = undefined
    chatView = undefined
  })
  void window.loadFile(desktopResource('shell.html'))
  return window
}

/** Display a startup failure without exposing a console window to the user. */
async function showStartupFailure(error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error)
  logRuntime('desktop', `startup failed: ${message}\n`)
  await dialog.showMessageBox({
    type: 'error',
    title: `${APP_NAME} 无法启动`,
    message: migrationFailure === undefined
      ? 'DeepSeek Harness 本地服务启动失败。'
      : '旧版本数据迁移失败，旧数据已保留。',
    detail: `${message}\n\n日志位于所选安装盘的 DeepSeek Harness\\Data\\Desktop\\logs。`,
  })
}

/** Boot the host after Electron has initialized its application data paths. */
async function startApplication(): Promise<void> {
  app.setAppUserModelId('ai.deepseek.harness')
  if (migrationFailure !== undefined) {
    throw migrationFailure instanceof Error
      ? migrationFailure
      : new Error('Desktop data migration failed.', { cause: migrationFailure })
  }
  const url = await startRuntime()
  mainWindow = createMainWindow(url)
  if (readPreferences().deepSeekPrivacyAccepted === true) ensureChatLoaded()
}

ipcMain.on('dsh-desktop:chat-generation', (event, running: unknown) => {
  if (event.sender !== chatView?.webContents || typeof running !== 'boolean') return
  const completed = chatGenerating && !running
  chatGenerating = running
  if (!completed || activeView === 'chat') return
  chatUnread = true
  updateRail()
  notifyChatComplete(chatCompletionUrl)
})

const hasLock = app.requestSingleInstanceLock()
if (!hasLock) {
  app.quit()
} else {
  app.on('second-instance', activateWindow)
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
