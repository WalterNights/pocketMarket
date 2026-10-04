import { useQuery } from '@tanstack/react-query'

import { branchKeys } from '../api/keys'
import { branchRepository } from '../api/branch-repository'
import type { Coordinates } from '../model/branch'

/** Branches change monthly, not hourly: a long staleTime spares the data plan. */
const ONE_DAY = 24 * 60 * 60_000

export function useNearestBranches(origin: Coordinates | null) {
  return useQuery({
    queryKey: origin ? branchKeys.nearest(origin) : branchKeys.nearestIdle(),
    queryFn: ({ signal }) => {
      // `enabled` keeps this from running without an origin; the guard makes
      // that explicit for the type checker instead of asserting it.
      if (origin === null) return Promise.resolve([])
      return branchRepository.nearest(origin, signal)
    },
    enabled: origin !== null,
    staleTime: ONE_DAY,
  })
}
