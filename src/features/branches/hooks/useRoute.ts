import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { branchKeys } from '../api/keys'
import { RouteError, routeRepository } from '../api/route-repository'
import type { Branch, Coordinates } from '../model/branch'
import type { NavigationState } from '../model/navigation-view'
import { NON_RETRYABLE_ROUTE_ERRORS, type Route, type TravelMode } from '../model/route'

/** Streets do not move in ten minutes; asking again would spend the daily quota. */
const TEN_MINUTES = 10 * 60_000
/** One retry for transient failures; the user has a button for the rest. */
const MAX_RETRIES = 1

/** A trip's request: `from` moves only when the route is recalculated. */
export type RouteRequest = { key: string; branch: Branch; mode: TravelMode; from: Coordinates }

/**
 * The route of the trip in progress. Only with the device's own position: a
 * route from "the centre of Bogotá" means nothing to the person holding the
 * phone.
 *
 * `route` is the trip's LAST GOOD route: while a reroute is fetched, and if it
 * fails, the previous line keeps being drawn and followed instead of blanking
 * the map under someone who is walking. It is remembered per trip, so another
 * shop's route can never stand in for this one.
 */
export function useRoute(request: RouteRequest | null) {
  const query = useQuery({
    queryKey: request
      ? branchKeys.route(request.from, request.branch.id, request.mode)
      : branchKeys.routeIdle(),
    queryFn: ({ signal }) => {
      if (request === null) return Promise.reject(new RouteError(undefined, null))
      return routeRepository.between(request.from, request.branch, request.mode, signal)
    },
    enabled: request !== null,
    staleTime: TEN_MINUTES,
    retry: (failures, error) =>
      failures < MAX_RETRIES &&
      !(
        error instanceof RouteError &&
        error.code !== undefined &&
        NON_RETRYABLE_ROUTE_ERRORS.has(error.code)
      ),
  })

  const tripKey = request?.key ?? null
  const [kept, setKept] = useState<{ trip: string; route: Route } | null>(null)
  // Adjusting state while rendering (react.dev, "storing information from
  // previous renders"): no effect, no extra frame with a blank line.
  if (
    tripKey !== null &&
    query.data !== undefined &&
    (kept?.trip !== tripKey || kept.route !== query.data)
  ) {
    setKept({ trip: tripKey, route: query.data })
  }

  const route = query.data ?? (kept !== null && kept.trip === tripKey ? kept.route : undefined)
  const failure: NavigationState['failure'] =
    query.isError && !query.isFetching
      ? { code: query.error instanceof RouteError ? query.error.code : undefined }
      : null

  return {
    route,
    /** A newer route is on its way while the previous one is drawn. */
    rerouting: query.isFetching && query.data === undefined && route !== undefined,
    failure,
    retry: query.refetch,
  }
}
