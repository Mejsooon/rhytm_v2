import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isPasswordPwned } from './hibp'

// SHA-1('password123') = CBFDAC6008F9CAB4083784CBD1874F76618D2A97 → prefiks CBFDA, sufiks C6008F9C…2A97
describe('isPasswordPwned', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('zwraca true, gdy sufiks jest na liście, i wysyła tylko prefiks', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        new Response('C6008F9CAB4083784CBD1874F76618D2A97:2500\r\n0000000000000000000000000000000000A:0'),
      )
    expect(await isPasswordPwned('password123', fetchFn)).toBe(true)
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.pwnedpasswords.com/range/CBFDA',
      expect.objectContaining({ headers: { 'Add-Padding': 'true' } }),
    )
  })

  it('przy błędzie sieci zwraca false', async () => {
    expect(await isPasswordPwned('x', vi.fn().mockRejectedValue(new Error('offline')))).toBe(false)
    expect(console.warn).toHaveBeenCalled()
  })

  it('przy odpowiedzi nie-2xx zwraca false', async () => {
    expect(await isPasswordPwned('x', vi.fn().mockResolvedValue(new Response('', { status: 503 })))).toBe(false)
  })

  it('ignoruje wpisy paddingu (licznik 0)', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('C6008F9CAB4083784CBD1874F76618D2A97:0'))
    expect(await isPasswordPwned('password123', fetchFn)).toBe(false)
  })

  it('wysyła zapytanie z limitem czasu (AbortSignal), a przekroczenie limitu = false (fail-open)', async () => {
    const ok = vi.fn().mockResolvedValue(new Response(''))
    await isPasswordPwned('x', ok)
    expect(ok.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    const timeout = vi.fn().mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError'))
    expect(await isPasswordPwned('x', timeout)).toBe(false)
    const abort = vi.fn().mockRejectedValue(new DOMException('This operation was aborted', 'AbortError'))
    expect(await isPasswordPwned('x', abort)).toBe(false)
  })
})
