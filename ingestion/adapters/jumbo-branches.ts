import {
  isInColombia,
  okBranch,
  tidyName,
  type BranchAdapter,
  type BranchNormalizeResult,
  type RawBranch,
} from '../core/branch-types'
import { normalise } from '../core/classify'
import { CITY_POINTS } from '../core/colombia-grid'
import { readPickupPoint, sweepPickupPoints } from './vtex-pickup-points'

/**
 * Jumbo's shops (Cencosud), from VTEX pickup points (researched 2026-10-04).
 * Like Éxito, a point answers ~45 km around it, so town centres are enough.
 *
 * Ids end in the shop number: `jumbocolombiaioswl15_15` (Jumbo) and
 * `jumbocolombiaidmetro26banderas_26` (former Metro shops, named "JM ...").
 * Pickup counters that are not shops end in a uuid (`retiroentienda...`) or
 * say "donaciones" (a donation drop-off at the Calle 80 shop).
 *
 * The externalId is that number alone, WITHOUT the `ioswl` / `idmetro`
 * prefix, on purpose. Both families draw from one company numbering, not two:
 * in the 59 shops of the first national sweep (2026-10-04) the numbers
 * interleave without a gap pattern per family (70 Jumbo Suba, 71 Metro
 * Tintalito, 73–79 Metro, 75 Jumbo Simón Bolívar…), and shop 73 keeps its
 * `idmetro73mosquera` id although it is already named plain "Mosquera": the
 * banner changes, the number stays. Keeping the prefix would give a shop a
 * new identity the day it is rebranded. If two different shops ever share a
 * number the second one is dropped as a duplicate — the fixture test asserts
 * a single page has none.
 */

const BASE_URL = 'https://www.jumbocolombia.com'
const SHOP_NUMBER = /_(\d+)$/
const METRO_PREFIX = /^JM\s+/i

export const jumboBranchAdapter: BranchAdapter = {
  storeSlug: 'jumbo',

  fetchBranches(ctx) {
    return sweepPickupPoints(BASE_URL, CITY_POINTS, ctx)
  },

  normalize(raw: RawBranch): BranchNormalizeResult {
    const point = readPickupPoint(raw)
    if (point === null) return { status: 'failed', reason: 'forma de pickup point ilegible' }

    const number = SHOP_NUMBER.exec(point.id)?.[1]
    if (number === undefined || normalise(point.name).includes('donacion')) {
      return { status: 'skipped', reason: 'punto de recogida, no tienda' }
    }
    if (raw.isActive === false) return { status: 'skipped', reason: 'inactivo en la fuente' }
    if (!isInColombia(point.latitude, point.longitude)) {
      return { status: 'skipped', reason: 'coordenada fuera de Colombia' }
    }

    const shop = tidyName(point.name.replace(METRO_PREFIX, '')).replace(/^Jumbo\s+/, '')
    // "Bogotá, D.c." and "Provincia de Cartagena" are how VTEX spells them.
    const city =
      point.city === null
        ? null
        : tidyName(point.city.replace(/,?\s*D\.?\s*C\.?$/i, '').replace(/^Provincia de\s+/i, ''))

    return okBranch({
      externalId: String(Number(number)),
      name: `Jumbo ${shop}`,
      address: point.street,
      city,
      latitude: point.latitude,
      longitude: point.longitude,
    })
  },
}
