import {
  isInColombia,
  okBranch,
  tidyName,
  type BranchAdapter,
  type BranchNormalizeResult,
  type RawBranch,
} from '../core/branch-types'
import { fetchJson } from '../core/http'

/**
 * Ara's shops: its store locator's own endpoint returns every shop in ONE
 * call (~1.650). Undocumented WordPress route — validated record by record.
 *
 * Coordinates arrive as strings. `phone` and `zone` hold junk (the shop name,
 * a stray longitude) and are ignored.
 */

const URL = 'https://aratiendas.com/wp-json/map-ara/v1/stores'

function coordinate(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const n = Number(value)
  return Number.isFinite(n) && value !== '' ? n : null
}

/**
 * The source repeats words: "Chico Cra Cra 15", "San Patricio Patricio",
 * "Chico Norte Norte Tres". Consecutive duplicates collapse to one.
 */
export function collapseRepeats(text: string): string {
  return text
    .split(/\s+/)
    .filter((word, i, words) => i === 0 || word.toLowerCase() !== words[i - 1]?.toLowerCase())
    .join(' ')
}

export const araBranchAdapter: BranchAdapter = {
  storeSlug: 'ara',

  async *fetchBranches(ctx) {
    // Same failure behaviour as every branch adapter (vtex-pickup-points.ts):
    // report and move on. With one request, moving on means yielding nothing,
    // and the pipeline aborts on an empty run.
    const body = await fetchJson(URL, ctx)
    if (body === null) return
    if (!Array.isArray(body)) {
      ctx.onRequestDropped?.(URL, 'respuesta sin lista de tiendas')
      return
    }
    for (const item of body) {
      if (item !== null && typeof item === 'object') yield item as RawBranch
    }
  },

  normalize(raw: RawBranch): BranchNormalizeResult {
    if (typeof raw.store_code !== 'string' || typeof raw.name !== 'string') {
      return { status: 'failed', reason: 'tienda de Ara sin codigo o sin nombre' }
    }
    if (raw.status !== '1') return { status: 'skipped', reason: 'tienda inactiva en la fuente' }

    const latitude = coordinate(raw.latitude)
    const longitude = coordinate(raw.longitude)
    if (latitude === null || longitude === null) {
      return { status: 'skipped', reason: 'sin coordenadas' }
    }
    if (!isInColombia(latitude, longitude)) {
      return { status: 'skipped', reason: 'coordenada fuera de Colombia' }
    }

    const address = typeof raw.address === 'string' ? raw.address.trim() : ''
    const city = typeof raw.city === 'string' ? raw.city.trim() : ''

    return okBranch({
      externalId: raw.store_code,
      // "Cajica - Cajica Cra 6" → "Ara Cajica Cra 6": the part after the dash
      // already names the town.
      name: `Ara ${collapseRepeats(raw.name.split(' - ').pop()?.trim() || raw.name.trim())}`,
      address: address === '' ? null : address,
      city: city === '' ? null : tidyName(city),
      latitude,
      longitude,
    })
  },
}
