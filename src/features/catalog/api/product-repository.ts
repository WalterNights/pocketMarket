import { supabase } from '@/shared/lib/supabase'

import { productSchema, type Product } from '../model/product'
import type { ProductSearchFilters } from './keys'

/** Typed error so callers never have to unpack Supabase's `{ data, error }`. */
export class RepositoryError extends Error {
  constructor(
    readonly operation: string,
    override readonly cause: unknown,
  ) {
    super(`Fallo en ${operation}`)
    this.name = 'RepositoryError'
  }
}

export const PAGE_SIZE = 20

/**
 * Explicit column list, never select('*'): every extra column is the user's
 * mobile data and battery (rules/supabase.md).
 *
 * `catalog_product` resolves the current price for the caller's region — see
 * the view in supabase/migrations. Always paginated: the view runs price_for()
 * per returned row.
 */
const COLUMNS =
  'id, name, brand, store_slug, store_name, category_slug, unit_kind, unit_value, unit_measure, image_url, is_available, price_cop'

type ProductRow = {
  id: string | null
  name: string | null
  brand: string | null
  store_slug: string | null
  store_name: string | null
  category_slug: string | null
  unit_kind: string | null
  unit_value: number | string | null
  unit_measure: string | null
  image_url: string | null
  is_available: boolean | null
  price_cop: number | null
}

/**
 * Row → schema input. Not typed as Product on purpose: productSchema.parse is
 * what turns it into one, and rejects a row that does not fit.
 */
function toProductInput(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    storeSlug: row.store_slug,
    storeName: row.store_name,
    categorySlug: row.category_slug,
    unitKind: row.unit_kind,
    unitValue: row.unit_value === null ? null : Number(row.unit_value),
    unitMeasure: row.unit_measure,
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    priceCop: row.price_cop,
  }
}

type SearchParams = ProductSearchFilters & {
  offset: number
  signal?: AbortSignal
}

export const productRepository = {
  async search({
    query,
    storeSlug,
    categorySlug,
    offset,
    signal,
  }: SearchParams): Promise<Product[]> {
    let request = supabase
      .from('catalog_product')
      .select(COLUMNS)
      .eq('is_available', true)
      .not('price_cop', 'is', null)
      .order('name')
      .range(offset, offset + PAGE_SIZE - 1)

    const trimmed = query.trim()
    if (trimmed.length > 0) {
      // Accent- and case-insensitive: the index is a tsvector built with
      // immutable_unaccent, so "platano" finds "plátano".
      request = request.textSearch('search_vector', trimmed, {
        type: 'websearch',
        config: 'spanish',
      })
    }
    if (storeSlug) request = request.eq('store_slug', storeSlug)
    if (categorySlug) request = request.eq('category_slug', categorySlug)

    const { data, error } = await (signal ? request.abortSignal(signal) : request)
    if (error) throw new RepositoryError('catalog.search', error)

    // Validate at the boundary: a migration applied without regenerating types
    // makes TypeScript confidently wrong about what actually arrived.
    return productSchema.array().parse((data ?? []).map(toProductInput))
  },

  async byId(id: string, signal?: AbortSignal): Promise<Product> {
    // abortSignal must come before single(): single() returns a builder that
    // no longer exposes it.
    const base = supabase.from('catalog_product').select(COLUMNS).eq('id', id)
    const request = signal ? base.abortSignal(signal) : base

    const { data, error } = await request.single()
    if (error) throw new RepositoryError('catalog.byId', error)

    return productSchema.parse(toProductInput(data))
  },

  /**
   * Several products at once, for a saved list. A product that lost its price
   * is left out rather than failing the whole list: the caller shows it with
   * the price it had when it was added.
   */
  async byIds(ids: readonly string[], signal?: AbortSignal): Promise<Product[]> {
    if (ids.length === 0) return []

    const base = supabase
      .from('catalog_product')
      .select(COLUMNS)
      .in('id', [...ids])
      .not('price_cop', 'is', null)
    const { data, error } = await (signal ? base.abortSignal(signal) : base)
    if (error) throw new RepositoryError('catalog.byIds', error)

    return productSchema.array().parse((data ?? []).map(toProductInput))
  },
}
