/**
 * Query key factory. Hand-written keys produce invalidations that do not
 * invalidate; literal arrays inline are a review finding (03-patterns.md).
 *
 * `invalidateQueries({ queryKey: catalogKeys.searches() })` drops every search
 * result and no product detail.
 */
export type ProductSearchFilters = {
  query: string
  storeSlug?: string
  categorySlug?: string
}

export const catalogKeys = {
  all: ['catalog'] as const,
  stores: () => [...catalogKeys.all, 'stores'] as const,
  categories: (storeSlug: string) => [...catalogKeys.all, 'categories', storeSlug] as const,
  searches: () => [...catalogKeys.all, 'search'] as const,
  search: (filters: ProductSearchFilters) => [...catalogKeys.searches(), filters] as const,
  details: () => [...catalogKeys.all, 'detail'] as const,
  detail: (id: string) => [...catalogKeys.details(), id] as const,
  byIds: (ids: readonly string[]) => [...catalogKeys.all, 'by-ids', [...ids].sort()] as const,
}
