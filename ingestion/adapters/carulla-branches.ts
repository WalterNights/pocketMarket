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
 * Carulla's shops, from VTEX pickup points (researched 2026-10-04). Carulla
 * is Grupo Éxito: same ~45 km radius, so town centres are enough, and the
 * same account answers with Éxito's shops too — skipped here, they have their
 * own adapter.
 *
 * Coverage is PARTIAL: only shops with pickup are published (~45 of ~100).
 *
 * A shop may come under two id schemes (`carulla4081_ptorecogida_4081` and
 * `1_ptorecogida_4081`). The number is the shop; the pipeline dedupes.
 */

const BASE_URL = 'https://www.carulla.com'
const STORE_NUMBER = /ptorecogida_?0*(\d+)$/

export const carullaBranchAdapter: BranchAdapter = {
  storeSlug: 'carulla',

  fetchBranches(ctx) {
    return sweepPickupPoints(BASE_URL, CITY_POINTS, ctx)
  },

  normalize(raw: RawBranch): BranchNormalizeResult {
    const point = readPickupPoint(raw)
    if (point === null) return { status: 'failed', reason: 'forma de pickup point ilegible' }

    if (!normalise(point.name).startsWith('carulla')) {
      return { status: 'skipped', reason: 'no es un Carulla' }
    }
    const number = STORE_NUMBER.exec(point.id)?.[1]
    if (number === undefined) return { status: 'skipped', reason: 'punto de recogida, no tienda' }
    if (raw.isActive === false) return { status: 'skipped', reason: 'inactivo en la fuente' }
    if (!isInColombia(point.latitude, point.longitude)) {
      return { status: 'skipped', reason: 'coordenada fuera de Colombia' }
    }

    const city =
      point.city === null
        ? null
        : tidyName(
            point.city
              .replace(/,?\s*D\.?\s*C\.?$/i, '')
              .replace(/^Provincia de\s+/i, '')
              .replace(/\s+De Indias$/i, ''),
          )

    return okBranch({
      externalId: String(Number(number)),
      name: tidyName(point.name),
      address: point.street,
      city,
      latitude: point.latitude,
      longitude: point.longitude,
    })
  },
}
