import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { catalogKeys } from '../api/keys'
import { storeRepository } from '../api/store-repository'
import { roundOrigin, type NearbyOrigin } from '../model/store'

/** Stores change rarely: a long staleTime avoids refetching on every visit. */
const ONE_HOUR = 60 * 60 * 1000

/**
 * The store list: near `origin` when there is one, every chain otherwise. The
 * origin is snapped to ~110 m before it reaches the key or the request, so GPS
 * jitter does not refetch and the distances stay honest to 100 m.
 */
export function useStores(origin: NearbyOrigin | null = null) {
  const latitude = origin?.latitude
  const longitude = origin?.longitude
  const near = useMemo(
    () =>
      latitude === undefined || longitude === undefined
        ? null
        : roundOrigin({ latitude, longitude }),
    [latitude, longitude],
  )

  return useQuery({
    queryKey: catalogKeys.storeList(near),
    queryFn: ({ signal }) => storeRepository.list(near, signal),
    staleTime: ONE_HOUR,
  })
}
