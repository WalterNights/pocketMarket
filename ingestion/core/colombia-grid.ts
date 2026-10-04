/**
 * Points to query sources that answer "what is near this coordinate" (VTEX
 * pickup points, Dollarcity's locator). Pure data plus one pure function.
 *
 * Town centres cover the country; the big metros get a dense grid on top,
 * because a single point there hits the source's result cap (D1 returns at
 * most 300 per point, all within ~10 km of central Bogotá).
 */

export type GridPoint = { label: string; latitude: number; longitude: number }

export const CITY_POINTS: readonly GridPoint[] = [
  { label: 'Bogotá', latitude: 4.711, longitude: -74.072 },
  { label: 'Medellín', latitude: 6.244, longitude: -75.581 },
  { label: 'Cali', latitude: 3.452, longitude: -76.532 },
  { label: 'Barranquilla', latitude: 10.969, longitude: -74.781 },
  { label: 'Cartagena', latitude: 10.391, longitude: -75.479 },
  { label: 'Bucaramanga', latitude: 7.119, longitude: -73.123 },
  { label: 'Cúcuta', latitude: 7.894, longitude: -72.507 },
  { label: 'Pereira', latitude: 4.813, longitude: -75.696 },
  { label: 'Manizales', latitude: 5.07, longitude: -75.514 },
  { label: 'Armenia', latitude: 4.533, longitude: -75.681 },
  { label: 'Ibagué', latitude: 4.439, longitude: -75.232 },
  { label: 'Villavicencio', latitude: 4.142, longitude: -73.626 },
  { label: 'Santa Marta', latitude: 11.241, longitude: -74.199 },
  { label: 'Neiva', latitude: 2.927, longitude: -75.282 },
  { label: 'Pasto', latitude: 1.213, longitude: -77.281 },
  { label: 'Montería', latitude: 8.748, longitude: -75.881 },
  { label: 'Valledupar', latitude: 10.463, longitude: -73.253 },
  { label: 'Sincelejo', latitude: 9.304, longitude: -75.398 },
  { label: 'Popayán', latitude: 2.444, longitude: -76.614 },
  { label: 'Tunja', latitude: 5.535, longitude: -73.367 },
  { label: 'Riohacha', latitude: 11.544, longitude: -72.907 },
  { label: 'Florencia', latitude: 1.614, longitude: -75.606 },
  { label: 'Yopal', latitude: 5.337, longitude: -72.395 },
  { label: 'Quibdó', latitude: 5.692, longitude: -76.658 },
  { label: 'Girardot', latitude: 4.304, longitude: -74.804 },
  { label: 'Sogamoso', latitude: 5.715, longitude: -72.934 },
  { label: 'Duitama', latitude: 5.827, longitude: -73.033 },
  { label: 'Barrancabermeja', latitude: 7.065, longitude: -73.854 },
  { label: 'Tuluá', latitude: 4.084, longitude: -76.195 },
  { label: 'Buenaventura', latitude: 3.882, longitude: -77.031 },
  { label: 'Palmira', latitude: 3.539, longitude: -76.303 },
  { label: 'Cartago', latitude: 4.746, longitude: -75.912 },
  { label: 'Apartadó', latitude: 7.882, longitude: -76.625 },
  { label: 'Rionegro', latitude: 6.155, longitude: -75.374 },
  { label: 'Zipaquirá', latitude: 5.022, longitude: -74.004 },
  { label: 'Fusagasugá', latitude: 4.337, longitude: -74.364 },
  { label: 'Facatativá', latitude: 4.814, longitude: -74.354 },
  { label: 'Soacha', latitude: 4.579, longitude: -74.217 },
  { label: 'Ocaña', latitude: 8.237, longitude: -73.356 },
  { label: 'Magangué', latitude: 9.241, longitude: -74.754 },
  { label: 'Arauca', latitude: 7.084, longitude: -70.759 },
  { label: 'San Andrés', latitude: 12.584, longitude: -81.701 },
  { label: 'Leticia', latitude: -4.215, longitude: -69.94 },
  { label: 'Mocoa', latitude: 1.152, longitude: -76.647 },
  { label: 'Ipiales', latitude: 0.83, longitude: -77.644 },
  { label: 'Pitalito', latitude: 1.853, longitude: -76.051 },
  { label: 'Aguachica', latitude: 8.309, longitude: -73.616 },
  { label: 'Caucasia', latitude: 7.983, longitude: -75.198 },
  { label: 'Turbo', latitude: 8.093, longitude: -76.728 },
  { label: 'Lorica', latitude: 9.236, longitude: -75.814 },
  { label: 'Espinal', latitude: 4.149, longitude: -74.884 },
  { label: 'La Dorada', latitude: 5.451, longitude: -74.664 },
  { label: 'Puerto Boyacá', latitude: 5.976, longitude: -74.587 },
  { label: 'Chiquinquirá', latitude: 5.617, longitude: -73.818 },
  { label: 'Garzón', latitude: 2.196, longitude: -75.627 },
  { label: 'Tumaco', latitude: 1.807, longitude: -78.765 },
  { label: 'Maicao', latitude: 11.378, longitude: -72.24 },
  { label: 'Ciénaga', latitude: 11.007, longitude: -74.247 },
  { label: 'El Banco', latitude: 9.0, longitude: -73.975 },
  { label: 'Corozal', latitude: 9.318, longitude: -75.293 },
  { label: 'San José del Guaviare', latitude: 2.57, longitude: -72.641 },
  { label: 'Puerto Asís', latitude: 0.505, longitude: -76.495 },
]

/** Metros where one point is not enough: centre, radius and grid step, in km. */
export const METRO_AREAS: readonly (GridPoint & { radiusKm: number; stepKm: number })[] = [
  { label: 'Bogotá', latitude: 4.65, longitude: -74.1, radiusKm: 20, stepKm: 6 },
  { label: 'Medellín', latitude: 6.25, longitude: -75.58, radiusKm: 16, stepKm: 6 },
  { label: 'Cali', latitude: 3.43, longitude: -76.52, radiusKm: 12, stepKm: 6 },
  { label: 'Barranquilla', latitude: 10.97, longitude: -74.8, radiusKm: 10, stepKm: 6 },
]

const KM_PER_DEGREE = 111.32

/**
 * Points of a square grid clipped to a circle. Longitude degrees shrink with
 * latitude, so the step is converted at the area's own latitude.
 */
export function gridAround(area: GridPoint & { radiusKm: number; stepKm: number }): GridPoint[] {
  const latStep = area.stepKm / KM_PER_DEGREE
  const lngStep = area.stepKm / (KM_PER_DEGREE * Math.cos((area.latitude * Math.PI) / 180))
  const steps = Math.floor(area.radiusKm / area.stepKm)
  const points: GridPoint[] = []

  for (let i = -steps; i <= steps; i += 1) {
    for (let j = -steps; j <= steps; j += 1) {
      if (Math.hypot(i, j) * area.stepKm > area.radiusKm) continue
      points.push({
        label: `${area.label} ${i},${j}`,
        latitude: area.latitude + i * latStep,
        longitude: area.longitude + j * lngStep,
      })
    }
  }
  return points
}

/** Every town centre plus the dense metro grids. */
export function nationalGrid(): GridPoint[] {
  return [...CITY_POINTS, ...METRO_AREAS.flatMap(gridAround)]
}
