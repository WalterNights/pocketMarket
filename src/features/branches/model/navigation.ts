import type { Coordinates } from './branch'

/**
 * Following a route on foot or by car. Pure: no React, no GPS, no network.
 *
 * Progress is computed ON THE PHONE by projecting each position onto the
 * route already drawn. Asking the routing service on every fix would burn the
 * shared daily quota in minutes (ADR-0007); a new route is requested only
 * when the user has clearly left this one.
 */

type LngLat = readonly [number, number]

/** Close enough to say "you are there". GPS error alone is ~5–20 m. */
export const ARRIVAL_RADIUS_M = 30
/** Further than this from the line counts as off the route. */
export const OFF_ROUTE_M = 50
/** Consecutive off-route fixes before rerouting: one bad fix is GPS noise. */
export const OFF_ROUTE_FIXES = 3
/** Never ask for a new route more often than this. */
export const MIN_REROUTE_INTERVAL_MS = 30_000

const EARTH_RADIUS_M = 6_371_000
const rad = (deg: number) => (deg * Math.PI) / 180

export function haversineM(a: Coordinates, b: Coordinates): number {
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

const toCoords = ([lng, lat]: LngLat): Coordinates => ({ latitude: lat, longitude: lng })

/**
 * Closest point on segment AB to P. A city-scale segment is a few hundred
 * metres, so a flat (equirectangular) projection around P is exact enough.
 */
function projectOnSegment(
  p: Coordinates,
  a: Coordinates,
  b: Coordinates,
): { point: Coordinates; t: number } {
  const kx = Math.cos(rad(p.latitude))
  const ax = a.longitude * kx
  const ay = a.latitude
  const bx = b.longitude * kx
  const by = b.latitude
  const px = p.longitude * kx
  const py = p.latitude

  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t =
    lengthSq === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSq))

  return {
    t,
    point: {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    },
  }
}

/** Two segments this close to the user are a tie; the earlier one wins. */
const SEGMENT_TIE_M = 10

/**
 * A route ready to be followed: its line plus, per vertex, the length still
 * to go from there to the end. Built once per route, not once per GPS fix.
 */
export type PreparedRoute = {
  coordinates: readonly LngLat[]
  /** tail[i] = metres along the line from vertex i to the last vertex. */
  tail: readonly number[]
  distanceM: number
  durationS: number
}

export function prepareRoute(route: {
  coordinates: readonly LngLat[]
  distanceM: number
  durationS: number
}): PreparedRoute {
  const { coordinates } = route
  const tail = new Array<number>(coordinates.length).fill(0)
  for (let i = coordinates.length - 2; i >= 0; i -= 1) {
    const from = coordinates[i]
    const to = coordinates[i + 1]
    tail[i] = (tail[i + 1] ?? 0) + (from && to ? haversineM(toCoords(from), toCoords(to)) : 0)
  }
  return { coordinates, tail, distanceM: route.distanceM, durationS: route.durationS }
}

export type RouteProgress = {
  /** Metres still to walk or drive, along the route. */
  remainingM: number
  /** Estimated seconds left, scaled from the route's own duration. */
  remainingS: number
  /** How far the user is from the route line. */
  offRouteM: number
  /** Segment the user was matched to; pass it back on the next fix. */
  segment: number
}

type Match = { offRouteM: number; remainingM: number; segment: number }

/**
 * Nearest segment at or after `from`. Near-ties go to the earlier segment so
 * a route that doubles back along the same street does not jump to its
 * return leg while the user is still on the way out.
 */
function nearestSegment(position: Coordinates, route: PreparedRoute, from: number): Match {
  const { coordinates, tail } = route
  let best: Match = { offRouteM: Infinity, remainingM: 0, segment: from }

  for (let i = Math.max(0, from); i < coordinates.length - 1; i += 1) {
    const a = coordinates[i]
    const b = coordinates[i + 1]
    if (!a || !b) continue
    const { point } = projectOnSegment(position, toCoords(a), toCoords(b))
    const offRouteM = haversineM(position, point)
    // A later segment takes over only when it is clearly closer.
    if (offRouteM < best.offRouteM - SEGMENT_TIE_M) {
      best = {
        offRouteM,
        remainingM: haversineM(point, toCoords(b)) + (tail[i + 1] ?? 0),
        segment: i,
      }
    }
  }
  return best
}

/**
 * Where the user is along the route. Only segments at or after
 * `previousSegment` are considered, so progress never jumps backwards to a
 * part of the route already walked — unless the user is clearly off that
 * stretch, in which case the whole route is searched again (they may have
 * turned back). The remaining time keeps the routing service's pace (its
 * duration ÷ its distance) instead of assuming a speed.
 */
export function progressAlong(
  position: Coordinates,
  route: PreparedRoute,
  previousSegment = 0,
): RouteProgress {
  let best = nearestSegment(position, route, previousSegment)
  if (previousSegment > 0 && best.offRouteM > OFF_ROUTE_M) {
    const anywhere = nearestSegment(position, route, 0)
    if (anywhere.offRouteM < best.offRouteM) best = anywhere
  }

  if (!Number.isFinite(best.offRouteM)) {
    const last = route.coordinates[route.coordinates.length - 1]
    const straight = last ? haversineM(position, toCoords(last)) : 0
    best = { offRouteM: straight, remainingM: straight, segment: 0 }
  }

  const pace = route.distanceM > 0 ? route.durationS / route.distanceM : 0
  return {
    remainingM: Math.round(best.remainingM),
    remainingS: Math.round(best.remainingM * pace),
    offRouteM: Math.round(best.offRouteM),
    segment: best.segment,
  }
}

/**
 * Arrival is measured against the shop itself, not the end of the route: it
 * must work while a reroute is pending or after one failed.
 */
export function hasArrived(position: Coordinates, destination: Coordinates): boolean {
  return haversineM(position, destination) <= ARRIVAL_RADIUS_M
}

/**
 * Should a new route be requested? Only after several consecutive fixes off
 * the line, and never more often than MIN_REROUTE_INTERVAL_MS.
 */
export function shouldReroute(
  recentOffRouteM: readonly number[],
  lastRerouteAt: number,
  now: number,
): boolean {
  if (now - lastRerouteAt < MIN_REROUTE_INTERVAL_MS) return false
  const lastFixes = recentOffRouteM.slice(-OFF_ROUTE_FIXES)
  return lastFixes.length === OFF_ROUTE_FIXES && lastFixes.every((m) => m > OFF_ROUTE_M)
}
