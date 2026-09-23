import { supabase } from '@/shared/lib/supabase'

import { storeCategorySchema, type StoreCategory } from '../model/category'
import { RepositoryError } from './product-repository'

const COLUMNS = 'category_id, category_slug, category_name, product_count, sort_order'

export const categoryRepository = {
  /**
   * Categories that actually hold products in this store, in the taxonomy's
   * own order. Empty categories never come back — the view excludes them.
   */
  async listByStore(storeSlug: string, signal?: AbortSignal): Promise<StoreCategory[]> {
    const base = supabase
      .from('store_category_summary')
      .select(COLUMNS)
      .eq('store_slug', storeSlug)
      .order('sort_order')

    const { data, error } = await (signal ? base.abortSignal(signal) : base)
    if (error) throw new RepositoryError('catalog.categories', error)

    return storeCategorySchema.array().parse(
      (data ?? []).map((row) => ({
        id: row.category_id,
        slug: row.category_slug,
        name: row.category_name,
        productCount: row.product_count,
      })),
    )
  },
}
