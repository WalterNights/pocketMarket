import {
  isInColombia,
  okBranch,
  tidyName,
  type BranchAdapter,
  type BranchNormalizeResult,
  type RawBranch,
} from '../core/branch-types'
import { normalise } from '../core/classify'
import { CITY_POINTS, nationalGrid, type GridPoint } from '../core/colombia-grid'
import { readPickupPoint, sweepPickupPoints } from './vtex-pickup-points'

/**
 * Olímpica's shops, from VTEX pickup points (researched 2026-10-04).
 *
 * Coverage is PARTIAL: only shops with in-store pickup are published (~80 of
 * the chain's ~300; 12 in Barranquilla). The store locator on
 * /nuestras-tiendas reads a private Master Data entity (403 without a
 * session) with no coordinates, so there is nothing better to read.
 *
 * Each point answers only ~20 km around it, hence the national grid.
 *
 * Shops have ids `olimpicaswl<N>_<N>` and names `<N>-<City>`. Everything else
 * (`..._1405pp` "SAO", `..._P1023` "Pickup 1023", Flash dark stores, uuids)
 * is a pickup counter, skipped.
 *
 * The source copy-pastes records: 1433-Villavicencio carries the coordinates
 * of a Bogotá shop, 1385-Pitalito those of Espinal. When the town in the
 * name is one we know and the pin is far from it, the pin is wrong and the
 * shop is skipped rather than drawn in the wrong city.
 */

const BASE_URL = 'https://www.olimpica.com'
const SHOP_ID = /^olimpicaswl(\d+)_(\d+)$/
const SHOP_NAME = /^\s*(\d+)\s*-\s*(.+)$/

/** Beyond this from its own town's centre, a pin belongs to another town. */
export const MAX_KM_FROM_TOWN = 30

/**
 * Towns Olímpica names that CITY_POINTS lacks. Used only to sanity-check a
 * pin against the town in its name (30 km tolerance), never written.
 */
const EXTRA_TOWNS: readonly GridPoint[] = [
  { label: 'Cajicá', latitude: 4.918, longitude: -74.028 },
  { label: 'Chía', latitude: 4.861, longitude: -74.058 },
  { label: 'Cota', latitude: 4.809, longitude: -74.098 },
  { label: 'Funza', latitude: 4.716, longitude: -74.211 },
  { label: 'Madrid', latitude: 4.733, longitude: -74.264 },
  { label: 'Buga', latitude: 3.901, longitude: -76.298 },
  { label: 'Santander de Quilichao', latitude: 3.009, longitude: -76.484 },
  { label: 'San Agustín', latitude: 1.881, longitude: -76.268 },
  { label: 'Puerto Colombia', latitude: 10.988, longitude: -74.955 },
  { label: 'Soledad', latitude: 10.917, longitude: -74.765 },
  { label: 'Itagüí', latitude: 6.172, longitude: -75.611 },
]

const TOWNS: readonly GridPoint[] = [...CITY_POINTS, ...EXTRA_TOWNS]

/**
 * The source's encoding is broken in places: "C�cuta", "Cajic�".
 * The replacement character stands for exactly one letter, so it becomes a
 * wildcard against the known towns. Also matches "La Dorada Caldas" to
 * "La Dorada" (the town plus its department).
 */
export function findTown(raw: string): GridPoint | null {
  const pattern = normalise(raw.trim())
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/�/g, '.')
  const re = new RegExp(`^${pattern}$`)
  const exact = TOWNS.find((town) => re.test(normalise(town.label)))
  if (exact !== undefined) return exact
  const name = normalise(raw.trim())
  return TOWNS.find((town) => name.startsWith(`${normalise(town.label)} `)) ?? null
}

/** Great-circle distance in km. */
export function distanceKm(a: GridPoint, b: { latitude: number; longitude: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.latitude - a.latitude) * rad
  const dLng = (b.longitude - a.longitude) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export const olimpicaBranchAdapter: BranchAdapter = {
  storeSlug: 'olimpica',

  fetchBranches(ctx) {
    return sweepPickupPoints(BASE_URL, nationalGrid(), ctx)
  },

  normalize(raw: RawBranch): BranchNormalizeResult {
    const point = readPickupPoint(raw)
    if (point === null) return { status: 'failed', reason: 'forma de pickup point ilegible' }

    const id = SHOP_ID.exec(point.id)
    const name = SHOP_NAME.exec(point.name)
    if (id === null || id[1] !== id[2] || name === null) {
      return { status: 'skipped', reason: 'punto de recogida, no tienda' }
    }
    if (raw.isActive === false) return { status: 'skipped', reason: 'inactivo en la fuente' }
    if (!isInColombia(point.latitude, point.longitude)) {
      return { status: 'skipped', reason: 'coordenada fuera de Colombia' }
    }

    const townName = name[2] ?? ''
    const town = findTown(townName)
    if (town !== null && distanceKm(town, point) > MAX_KM_FROM_TOWN) {
      return { status: 'skipped', reason: 'coordenada lejos de su municipio (dato copiado)' }
    }

    // A garbled name with no known town keeps the source's spelling minus the junk.
    const city = town?.label ?? tidyName(townName.replace(/�/g, ''))

    return okBranch({
      externalId: String(Number(id[1])),
      name: `Olímpica ${city}`,
      address: point.street,
      city,
      latitude: point.latitude,
      longitude: point.longitude,
    })
  },
}
