/**
 * Installed desktop paths and the one-time v0.1 data migration.
 * @module @deepseek-ai/dsh-desktop/data
 */

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

/** Fixed application-root directory created by the Windows installer. */
export const DESKTOP_ROOT_NAME = 'DeepSeek Harness'

/** Paths owned by one installed Desktop copy. */
export interface DesktopDataPaths {
  /** `X:\DeepSeek Harness` selected by the installer. */
  root: string
  /** Electron application files. */
  app: string
  /** User-owned application data. */
  data: string
  /** Harness configuration, plugins, sessions, and attachments. */
  harness: string
  /** Electron preferences, website session, cache, and logs. */
  desktop: string
}

/** One legacy directory copied into the 0.2 data tree. */
export interface LegacyDataLocation {
  /** Existing v0.1 directory. */
  source: string
  /** New directory below the installed Data root. */
  destination: string
}

/** Result of the synchronous migration performed before Electron opens its profile. */
export interface DataMigrationResult {
  /** Legacy directories that were copied, verified, and removed. */
  migrated: readonly string[]
}

/**
 * Resolve the fixed App/Data layout from the running executable.
 *
 * @param executablePath - Electron executable path.
 * @param packaged - whether the executable is an installed/packaged build.
 * @param developmentUserData - Electron's ordinary development profile.
 * @param overrideDataRoot - test/development override for the Data directory.
 * @returns the paths the desktop process owns.
 */
export function resolveDesktopDataPaths(
  executablePath: string,
  packaged: boolean,
  developmentUserData: string,
  overrideDataRoot?: string,
): DesktopDataPaths {
  const executableDirectory = dirname(resolve(executablePath))
  const installedRoot = packaged && basename(executableDirectory).toLowerCase() === 'app'
    ? dirname(executableDirectory)
    : executableDirectory
  const data = overrideDataRoot === undefined
    ? packaged ? join(installedRoot, 'Data') : resolve(developmentUserData)
    : resolve(overrideDataRoot)
  const root = packaged ? installedRoot : dirname(data)
  return {
    root,
    app: packaged ? join(root, 'App') : executableDirectory,
    data,
    harness: join(data, 'Harness'),
    desktop: join(data, 'Desktop'),
  }
}

/**
 * Return the v0.1 directories eligible for migration.
 *
 * @param home - Windows user profile directory.
 * @param appData - Windows roaming application-data directory.
 * @param paths - installed 0.2 paths.
 * @returns legacy Harness and Electron profile locations.
 */
export function legacyDataLocations(
  home: string,
  appData: string,
  paths: DesktopDataPaths,
): readonly LegacyDataLocation[] {
  return [
    { source: join(home, '.dsh'), destination: paths.harness },
    { source: join(appData, '@deepseek-ai', 'dsh-desktop'), destination: paths.desktop },
  ]
}

/** Hash one file for post-copy verification. */
function fileDigest(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/**
 * Verify that every source entry exists identically at the destination.
 * Extra destination entries are allowed because a retry can follow a partial copy.
 */
function verifyCopiedTree(source: string, destination: string): void {
  const sourceStat = lstatSync(source)
  const destinationStat = lstatSync(destination)
  if (sourceStat.isSymbolicLink()) {
    if (!destinationStat.isSymbolicLink() || readlinkSync(source) !== readlinkSync(destination)) {
      throw new Error(`link verification failed for "${source}"`)
    }
    return
  }
  if (sourceStat.isDirectory()) {
    if (!destinationStat.isDirectory()) {
      throw new Error(`directory verification failed for "${source}"`)
    }
    for (const entry of readdirSync(source)) {
      verifyCopiedTree(join(source, entry), join(destination, entry))
    }
    return
  }
  if (!sourceStat.isFile() || !destinationStat.isFile()
    || sourceStat.size !== destinationStat.size
    || fileDigest(source) !== fileDigest(destination)) {
    throw new Error(`file verification failed for "${source}"`)
  }
}

/** Refuse a migration target that could recursively contain its source. */
function assertSeparateTrees(source: string, destination: string): void {
  const from = resolve(source)
  const to = resolve(destination)
  const withinSource = relative(from, to)
  if (from === to || !isAbsolute(withinSource)
    && withinSource !== '..' && !withinSource.startsWith(`..${sep}`)) {
    throw new Error(`unsafe desktop data migration from "${from}" to "${to}"`)
  }
}

/**
 * Copy and verify every existing legacy directory before removing any source.
 * The operation is intentionally synchronous: Electron must not open its new
 * profile while the old profile is being copied into it.
 *
 * @param locations - legacy-to-current directory pairs.
 * @returns the legacy sources removed after successful verification.
 */
export function migrateLegacyData(
  locations: readonly LegacyDataLocation[],
): DataMigrationResult {
  const pending = locations.filter(location => existsSync(location.source))
  for (const { source, destination } of pending) {
    assertSeparateTrees(source, destination)
    mkdirSync(destination, { recursive: true })
    cpSync(source, destination, {
      recursive: true,
      force: true,
      dereference: false,
      preserveTimestamps: true,
      verbatimSymlinks: true,
    })
    verifyCopiedTree(source, destination)
  }
  for (const { source } of pending) {
    rmSync(source, { recursive: true, force: false })
  }
  return { migrated: pending.map(location => location.source) }
}
