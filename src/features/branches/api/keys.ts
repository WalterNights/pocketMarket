import type { Coordinates } from '../model/branch'
import type { TravelMode } from '../model/route'

/**
 * Query key factory (03-patterns.md).
 *
 * `nearest` rounds the origin to ~100 m so the jitter of successive location
 * fixes reuses the cached result instead of asking for the same shops again.
 *
 * `route` does NOT round `from`: a reroute starts a few tens of metres from
 * the previous start and must reach the service, not come back from the cache
 * with the very route the user just left. Starting the same trip again from
 * the same reading still hits the cache, because that reading is identical.
 */
const round = (value: number) => Math.round(value * 1000) / 1000

export const branchKeys = {
  all: ['branches'] as const,
  nearest: (origin: Coordinates) =>
    [...branchKeys.all, 'nearest', round(origin.latitude), round(origin.longitude)] as const,
  /** Disabled query: there is no origin yet. */
  nearestIdle: () => [...branchKeys.all, 'nearest', 'idle'] as const,
  route: (from: Coordinates, branchId: string, mode: TravelMode) =>
    [...branchKeys.all, 'route', from.latitude, from.longitude, branchId, mode] as const,
  /** Disabled query: no trip in progress. */
  routeIdle: () => [...branchKeys.all, 'route', 'idle'] as const,
}
