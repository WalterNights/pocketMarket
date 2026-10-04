import {
  isInColombia,
  okBranch,
  tidyName,
  type BranchAdapter,
  type BranchNormalizeResult,
  type RawBranch,
} from '../core/branch-types'
import { nationalGrid } from '../core/colombia-grid'
import { readPickupPoint, sweepPickupPoints } from './vtex-pickup-points'

/**
 * D1's shops, from VTEX pickup points. D1 caps each point at 300 results —
 * all within ~10 km in Bogotá — so it needs the dense national grid. Points
 * that still hit the cap are reported, so the grid can be tightened there.
 *
 * Names come as "BOG BENJAMIN HERRERA": a city code, then the shop. The code
 * goes; the shop name is title-cased.
 */

const BASE_URL = 'https://www.d1.com.co'
const CITY_CODE_PREFIX = /^[A-Z]{3}\s+/

export const d1BranchAdapter: BranchAdapter = {
  storeSlug: 'd1',

  fetchBranches(ctx) {
    return sweepPickupPoints(BASE_URL, nationalGrid(), ctx)
  },

  normalize(raw: RawBranch): BranchNormalizeResult {
    const point = readPickupPoint(raw)
    if (point === null) return { status: 'failed', reason: 'forma de pickup point ilegible' }

    if (!isInColombia(point.latitude, point.longitude)) {
      return { status: 'skipped', reason: 'coordenada fuera de Colombia' }
    }

    const shop = tidyName(point.name.replace(CITY_CODE_PREFIX, ''))

    return okBranch({
      externalId: point.id,
      name: `D1 ${shop}`,
      address: point.street,
      city: point.city === null ? null : tidyName(point.city.replace(/,?\s*D\.?\s*C\.?$/i, '')),
      latitude: point.latitude,
      longitude: point.longitude,
    })
  },
}
