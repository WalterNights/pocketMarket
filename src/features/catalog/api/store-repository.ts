import { supabase } from '@/shared/lib/supabase'

import { storeSchema, type NearbyOrigin, type Store } from '../model/store'
import { parseResponse, RepositoryError } from './errors'

const COLUMNS = 'id, slug, name, source_type, is_active, product_count, last_updated_at'

export const storeRepository = {
  /**
   * Without an origin: every chain, browsable first. With one: only the chains
   * with a shop near it, browsable first and then nearest first (`stores_near`,
   * plan 0003). About a dozen rows either way; no pagination needed.
   */
  async list(origin: NearbyOrigin | null, signal?: AbortSignal): Promise<Store[]> {
    return origin ? listNear(origin, signal) : listAll(signal)
  },
}

async function listAll(signal?: AbortSignal): Promise<Store[]> {
  const request = supabase
    .from('store_summary')
    .select(COLUMNS)
    .order('product_count', { ascending: false })
    .order('name')

  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error) throw new RepositoryError('catalog.stores', error)

  return parseResponse(
    storeSchema.array(),
    (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      sourceType: row.source_type,
      isActive: row.is_active,
      productCount: row.product_count ?? 0,
      lastUpdatedAt: row.last_updated_at,
      nearestM: null,
    })),
    'catalog.stores',
  )
}

async function listNear(origin: NearbyOrigin, signal?: AbortSignal): Promise<Store[]> {
  // The radius is the server's default (25 km, the map's): one rule for both.
  const request = supabase.rpc('stores_near', {
    p_lat: origin.latitude,
    p_lng: origin.longitude,
  })

  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  if (error) throw new RepositoryError('catalog.storesNear', error)

  return parseResponse(
    storeSchema.array(),
    (data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      sourceType: row.source_type,
      isActive: row.is_active,
      productCount: row.product_count ?? 0,
      lastUpdatedAt: row.last_updated_at,
      nearestM: row.nearest_m,
    })),
    'catalog.storesNear',
  )
}
