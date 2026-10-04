import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

import { location } from '@/shared/lib/location'

import type { Coordinates } from '../model/branch'
import {
  hasArrived,
  prepareRoute,
  progressAlong,
  shouldReroute,
  type PreparedRoute,
  type RouteProgress,
} from '../model/navigation'
import type { Route } from '../model/route'

/** Off-route distances kept to decide on rerouting; a handful is enough. */
const HISTORY = 5

/**
 * The latest fix of a trip, with the progress computed for it in the GPS
 * callback. Tagged with its trip so the next trip never starts from the
 * previous one's position.
 */
type Sample = {
  trip: string
  coords: Coordinates
  route: PreparedRoute | null
  progress: RouteProgress | null
}

/**
 * iOS reports 'inactive' for a pulled-down notification centre or an
 * incoming call: the app is still on screen. Only 'background' stops the GPS.
 */
const isForeground = (state: AppStateStatus) => state !== 'background'

/**
 * Follows the user during the trip identified by `tripKey` (null = not
 * navigating). The GPS subscription exists only while navigating, in the
 * foreground and before arrival: background stops it (no background location,
 * ADR-0007), arriving stops it for good.
 *
 * Arrival is measured against `destination` — the shop — so it works with no
 * route at all. Progress along `route` is computed once per fix, in the GPS
 * callback; `onReroute` is called — rarely, see shouldReroute — when the user
 * has clearly left the line.
 */
export function useLiveNavigation(
  tripKey: string | null,
  destination: Coordinates | null,
  route: Route | undefined,
  onReroute: (from: Coordinates) => void,
) {
  // The cumulative lengths are built once per route, not once per fix.
  const prepared = useMemo(() => (route ? prepareRoute(route) : null), [route])

  const [sample, setSample] = useState<Sample | null>(null)
  const [foreground, setForeground] = useState(isForeground(AppState.currentState))
  // Arrival is remembered per trip, so it outlives the GPS it switches off and
  // a new trip starts clean without resetting anything in an effect.
  const [arrivedTrip, setArrivedTrip] = useState<string | null>(null)

  const offRouteHistory = useRef<number[]>([])
  const lastRerouteAt = useRef(0)
  // The segment matched on the last fix, for the route it was matched on.
  const segment = useRef<{ route: PreparedRoute | null; index: number }>({
    route: null,
    index: 0,
  })
  // Latest values for the GPS callback, without restarting the GPS when they change.
  const latest = useRef({ prepared, onReroute, tripKey, destination })
  useEffect(() => {
    latest.current = { prepared, onReroute, tripKey, destination }
  })

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(isForeground(state)),
    )
    return () => subscription.remove()
  }, [])

  const arrived = tripKey !== null && arrivedTrip === tripKey
  const tracking = tripKey !== null && foreground && !arrived

  useEffect(() => {
    if (!tracking) return

    let stop: (() => void) | null = null
    let cancelled = false
    offRouteHistory.current = []

    void location
      .watch((fix) => {
        const {
          prepared: current,
          onReroute: reroute,
          tripKey: trip,
          destination: shop,
        } = latest.current
        if (trip === null) return

        if (shop !== null && hasArrived(fix, shop)) {
          setSample({ trip, coords: fix, route: current, progress: null })
          setArrivedTrip(trip)
          return
        }
        if (current === null) {
          setSample({ trip, coords: fix, route: null, progress: null })
          return
        }

        if (segment.current.route !== current) segment.current = { route: current, index: 0 }
        const progress = progressAlong(fix, current, segment.current.index)
        segment.current.index = progress.segment
        setSample({ trip, coords: fix, route: current, progress })

        offRouteHistory.current = [...offRouteHistory.current, progress.offRouteM].slice(-HISTORY)
        const now = Date.now()
        if (shouldReroute(offRouteHistory.current, lastRerouteAt.current, now)) {
          lastRerouteAt.current = now
          offRouteHistory.current = []
          reroute(fix)
        }
      })
      .then((unsubscribe) => {
        if (cancelled) unsubscribe()
        else stop = unsubscribe
      })
      .catch((cause: unknown) => console.warn('Could not follow the device position', cause))

    return () => {
      cancelled = true
      stop?.()
    }
  }, [tracking])

  // Only this trip's fix counts: a previous trip's position never leaks in.
  const current = sample !== null && sample.trip === tripKey ? sample : null

  // Normally the progress stored with the fix. Recomputed only when a new
  // route arrived after the last fix — once per reroute, not once per render.
  const progress = useMemo(() => {
    if (current === null || prepared === null) return null
    if (current.route === prepared) return current.progress
    return progressAlong(current.coords, prepared)
  }, [current, prepared])

  return {
    position: current?.coords ?? null,
    progress,
    arrived,
  }
}
