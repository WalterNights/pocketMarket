import { fetchJson, fetchJsonResult } from './http'

// No network: global fetch is replaced per test.

const jsonResponse = (status: number, body: unknown = {}): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

// DOMException comes from another realm inside Jest's sandbox, so
// `instanceof Error` is false for it: test for Response instead.
function mockFetch(...steps: (Response | Error | DOMException)[]): jest.SpyInstance {
  const spy = jest.spyOn(globalThis, 'fetch')
  for (const step of steps) {
    if (step instanceof Response) spy.mockResolvedValueOnce(step)
    else spy.mockRejectedValueOnce(step)
  }
  return spy
}

const ctx = (dropped: string[] = []) => ({
  userAgent: 'test',
  delayMs: 0,
  onRequestDropped: (url: string) => {
    dropped.push(url)
  },
})

afterEach(() => {
  jest.restoreAllMocks()
})

jest.spyOn(console, 'warn').mockImplementation(() => undefined)

describe('fetchJson', () => {
  it('reintenta un error de red como si fuera un 5xx', async () => {
    const spy = mockFetch(new TypeError('fetch failed'), jsonResponse(200, { ok: 1 }))
    await expect(fetchJson('https://x.test/a', ctx())).resolves.toEqual({ ok: 1 })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('reintenta un timeout', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    const spy = mockFetch(timeout, jsonResponse(503), jsonResponse(206, [1, 2]))
    await expect(fetchJson('https://x.test/b', ctx())).resolves.toEqual([1, 2])
    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('cada petición lleva un timeout propio', async () => {
    const spy = mockFetch(jsonResponse(200))
    await fetchJson('https://x.test/c', ctx())
    expect(spy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal)
  })

  it('agotados los intentos, descarta la petición y lo reporta', async () => {
    const dropped: string[] = []
    mockFetch(jsonResponse(500), new TypeError('fetch failed'), jsonResponse(502))
    await expect(fetchJson('https://x.test/d', ctx(dropped))).resolves.toBeNull()
    expect(dropped).toEqual(['https://x.test/d'])
  })

  it('un 404 no se reintenta, pero también se reporta', async () => {
    const dropped: string[] = []
    const spy = mockFetch(jsonResponse(404))
    await expect(fetchJson('https://x.test/e', ctx(dropped))).resolves.toBeNull()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(dropped).toHaveLength(1)
  })

  it('si quien llama cancela, no reintenta: lanza', async () => {
    const controller = new AbortController()
    controller.abort()
    mockFetch(new DOMException('aborted', 'AbortError'))
    await expect(
      fetchJson('https://x.test/f', { ...ctx(), signal: controller.signal }),
    ).rejects.toThrow()
  })
})

describe('fetchJsonResult', () => {
  it('un estado de fin de datos no es una petición perdida', async () => {
    const dropped: string[] = []
    mockFetch(jsonResponse(400))
    await expect(
      fetchJsonResult('https://x.test/g', ctx(dropped), { endStatuses: [400] }),
    ).resolves.toEqual({ kind: 'end' })
    expect(dropped).toEqual([])
  })
})
