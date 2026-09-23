import { supabase } from '@/shared/lib/supabase'

import { storeSchema, type Store } from '../model/store'
import { RepositoryError } from './product-repository'

const COLUMNS = 'id, slug, name, source_type, is_active, product_count, last_updated_at'

export const storeRepository = {
  /** All stores, browsable first. Four rows today; no pagination needed. */
  async list(signal?: AbortSignal): Promise<Store[]> {
    const request = supabase
      .from('store_summary')
      .select(COLUMNS)
      .order('product_count', { ascending: false })
      .order('name')

    const { data, error } = await (signal ? request.abortSignal(signal) : request)
    if (error) throw new RepositoryError('catalog.stores', error)

    return storeSchema.array().parse(
      (data ?? []).map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        sourceType: row.source_type,
        isActive: row.is_active,
        productCount: row.product_count ?? 0,
        lastUpdatedAt: row.last_updated_at,
      })),
    )
  },
}
