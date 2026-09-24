/**
 * Stores one value across several entries of a size-limited key-value store.
 *
 * Exists for one reason: the Supabase session is 2.2 KB and expo-secure-store
 * holds about 2 KB per value (ADR-0005). Moving the session to AsyncStorage
 * "because it does not fit" would take the token out of the Keychain, which is
 * exactly what rule 8 forbids. Splitting it keeps every byte in SecureStore.
 *
 * Layout for key `k`: `k.count` holds how many chunks there are, `k.0` … `k.n-1`
 * hold the pieces. The count is written LAST, so a crash mid-write leaves the
 * old count pointing at a mix of chunks; the joined text is not valid JSON and
 * the session is read as absent. The worst case is signing in again, never
 * accepting a corrupted session.
 *
 * Pure: the backend is injected, so this is tested without a device.
 */

export type KeyValueBackend = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

/**
 * Counted in UTF-16 units, while the limit is in bytes. One unit is at most
 * 3 bytes in UTF-8, so 600 units stay under 1.8 KB whatever the content — a
 * display name with accents included.
 */
export const CHUNK_UNITS = 600

const countKey = (key: string) => `${key}.count`
const chunkKey = (key: string, index: number) => `${key}.${index}`

function split(value: string, size: number): string[] {
  const chunks: string[] = []
  for (let start = 0; start < value.length; start += size) {
    chunks.push(value.slice(start, start + size))
  }
  // An empty string is still a value, and must read back as '' rather than null.
  return chunks.length > 0 ? chunks : ['']
}

async function readCount(backend: KeyValueBackend, key: string): Promise<number | null> {
  const raw = await backend.getItem(countKey(key))
  if (raw === null) return null

  const count = Number(raw)
  return Number.isInteger(count) && count > 0 ? count : null
}

export function createChunkedStorage(
  backend: KeyValueBackend,
  chunkUnits: number = CHUNK_UNITS,
): KeyValueBackend {
  return {
    async getItem(key) {
      const count = await readCount(backend, key)
      if (count === null) return null

      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) => backend.getItem(chunkKey(key, index))),
      )

      // A missing piece means a torn write: no value is better than half a value.
      if (chunks.some((chunk) => chunk === null)) return null
      return chunks.join('')
    },

    async setItem(key, value) {
      const previous = (await readCount(backend, key)) ?? 0
      const chunks = split(value, chunkUnits)

      for (const [index, chunk] of chunks.entries()) {
        await backend.setItem(chunkKey(key, index), chunk)
      }
      await backend.setItem(countKey(key), String(chunks.length))

      // A shorter value leaves the old tail behind; nothing would ever read it,
      // but a stale token fragment has no business staying on the device.
      for (let index = chunks.length; index < previous; index += 1) {
        await backend.removeItem(chunkKey(key, index))
      }
    },

    async removeItem(key) {
      const count = (await readCount(backend, key)) ?? 0
      await backend.removeItem(countKey(key))
      for (let index = 0; index < count; index += 1) {
        await backend.removeItem(chunkKey(key, index))
      }
    },
  }
}
