import type { FeatureCollection, LineString } from 'geojson'
import { z } from 'zod'

/**
 * A walking or driving route from the user to a shop. Pure: no React, no
 * network. The geometry comes from the `route` Edge Function (ADR-0007).
 */

export const TRAVEL_MODES = ['foot', 'car'] as const
export type TravelMode = (typeof TRAVEL_MODES)[number]

/** Below this a shop is a walk; above it, most people take the car or a bus. */
export const WALKING_LIMIT_M = 1500

export function defaultMode(distanceM: number): TravelMode {
  return distanceM < WALKING_LIMIT_M ? 'foot' : 'car'
}

export const routeSchema = z.object({
  distanceM: z.number().int().nonnegative(),
  durationS: z.number().int().nonnegative(),
  // GeoJSON order: [longitude, latitude]. A route has at least two points.
  coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
})

export type Route = z.infer<typeof routeSchema>

/** "4 min", "35 min", "1 h 10 min". Never "0 min": a route is at least a minute. */
export function durationLabel(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export const MODE_LABELS: Record<TravelMode, string> = {
  foot: 'A pie',
  car: 'En vehículo',
}

/** "a pie" / "en vehículo", for sentences like "8 min a pie". */
export const MODE_PHRASES: Record<TravelMode, string> = {
  foot: 'a pie',
  car: 'en vehículo',
}

/**
 * The `error` field of the function's response, plus `network` for a request
 * that never got an answer (offline, timeout). Anything else is unknown.
 */
export const ROUTE_ERROR_CODES = [
  'invalid',
  'out_of_range',
  'no_route',
  'quota',
  'unavailable',
  'upstream',
  'network',
] as const
export type RouteErrorCode = (typeof ROUTE_ERROR_CODES)[number]
export const routeErrorCodeSchema = z.enum(ROUTE_ERROR_CODES)

/**
 * Not worth asking again automatically: the answer would be the same, or the
 * provider is down and each try spends shared quota. `upstream` and `network`
 * are transient and get one retry; the user can always retry by hand.
 */
export const NON_RETRYABLE_ROUTE_ERRORS: ReadonlySet<RouteErrorCode> = new Set([
  'invalid',
  'out_of_range',
  'no_route',
  'quota',
  'unavailable',
])

const ROUTE_MESSAGES: Record<RouteErrorCode, string> = {
  invalid: 'No pudimos calcular la ruta.',
  no_route: 'No encontramos un camino hasta esta tienda.',
  out_of_range: 'Esta tienda está demasiado lejos para trazar la ruta.',
  quota: 'Se agotaron las rutas de hoy. Vuelve a intentarlo mañana.',
  unavailable: 'El servicio de rutas no está disponible ahora.',
  upstream: 'El servicio de rutas falló. Vuelve a intentarlo.',
  network: 'Sin conexión: no pudimos calcular la ruta.',
}

export function routeErrorMessage(code: RouteErrorCode | undefined): string {
  return code === undefined ? 'No pudimos calcular la ruta.' : ROUTE_MESSAGES[code]
}

/** [west, south, east, north] of the route line, to frame it on the map. */
export function routeBounds(
  coordinates: readonly (readonly [number, number])[],
): [west: number, south: number, east: number, north: number] {
  const lngs = coordinates.map(([lng]) => lng)
  const lats = coordinates.map(([, lat]) => lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

/** The route as a single GeoJSON line for the map. */
export function routeToGeoJSON(
  coordinates: readonly (readonly [number, number])[],
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coordinates.map(([lng, lat]) => [lng, lat]) },
        properties: {},
      },
    ],
  }
}
