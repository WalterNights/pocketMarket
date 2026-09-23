import { useQuery } from '@tanstack/react-query'

import { catalogKeys } from '../api/keys'
import { productRepository } from '../api/product-repository'

/**
 * Single product. Usually served straight from the cache the search already
 * filled, so the sheet opens with data instead of a spinner.
 */
export function useProduct(id: string) {
  return useQuery({
    queryKey: catalogKeys.detail(id),
    queryFn: ({ signal }) => productRepository.byId(id, signal),
    enabled: id.length > 0,
  })
}
