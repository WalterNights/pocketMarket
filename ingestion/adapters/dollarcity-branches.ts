import {
  isInColombia,
  okBranch,
  tidyName,
  type BranchAdapter,
  type BranchNormalizeResult,
  type RawBranch,
} from '../core/branch-types'
import { CITY_POINTS } from '../core/colombia-grid'
import { fetchJson } from '../core/http'
import { sleep } from '../core/types'

/**
 * Dollarcity's shops, from its own store locator. It answers up to ~160 km
 * around a point, so a handful of regional centres covers the country and
 * the pipeline deduplicates by LocationId.
 *
 * The site's JS also embeds an API Management key for another route: not
 * used. This route needs none.
 */

const RADIUS_KM = 160

/** Regional centres ~300 km apart: each circle of 160 km overlaps its neighbours. */
const REGIONAL_CENTRES = [
  'Bogotá',
  'Medellín',
  'Cali',
  'Barranquilla',
  'Bucaramanga',
  'Cúcuta',
  'Pereira',
  'Neiva',
  'Pasto',
  'Montería',
  'Valledupar',
  'Villavicencio',
  'Yopal',
  'San Andrés',
]

export const dollarcityBranchAdapter: BranchAdapter = {
  storeSlug: 'dollarcity',

  async *fetchBranches(ctx) {
    const points = CITY_POINTS.filter((p) => REGIONAL_CENTRES.includes(p.label))

    for (const point of points) {
      const url =
        'https://dollarcity.com/ubicaciones/locations/GetDataByCoordinates' +
        `?longitude=${point.longitude}&latitude=${point.latitude}` +
        `&distance=${RADIUS_KM}&units=kilometers&amenities=&paymentMethods=&filter=CO`

      const body = (await fetchJson(url, ctx, { method: 'POST', body: '' })) as {
        StoreLocations?: unknown
      } | null
      await sleep(ctx.delayMs)

      // Same failure behaviour as every branch adapter (vtex-pickup-points.ts):
      // a dropped request was reported by fetchJson; an unreadable answer is
      // reported here. Either way, on to the next centre.
      if (body === null) continue
      if (typeof body !== 'object' || !Array.isArray(body.StoreLocations)) {
        ctx.onRequestDropped?.(url, 'respuesta sin StoreLocations')
        continue
      }

      for (const item of body.StoreLocations) {
        if (item !== null && typeof item === 'object') yield item as RawBranch
      }
    }
  },

  normalize(raw: RawBranch): BranchNormalizeResult {
    const location = raw.Location as { coordinates?: unknown } | undefined
    const coords = location?.coordinates
    if (
      typeof raw.LocationId !== 'string' ||
      !Array.isArray(coords) ||
      typeof coords[0] !== 'number' ||
      typeof coords[1] !== 'number'
    ) {
      return { status: 'failed', reason: 'ubicacion de Dollarcity ilegible' }
    }

    const extra = (raw.ExtraData ?? {}) as {
      BusinessStatus?: unknown
      Name?: { LongName?: unknown }
      Address?: { Locality?: unknown; CountryCode?: unknown }
    }
    // 0 = open. Anything else is temporarily or permanently closed.
    if (extra.BusinessStatus !== undefined && extra.BusinessStatus !== 0) {
      return { status: 'skipped', reason: 'tienda cerrada en la fuente' }
    }
    if (extra.Address?.CountryCode !== undefined && extra.Address.CountryCode !== 'CO') {
      return { status: 'skipped', reason: 'fuera de Colombia' }
    }

    // GeoJSON order: [longitude, latitude].
    const [longitude, latitude] = coords as [number, number]
    if (!isInColombia(latitude, longitude)) {
      return { status: 'skipped', reason: 'coordenada fuera de Colombia' }
    }

    const longName = typeof extra.Name?.LongName === 'string' ? extra.Name.LongName : null
    const name = longName ?? (typeof raw.Name === 'string' ? raw.Name : 'Dollarcity')
    const locality = typeof extra.Address?.Locality === 'string' ? extra.Address.Locality : ''
    const address = typeof raw.Address === 'string' ? raw.Address.trim() : ''

    return okBranch({
      externalId: raw.LocationId,
      name: name.trim(),
      address: address === '' ? null : address,
      // "Bogotá D.C." / "Bogotá DC" / "Bogotá" are the same place.
      city: locality === '' ? null : tidyName(locality.replace(/,?\s*D\.?\s*C\.?$/i, '')),
      latitude,
      longitude,
    })
  },
}
