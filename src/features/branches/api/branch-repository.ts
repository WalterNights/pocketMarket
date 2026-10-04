import { supabase } from '@/shared/lib/supabase'

import { branchSchema, type Branch, type Coordinates } from '../model/branch'

export class BranchError extends Error {
  constructor(
    readonly operation: string,
    override readonly cause: unknown,
  ) {
    super(`Fallo en ${operation}`)
    this.name = 'BranchError'
  }
}

/** "The 30 nearest, never further than 25 km" — adaptive without a radius to tune. */
const MAX_RADIUS_M = 25_000
const LIMIT = 30

export const branchRepository = {
  /**
   * Nearest active branches of every chain, closest first. Radius and limit
   * are clamped again on the server; these are the app's defaults, not the
   * only guard.
   */
  async nearest(origin: Coordinates, signal?: AbortSignal): Promise<Branch[]> {
    const base = supabase.rpc('nearest_branches', {
      p_lat: origin.latitude,
      p_lng: origin.longitude,
      p_max_radius_m: MAX_RADIUS_M,
      p_limit: LIMIT,
    })
    const { data, error } = await (signal ? base.abortSignal(signal) : base)
    if (error) throw new BranchError('branches.nearest', error)

    return branchSchema.array().parse(
      data.map((row) => ({
        id: row.id,
        storeSlug: row.store_slug,
        storeName: row.store_name,
        hasPrices: row.has_prices,
        name: row.name,
        address: row.address,
        city: row.city,
        latitude: row.lat,
        longitude: row.lng,
        distanceM: row.distance_m,
      })),
    )
  },
}
