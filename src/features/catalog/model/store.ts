import { z } from 'zod'

/** Pure domain model for stores. No React, no network (rule 3). */

export const storeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  sourceType: z.enum(['api', 'scraper', 'manual']),
  isActive: z.boolean(),
  productCount: z.number().int().nonnegative(),
  lastUpdatedAt: z.string().nullable(),
  /** Metres to the chain's nearest shop; null when the list has no origin. */
  nearestM: z.number().int().nonnegative().nullable(),
})

export type Store = z.infer<typeof storeSchema>

/**
 * A store with no products yet is not an error: its adapter simply is not
 * built. The list shows it dimmed rather than hiding it, so the user can see
 * what is coming (docs/domain/02-ingestion.md).
 */
export function isBrowsable(store: Store): boolean {
  return store.isActive && store.productCount > 0
}

/**
 * How stale the catalogue is, in plain words. Data freshness is stated calmly
 * and in text — never with a red icon (docs/design/00-visual-direction.md).
 */
export function freshnessLabel(lastUpdatedAt: string | null, now: Date = new Date()): string {
  if (lastUpdatedAt === null) return 'Sin datos todavía'

  const updated = new Date(lastUpdatedAt)
  if (Number.isNaN(updated.getTime())) return 'Sin datos todavía'

  const hours = Math.floor((now.getTime() - updated.getTime()) / 3_600_000)
  if (hours < 1) return 'Precios de hace un momento'
  if (hours < 24) return `Precios de hace ${hours} h`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Precios de ayer'
  return `Precios de hace ${days} días`
}

/** A point to search from. Catalog's own type: it never imports `branches` (rule 1). */
export type NearbyOrigin = {
  latitude: number
  longitude: number
}

/** Decimals of a degree the origin keeps: 0.001° ≈ 110 m. */
const ORIGIN_DECIMALS = 3
const ORIGIN_GRID_DEGREES = 10 ** -ORIGIN_DECIMALS

/**
 * The origin snapped to a ~110 m grid. Used both in the query key and in the
 * request, so GPS jitter of a few metres neither refetches nor changes the
 * answer (plan 0003, "Rendimiento").
 *
 * The distances that come back are measured from the snapped point, up to
 * ~80 m away from the real one (half the cell's diagonal). That is why the
 * grid is not coarser and why `distanceLabel` only speaks in steps of 100 m.
 */
export function roundOrigin(origin: NearbyOrigin): NearbyOrigin {
  const snap = (degrees: number) =>
    // toFixed keeps 4.711 from becoming 4.711000000000001 in the cache key.
    Number(
      (Math.round(degrees / ORIGIN_GRID_DEGREES) * ORIGIN_GRID_DEGREES).toFixed(ORIGIN_DECIMALS),
    )
  return { latitude: snap(origin.latitude), longitude: snap(origin.longitude) }
}

/** The finest step a distance from a snapped origin can honestly be told in. */
const DISTANCE_STEP_M = 100

/**
 * "menos de 100 m" next door, "300 m" up close, "1,2 km" further out, "25 km"
 * far away. Reads after "a": "a 300 m", "a menos de 100 m".
 *
 * Coarser than the map's label in `branches` on purpose: the map measures
 * from the exact origin, the list from one snapped to ~110 m (`roundOrigin`),
 * so anything finer than 100 m would claim a precision this number lacks.
 */
export function distanceLabel(distanceM: number): string {
  if (distanceM < DISTANCE_STEP_M) return `menos de ${DISTANCE_STEP_M} m`

  const metres = Math.round(distanceM / DISTANCE_STEP_M) * DISTANCE_STEP_M
  // 950 m rounds to "1000 m", which reads worse than the "1,0 km" it is.
  if (metres < 1000) return `${metres} m`

  const km = metres / 1000
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`
}
