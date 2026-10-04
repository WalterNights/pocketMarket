import type { BranchFetchContext, RawBranch } from '../core/branch-types'
import type { GridPoint } from '../core/colombia-grid'
import { fetchJson } from '../core/http'
import { sleep } from '../core/types'

/**
 * VTEX "pickup points near a coordinate". Éxito and D1 both run on VTEX and
 * publish their shops this way. Not a documented store locator: it is what
 * the checkout uses, so every record goes through Zod in normalize().
 *
 * Results are capped per point (300 for D1), so callers pass a grid and the
 * pipeline deduplicates. Points that hit the cap are reported through
 * ctx.onSaturated: they mean the grid is too coarse there.
 *
 * Failure behaviour, shared by every branch adapter: a request given up on is
 * reported by core/http (ctx.onRequestDropped) and the sweep moves on; a
 * response with a shape we cannot read is reported the same way. Neither
 * throws — one point failing is not the chain failing — and the pipeline
 * refuses to retire shops after any dropped request.
 */

const PAGE_SIZE = 50
const MAX_PAGES = 6 // 6 × 50 = the 300 cap
const RESULT_CAP = PAGE_SIZE * MAX_PAGES

export type PickupPointsPage = {
  paging?: { page?: number; pages?: number; total?: number }
  items?: { pickupPoint?: RawBranch }[]
}

export async function* sweepPickupPoints(
  baseUrl: string,
  points: readonly GridPoint[],
  ctx: BranchFetchContext,
): AsyncIterable<RawBranch> {
  for (const point of points) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      // VTEX takes "longitude;latitude", in that order.
      const url =
        `${baseUrl}/api/checkout/pub/pickup-points` +
        `?geoCoordinates=${point.longitude};${point.latitude}&page=${page}&pageSize=${PAGE_SIZE}`

      const body = (await fetchJson(url, ctx)) as PickupPointsPage | null
      await sleep(ctx.delayMs)
      // Dropped: already reported by fetchJson. The rest of this point's
      // pages are unreachable without this one's paging, so move on.
      if (body === null) break
      if (typeof body !== 'object' || !Array.isArray(body.items)) {
        // An empty answer (a point with no shop nearby) is not a hole.
        if (body?.paging?.total !== 0) {
          ctx.onRequestDropped?.(url, 'respuesta sin lista de items')
        }
        break
      }

      // Checked on the first page, before any break: a point whose total
      // reaches the cap is saturated whatever the paging says afterwards.
      if (page === 1 && (body.paging?.total ?? 0) >= RESULT_CAP) {
        ctx.onSaturated?.(point.label)
      }

      for (const item of body.items) {
        if (item.pickupPoint) yield item.pickupPoint
      }

      const pages = body.paging?.pages ?? 1
      if (page >= pages) break
    }
  }
}

/** Fields both chains use, read defensively: the shape is VTEX's, not a contract. */
export function readPickupPoint(raw: RawBranch): {
  id: string
  name: string
  street: string | null
  city: string | null
  latitude: number
  longitude: number
} | null {
  const address = raw.address as Record<string, unknown> | undefined
  const coords = address?.geoCoordinates
  if (
    typeof raw.id !== 'string' ||
    typeof raw.friendlyName !== 'string' ||
    !Array.isArray(coords) ||
    typeof coords[0] !== 'number' ||
    typeof coords[1] !== 'number'
  ) {
    return null
  }

  const street = typeof address?.street === 'string' ? address.street.trim() : ''
  const city = typeof address?.city === 'string' ? address.city.trim() : ''

  return {
    id: raw.id,
    name: raw.friendlyName.trim(),
    street: street === '' ? null : street,
    city: city === '' ? null : city,
    // GeoJSON order: [longitude, latitude].
    longitude: coords[0],
    latitude: coords[1],
  }
}
