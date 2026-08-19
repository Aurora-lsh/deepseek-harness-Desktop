/**
 * Pure runtime launch and URL validation helpers for the desktop shell.
 * @module @deepseek-ai/dsh-desktop/runtime
 */

/** Loopback interface used by the desktop-only Web host. */
export const LOOPBACK_HOST = '127.0.0.1'

const RUNTIME_URL = /^http:\/\/127\.0\.0\.1:\d+\/?$/
const READY_LINE = /^dsh web: (http:\/\/127\.0\.0\.1:\d+\/?)(?: \(LAN:.*\))?$/

/**
 * Build Node arguments for the packaged Harness CLI.
 *
 * @param entry Published CLI entry path.
 * @returns Arguments with Node flags before the CLI entry.
 */
export function runtimeArguments(entry: string): string[] {
  return [
    '--expose-internals',
    entry,
    '--profile',
    'web',
    '--host',
    LOOPBACK_HOST,
    '--port',
    '0',
  ]
}

/**
 * Parse the Web host's loopback readiness announcement.
 *
 * @param line One complete stdout line.
 * @returns The announced URL, or undefined for other output.
 */
export function parseRuntimeReadyUrl(line: string): URL | undefined {
  const announced = READY_LINE.exec(line.trim())?.[1]
  if (announced === undefined) return undefined
  const url = new URL(announced)
  return RUNTIME_URL.test(url.toString()) ? url : undefined
}

/**
 * Determine whether a navigation stays inside the Harness host.
 *
 * @param value Navigation target.
 * @param origin Harness host origin.
 * @returns Whether the target has the Harness origin.
 */
export function isRuntimeUrl(value: string, origin: string): boolean {
  try {
    return new URL(value).origin === origin
  } catch {
    return false
  }
}
