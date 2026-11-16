import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyTurnstile } from './turnstile'

describe('verifyTurnstile', () => {
  beforeEach(() => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '1x0000000000000000000000000000000AA')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('brak tokenu = false, bez wywołania sieci', async () => {
    const fetchFn = vi.fn()
    expect(await verifyTurnstile(null, undefined, fetchFn)).toBe(false)
    expect(await verifyTurnstile('', undefined, fetchFn)).toBe(false)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('poprawny token = true i POST z sekretem, tokenem oraz IP', async () => {
    const ok = vi.fn().mockResolvedValue(Response.json({ success: true }))
    expect(await verifyTurnstile('tok', '1.2.3.4', ok)).toBe(true)
    expect(ok).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    )
    const body = ok.mock.calls[0][1].body as URLSearchParams
    expect(body.get('secret')).toBe('1x0000000000000000000000000000000AA')
    expect(body.get('response')).toBe('tok')
    expect(body.get('remoteip')).toBe('1.2.3.4')
  })

  it('odrzucony token = false', async () => {
    const no = vi.fn().mockResolvedValue(Response.json({ success: false }))
    expect(await verifyTurnstile('tok', undefined, no)).toBe(false)
  })

  it('błąd sieci = false', async () => {
    expect(await verifyTurnstile('tok', undefined, vi.fn().mockRejectedValue(new Error()))).toBe(false)
  })

  it('brak sekretu w env = false', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    expect(await verifyTurnstile('tok', undefined, vi.fn())).toBe(false)
  })

  it('wysyła zapytanie z limitem czasu (AbortSignal), a przekroczenie limitu = false (fail-closed)', async () => {
    const ok = vi.fn().mockResolvedValue(Response.json({ success: true }))
    await verifyTurnstile('tok', undefined, ok)
    expect(ok.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    const abort = vi.fn().mockRejectedValue(new DOMException('This operation was aborted', 'AbortError'))
    expect(await verifyTurnstile('tok', undefined, abort)).toBe(false)
  })
})
