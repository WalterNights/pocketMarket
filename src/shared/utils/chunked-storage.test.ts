import { createChunkedStorage, type KeyValueBackend } from './chunked-storage'

/** In-memory stand-in for SecureStore, rejecting values over its limit. */
function memoryBackend(maxBytes = 2048): KeyValueBackend & { entries: Map<string, string> } {
  const entries = new Map<string, string>()
  return {
    entries,
    getItem: async (key) => entries.get(key) ?? null,
    setItem: async (key, value) => {
      if (new TextEncoder().encode(value).length > maxBytes) throw new Error(`too big: ${key}`)
      entries.set(key, value)
    },
    removeItem: async (key) => {
      entries.delete(key)
    },
  }
}

// Same order of magnitude as the real session (2,209 bytes measured locally).
const SESSION = JSON.stringify({ access_token: 'x'.repeat(967), user: { name: 'Ñandú' } }).repeat(3)

describe('createChunkedStorage', () => {
  it('guarda y lee un valor que no cabe en una sola entrada', async () => {
    const backend = memoryBackend()
    const storage = createChunkedStorage(backend)

    await storage.setItem('sb-auth', SESSION)

    expect(await storage.getItem('sb-auth')).toBe(SESSION)
    expect(backend.entries.get('sb-auth.count')).toBe(String(Math.ceil(SESSION.length / 600)))
  })

  it('ningún trozo pasa el límite, ni con caracteres de 3 bytes', async () => {
    const backend = memoryBackend()
    const storage = createChunkedStorage(backend)

    await expect(storage.setItem('k', '€'.repeat(5000))).resolves.toBeUndefined()
    expect(await storage.getItem('k')).toBe('€'.repeat(5000))
  })

  it('un valor más corto borra los trozos sobrantes', async () => {
    const backend = memoryBackend()
    const storage = createChunkedStorage(backend)

    await storage.setItem('k', 'a'.repeat(1800))
    await storage.setItem('k', 'b')

    expect(await storage.getItem('k')).toBe('b')
    expect([...backend.entries.keys()].sort()).toEqual(['k.0', 'k.count'])
  })

  it('devuelve null si no hay nada guardado', async () => {
    expect(await createChunkedStorage(memoryBackend()).getItem('k')).toBeNull()
  })

  it('devuelve null si falta un trozo, en vez de medio valor', async () => {
    const backend = memoryBackend()
    const storage = createChunkedStorage(backend)

    await storage.setItem('k', 'a'.repeat(1300))
    backend.entries.delete('k.1')

    expect(await storage.getItem('k')).toBeNull()
  })

  it('devuelve null si el contador está corrupto', async () => {
    const backend = memoryBackend()
    backend.entries.set('k.count', 'basura')

    expect(await createChunkedStorage(backend).getItem('k')).toBeNull()
  })

  it('removeItem no deja nada en el dispositivo', async () => {
    const backend = memoryBackend()
    const storage = createChunkedStorage(backend)

    await storage.setItem('k', SESSION)
    await storage.removeItem('k')

    expect(backend.entries.size).toBe(0)
  })

  it('una cadena vacía se lee como vacía, no como ausente', async () => {
    const storage = createChunkedStorage(memoryBackend())

    await storage.setItem('k', '')

    expect(await storage.getItem('k')).toBe('')
  })
})
