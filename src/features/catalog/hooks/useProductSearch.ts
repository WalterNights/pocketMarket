import { useInfiniteQuery } from '@tanstack/react-query'

import { catalogKeys, type ProductSearchFilters } from '../api/keys'
import { PAGE_SIZE, productRepository } from '../api/product-repository'

/**
 * Facade over the data layer. Components consume this and never learn that
 * Supabase exists — if we add a local SQLite cache later, only this changes.
 */
export function useProductSearch(filters: ProductSearchFilters) {
  return useInfiniteQuery({
    queryKey: catalogKeys.search(filters),
    queryFn: ({ pageParam, signal }) =>
      productRepository.search({ ...filters, offset: pageParam, signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.flat().length,
  })
}
