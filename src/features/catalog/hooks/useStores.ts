import { useQuery } from '@tanstack/react-query'

import { catalogKeys } from '../api/keys'
import { storeRepository } from '../api/store-repository'

/** Stores change rarely: a long staleTime avoids refetching on every visit. */
const ONE_HOUR = 60 * 60 * 1000

export function useStores() {
  return useQuery({
    queryKey: catalogKeys.stores(),
    queryFn: ({ signal }) => storeRepository.list(signal),
    staleTime: ONE_HOUR,
  })
}
