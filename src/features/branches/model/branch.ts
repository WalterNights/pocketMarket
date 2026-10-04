import { z } from 'zod'

/**
 * A physical shop of one of the chains, as `nearest_branches` returns it.
 * Pure: no React, no network, no location API (rule 3).
 */
export const branchSchema = z.object({
  id: z.string().uuid(),
  storeSlug: z.string().min(1),
  storeName: z.string().min(1),
  /** The chain has a catalogue today; otherwise the map says "precios próximamente". */
  hasPrices: z.boolean(),
  name: z.string().min(1),
  address: z.string().nullable(),
  city: z.string().nullable(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  distanceM: z.number().int().nonnegative(),
})

export type Branch = z.infer<typeof branchSchema>

export type Coordinates = {
  latitude: number
  longitude: number
}

/**
 * "850 m" up close, "1,2 km" further out, "25 km" far away. Metres are rounded
 * to tens — "843 m" claims a precision a phone's location does not have.
 */
export function distanceLabel(distanceM: number): string {
  const metres = Math.max(10, Math.round(distanceM / 10) * 10)
  // 995 m rounds to "1000 m", which reads worse than the "1,0 km" it is.
  if (metres < 1000) return `${metres} m`

  const km = distanceM / 1000
  return km < 10 ? `${km.toFixed(1).replace('.', ',')} km` : `${Math.round(km)} km`
}

/**
 * Where to look when the user does not share their location: the capitals of
 * the regions the app already knows (table `region`). Not a guess about the
 * user — a starting point they choose.
 */
export const CITY_CENTRES: Record<string, Coordinates & { name: string }> = {
  BOG: { name: 'Bogotá', latitude: 4.711, longitude: -74.0721 },
  MDE: { name: 'Medellín', latitude: 6.2442, longitude: -75.5812 },
  CLO: { name: 'Cali', latitude: 3.4516, longitude: -76.532 },
  BAQ: { name: 'Barranquilla', latitude: 10.9685, longitude: -74.7813 },
  CTG: { name: 'Cartagena', latitude: 10.391, longitude: -75.4794 },
  BGA: { name: 'Bucaramanga', latitude: 7.1193, longitude: -73.1227 },
}
