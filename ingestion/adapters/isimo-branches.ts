import { z } from 'zod'

import {
  okBranch,
  tidyName,
  type BranchAdapter,
  type BranchFetchContext,
  type BranchNormalizeResult,
  type RawBranch,
} from '../core/branch-types'
import {
  addressQuery,
  createNominatimGeocoder,
  crossQuery,
  isDepartment,
  nominatimHitSchema,
  parseColombianAddress,
  resolveLocation,
  type GeocodeTarget,
  type NominatimHit,
} from '../core/geocode'
import { fetchJsonResult } from '../core/http'
import { sleep } from '../core/types'

/**
 * Ísimo's shops, from its WordPress site's public REST API (researched
 * 2026-10-04): ~310 posts of type `tiendas`, the address in the post body
 * and the town and department as taxonomy terms. NO coordinates — they come
 * from geocoding the address with Nominatim (core/geocode.ts), and the
 * shops it cannot place with confidence are skipped and reported.
 *
 * Coordinates for this chain are therefore derived from OpenStreetMap:
 * © OpenStreetMap contributors, ODbL 1.0.
 *
 * fetchBranches() does the network (WordPress, then Nominatim, cached on
 * disk) and attaches what Nominatim answered to each record; normalize()
 * stays pure and decides from those answers.
 */

const SITE = 'https://tiendasisimo.com/wp-json/wp/v2'
const PAGE_SIZE = 100
/** Safety stop: 310 shops today, 4 pages; 90 towns, 1 page. */
const MAX_PAGES = 20
/** Relative to the working directory (the repo root under `pnpm run`). Gitignored (`.cache/`). */
export const GEOCODE_CACHE_PATH = 'ingestion/.cache/geocode.json'

const termSchema = z.object({ id: z.number(), name: z.string() })

const shopSchema = z.object({
  id: z.number(),
  title: z.object({ rendered: z.string() }),
  content: z.object({ rendered: z.string() }),
  'tiendas-municipios': z.array(z.number()).default([]),
  'tiendas-departamento': z.array(z.number()).default([]),
})

/** What fetchBranches() adds to the WordPress record before normalize() sees it. */
const enrichedSchema = shopSchema.extend({
  municipality: z.string().nullable(),
  department: z.string().nullable(),
  geocode: z.object({
    addressHits: z.array(nominatimHitSchema),
    crossHits: z.array(nominatimHitSchema),
    /** The address answer was cut at Nominatim's limit. Absent: read off its length. */
    addressTruncated: z.boolean().optional(),
  }),
})

const ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
}

/** PURE. WordPress HTML → plain text: tags out, entities decoded. */
export function htmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/[“”"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** "ISIMO COLORADOS" → "Ísimo Colorados"; "MELGAR" → "Ísimo Melgar". */
export function shopName(title: string): string {
  const name = tidyName(htmlToText(title)).replace(/^[IÍ]simo\b\s*/i, '')
  return name === '' ? 'Ísimo' : `Ísimo ${name}`
}

/**
 * PURE. Who the shop is and where to look for it, or why it cannot be looked
 * for. The title goes along as a hint: "Ísimo Santa Marta Bonda" is in the
 * village of Bonda, not in Santa Marta.
 */
function targetOf(
  title: string,
  address: string,
  municipality: string | null,
  department: string | null,
): GeocodeTarget | string {
  // The source sometimes swaps the two fields: town "CUNDINAMARCA",
  // department "MADRID". Swapped back only when that is unambiguous.
  if (
    municipality !== null &&
    department !== null &&
    isDepartment(municipality) &&
    !isDepartment(department)
  ) {
    return targetOf(title, address, department, municipality)
  }
  // A department in the town field names no town.
  if (municipality === null || isDepartment(municipality)) return 'municipio desconocido'
  const parsed = parseColombianAddress(address)
  if (parsed === null) return 'direccion sin formato de calle'
  return {
    address: parsed,
    municipality,
    department: department !== null && isDepartment(department) ? department : null,
    hints: [title, address],
  }
}

/**
 * Every term of a taxonomy (towns, departments), page by page: WordPress
 * gives at most 100 per request, and a town left on a second page would turn
 * its shops into "municipio desconocido". Null when any page is missing or
 * unreadable — half a list of towns is not a list of towns.
 */
async function fetchTerms(
  taxonomy: string,
  ctx: BranchFetchContext,
): Promise<Map<number, string> | null> {
  const terms = new Map<number, string>()
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${SITE}/${taxonomy}?per_page=${PAGE_SIZE}&page=${page}&_fields=id,name`
    // WordPress answers 400 past the last page (a count that is a multiple of 100).
    const result = await fetchJsonResult(url, ctx, { endStatuses: [400] })
    await sleep(ctx.delayMs)
    if (result.kind === 'end' && page > 1) return terms
    if (result.kind !== 'ok') return null
    const parsed = z.array(termSchema).safeParse(result.body)
    if (!parsed.success) {
      ctx.onRequestDropped?.(url, 'taxonomia ilegible')
      return null
    }
    for (const term of parsed.data) terms.set(term.id, htmlToText(term.name))
    if (parsed.data.length < PAGE_SIZE) return terms
  }
  ctx.onRequestDropped?.(taxonomy, `taxonomia con mas de ${MAX_PAGES} paginas`)
  return null
}

export const isimoBranchAdapter: BranchAdapter = {
  storeSlug: 'isimo',

  async *fetchBranches(ctx) {
    const towns = await fetchTerms('tiendas-municipios', ctx)
    const departments = await fetchTerms('tiendas-departamento', ctx)
    // Without the towns no address can be geocoded safely: yield nothing,
    // and the pipeline aborts on an empty run.
    if (towns === null || departments === null) return

    const geocoder = await createNominatimGeocoder({ ctx, cachePath: GEOCODE_CACHE_PATH })
    // How each shop was placed, for the run's log: the acceptance rate is the
    // number to watch when OSM or the source changes.
    const tally: Record<string, number> = {}
    try {
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const url = `${SITE}/tiendas?per_page=${PAGE_SIZE}&page=${page}`
        // WordPress answers 400 past the last page.
        const result = await fetchJsonResult(url, ctx, { endStatuses: [400] })
        await sleep(ctx.delayMs)
        if (result.kind !== 'ok') break
        if (!Array.isArray(result.body)) {
          ctx.onRequestDropped?.(url, 'respuesta sin lista de tiendas')
          break
        }

        for (const item of result.body as unknown[]) {
          const shop = shopSchema.safeParse(item)
          // Unreadable: passed through untouched so normalize() counts it as failed.
          if (!shop.success) {
            yield (item ?? {}) as RawBranch
            continue
          }

          const municipalityId = shop.data['tiendas-municipios'][0]
          const departmentId = shop.data['tiendas-departamento'][0]
          const municipality =
            municipalityId === undefined ? null : (towns.get(municipalityId) ?? null)
          const department =
            departmentId === undefined ? null : (departments.get(departmentId) ?? null)

          const target = targetOf(
            htmlToText(shop.data.title.rendered),
            htmlToText(shop.data.content.rendered),
            municipality,
            department,
          )
          let addressHits: NominatimHit[] = []
          let crossHits: NominatimHit[] = []
          let addressTruncated = false
          if (typeof target !== 'string') {
            const found = await geocoder.search(addressQuery(target))
            addressHits = found?.hits ?? []
            addressTruncated = found?.truncated ?? false
            const query = crossQuery(target)
            // The cross street is only skipped when a numbered building already
            // settled it. A 'street' answer is the fallback, not a reason to
            // stop: with the corner the pin moves from mid-street to the block,
            // and a cross street found far away refuses the street altogether.
            const alone = resolveLocation(target, addressHits, [], addressTruncated)
            if (query !== null && !(alone.ok && alone.precision === 'address')) {
              crossHits = (await geocoder.search(query))?.hits ?? []
            }
          }

          const outcome =
            typeof target === 'string'
              ? target
              : resolveLocation(target, addressHits, crossHits, addressTruncated)
          const label =
            typeof outcome === 'string' ? outcome : outcome.ok ? outcome.precision : outcome.reason
          tally[label] = (tally[label] ?? 0) + 1

          yield {
            ...(item as RawBranch),
            municipality,
            department,
            geocode: { addressHits, crossHits, addressTruncated },
          }
        }

        await geocoder.flush()
        if (result.body.length < PAGE_SIZE) break
      }
    } finally {
      await geocoder.flush()
      console.warn(
        `  geocodificacion: ${geocoder.stats.requested} consultas a Nominatim, ` +
          `${geocoder.stats.cached} desde cache; ${JSON.stringify(tally)}`,
      )
    }
  },

  normalize(raw: RawBranch): BranchNormalizeResult {
    const parsed = enrichedSchema.safeParse(raw)
    if (!parsed.success) return { status: 'failed', reason: 'tienda de Isimo ilegible' }
    const shop = parsed.data

    const address = htmlToText(shop.content.rendered)
    const title = htmlToText(shop.title.rendered)
    const target = targetOf(title, address, shop.municipality, shop.department)
    if (typeof target === 'string') return { status: 'skipped', reason: target }

    const { addressHits, crossHits, addressTruncated } = shop.geocode
    const location = resolveLocation(target, addressHits, crossHits, addressTruncated)
    if (!location.ok) return { status: 'skipped', reason: `geocodificacion: ${location.reason}` }

    return okBranch({
      externalId: String(shop.id),
      name: shopName(shop.title.rendered),
      address: address === '' ? null : address,
      city: tidyName(target.municipality.replace(/,?\s*D\.?\s*C\.?$/i, '')),
      latitude: location.latitude,
      longitude: location.longitude,
    })
  },
}
