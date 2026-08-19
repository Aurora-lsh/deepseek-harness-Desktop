import { mkdtempSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  legacyDataLocations,
  migrateLegacyData,
  resolveDesktopDataPaths,
} from '../src/data.ts'

describe('desktop data layout', () => {
  it('uses fixed App and Data siblings for an installed executable', () => {
    const paths = resolveDesktopDataPaths(
      'D:\\DeepSeek Harness\\App\\DeepSeek Harness.exe',
      true,
      'C:\\Users\\me\\AppData\\Roaming\\desktop',
    )
    expect(paths).toEqual({
      root: 'D:\\DeepSeek Harness',
      app: 'D:\\DeepSeek Harness\\App',
      data: 'D:\\DeepSeek Harness\\Data',
      harness: 'D:\\DeepSeek Harness\\Data\\Harness',
      desktop: 'D:\\DeepSeek Harness\\Data\\Desktop',
    })
  })

  it('keeps development inside Electron userData unless explicitly overridden', () => {
    const userData = resolve('tmp/dsh-desktop')
    const paths = resolveDesktopDataPaths(resolve('repo/electron'), false, userData)
    expect(paths.data).toBe(userData)
    expect(paths.harness).toBe(join(userData, 'Harness'))
    expect(paths.root).toBe(dirname(userData))
  })

  it('maps the v0.1 Harness home and Electron profile into the installed Data root', () => {
    const paths = resolveDesktopDataPaths('D:\\DeepSeek Harness\\App\\app.exe', true, 'C:\\unused')
    expect(legacyDataLocations('C:\\Users\\me', 'C:\\Users\\me\\AppData\\Roaming', paths)).toEqual([
      { source: 'C:\\Users\\me\\.dsh', destination: 'D:\\DeepSeek Harness\\Data\\Harness' },
      {
        source: 'C:\\Users\\me\\AppData\\Roaming\\@deepseek-ai\\dsh-desktop',
        destination: 'D:\\DeepSeek Harness\\Data\\Desktop',
      },
    ])
  })
})

describe('legacy data migration', () => {
  it('merges, verifies, and removes old directories only after all copies succeed', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-migration-'))
    const oldHarness = join(root, 'old-harness')
    const oldDesktop = join(root, 'old-desktop')
    const data = join(root, 'new', 'Data')
    mkdirSync(join(oldHarness, 'profiles'), { recursive: true })
    mkdirSync(oldDesktop, { recursive: true })
    writeFileSync(join(oldHarness, 'profiles', 'web.yml'), 'profile')
    writeFileSync(join(oldDesktop, 'Preferences'), 'preferences')

    const result = migrateLegacyData([
      { source: oldHarness, destination: join(data, 'Harness') },
      { source: oldDesktop, destination: join(data, 'Desktop') },
    ])

    expect(result.migrated).toEqual([oldHarness, oldDesktop])
    expect(readFileSync(join(data, 'Harness', 'profiles', 'web.yml'), 'utf8')).toBe('profile')
    expect(readFileSync(join(data, 'Desktop', 'Preferences'), 'utf8')).toBe('preferences')
    expect(() => readFileSync(join(oldHarness, 'profiles', 'web.yml'))).toThrow()
    expect(() => readFileSync(join(oldDesktop, 'Preferences'))).toThrow()
  })

  it.runIf(process.platform !== 'win32')('preserves symbolic links without copying their targets', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-desktop-link-migration-'))
    const outside = join(root, 'outside.txt')
    const source = join(root, 'old')
    const destination = join(root, 'new')
    writeFileSync(outside, 'outside')
    mkdirSync(source)
    symlinkSync(outside, join(source, 'outside-link'))

    migrateLegacyData([{ source, destination }])

    expect(readFileSync(join(destination, 'outside-link'), 'utf8')).toBe('outside')
    expect(readFileSync(outside, 'utf8')).toBe('outside')
  })
})
