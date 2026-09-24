import { useQuery } from '@tanstack/react-query'

import { catalogKeys } from '../api/keys'
import { productRepository } from '../api/product-repository'

/**
 * The products of a saved list, with today's prices. The key sorts the ids, so
 * the same set in another order is served from the same cache entry.
 */
export function useProductsByIds(ids: readonly string[]) {
  return useQuery({
    queryKey: catalogKeys.byIds(ids),
    queryFn: ({ signal }) => productRepository.byIds(ids, signal),
    enabled: ids.length > 0,
  })
}
