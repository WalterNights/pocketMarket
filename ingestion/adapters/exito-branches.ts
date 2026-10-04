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
 * Éxito's shops, from VTEX pickup points (~40–50 km around each query point,
 * so town centres are enough — no dense grid).
 *
 * Every shop appears TWICE, under two id schemes of the same store number:
 * `1_ptorecogida_0094` and `exitocol094_ptorecogida_094`. The number is the
 * shop; it becomes the external id, and the pipeline's dedupe does the rest.
 */

const BASE_URL = 'https://www.exito.com'
const STORE_NUMBER = /ptorecogida_0*(\d+)$/

export const exitoBranchAdapter: BranchAdapter = {
  storeSlug: 'exito',

  fetchBranches(ctx) {
    return sweepPickupPoints(BASE_URL, CITY_POINTS, ctx)
  },

  normalize(raw: RawBranch): BranchNormalizeResult {
    const point = readPickupPoint(raw)
    if (point === null) return { status: 'failed', reason: 'forma de pickup point ilegible' }

    const number = STORE_NUMBER.exec(point.id)?.[1]
    if (number === undefined) return { status: 'skipped', reason: 'no es una tienda (sin numero)' }

    const name = normalise(point.name)
    // Lockers and partner counters ("PUNTO ...") are pickup points, not shops,
    // and Carulla is its own chain, not one of ours.
    if (!name.includes('exito')) return { status: 'skipped', reason: 'no es un Exito' }
    if (name.startsWith('punto')) return { status: 'skipped', reason: 'punto de recogida' }

    if (!isInColombia(point.latitude, point.longitude)) {
      return { status: 'skipped', reason: 'coordenada fuera de Colombia' }
    }

    return okBranch({
      externalId: String(Number(number)),
      name: tidyName(point.name).replace(/^Exito\b/, 'Éxito'),
      address: point.street,
      city: point.city === null ? null : tidyName(point.city),
      latitude: point.latitude,
      longitude: point.longitude,
    })
  },
}
