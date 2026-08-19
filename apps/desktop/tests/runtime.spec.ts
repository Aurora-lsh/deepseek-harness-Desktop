import { describe, expect, it } from 'vitest'
import {
  isOfficialDeepSeekUrl,
  isRuntimeUrl,
  LOOPBACK_HOST,
  parseRuntimeReadyUrl,
  runtimeArguments,
} from '../src/runtime.ts'

describe('desktop runtime launch', () => {
  it('places the required Node flag before the packaged CLI entry', () => {
    expect(runtimeArguments('C:\\app\\dsh\\lib\\bin.js')).toEqual([
      '--expose-internals',
      'C:\\app\\dsh\\lib\\bin.js',
      '--profile',
      'web',
      '--host',
      LOOPBACK_HOST,
      '--port',
      '0',
    ])
  })

  it('accepts loopback readiness announcements', () => {
    expect(parseRuntimeReadyUrl('dsh web: http://127.0.0.1:43123')?.toString())
      .toBe('http://127.0.0.1:43123/')
    expect(parseRuntimeReadyUrl('  dsh web: http://127.0.0.1:43123/ (LAN: http://10.0.0.2:43123)  ')?.toString())
      .toBe('http://127.0.0.1:43123/')
  })

  it('ignores output that does not announce the desktop loopback host', () => {
    expect(parseRuntimeReadyUrl('loader: ready')).toBeUndefined()
    expect(parseRuntimeReadyUrl('dsh web: http://localhost:43123')).toBeUndefined()
    expect(parseRuntimeReadyUrl('dsh web: http://0.0.0.0:43123')).toBeUndefined()
  })

  it('allows only navigations with the runtime origin', () => {
    const origin = 'http://127.0.0.1:43123'
    expect(isRuntimeUrl(`${origin}/sessions/1`, origin)).toBe(true)
    expect(isRuntimeUrl('https://example.com/', origin)).toBe(false)
    expect(isRuntimeUrl('not a URL', origin)).toBe(false)
  })

  it('keeps only HTTPS DeepSeek hosts inside the official Chat view', () => {
    expect(isOfficialDeepSeekUrl('https://chat.deepseek.com/a/chat/s/123')).toBe(true)
    expect(isOfficialDeepSeekUrl('https://deepseek.com/')).toBe(true)
    expect(isOfficialDeepSeekUrl('https://platform.deepseek.com/usage')).toBe(true)
    expect(isOfficialDeepSeekUrl('https://deepseek.com.example.test/')).toBe(false)
    expect(isOfficialDeepSeekUrl('http://chat.deepseek.com/')).toBe(false)
    expect(isOfficialDeepSeekUrl('not a URL')).toBe(false)
  })
})
