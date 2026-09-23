import { useQuery } from '@tanstack/react-query'

import { categoryRepository } from '../api/category-repository'
import { catalogKeys } from '../api/keys'

/** Categories change only when the catalogue is re-ingested: cache generously. */
const ONE_HOUR = 60 * 60 * 1000

export function useStoreCategories(storeSlug: string) {
  return useQuery({
    queryKey: catalogKeys.categories(storeSlug),
    queryFn: ({ signal }) => categoryRepository.listByStore(storeSlug, signal),
    staleTime: ONE_HOUR,
    enabled: storeSlug.length > 0,
  })
}
