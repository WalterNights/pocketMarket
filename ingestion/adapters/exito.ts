import { classifyProduct } from '../core/classify'
import { fetchJsonResult } from '../core/http'
import {
  capitaliseFirst,
  cleanProductName,
  extractMeasure,
  tidyBrand,
  toCop,
} from '../core/normalize'
import { normalizedProductSchema } from '../core/schemas'
import {
  failed,
  ok,
  skipped,
  sleep,
  type FetchContext,
  type NormalizeResult,
  type RawProduct,
  type StoreAdapter,
} from '../core/types'

/**
 * Éxito — VTEX. Research and endpoint details in docs/domain/02-ingestion.md.
 *
 * Deliberately conservative: one page at a time, a pause between requests, an
 * identifiable User-Agent, and only the grocery categories. Éxito also sells
 * televisions, and a television in a shopping list is noise as well as storage.
 */

const BASE = 'https://www.exito.com/api/catalog_system/pub/products/search'
const MERCADO_ROOT = '34185082'
const PAGE_SIZE = 50

/**
 * VTEX refuses to paginate past ~2500 results: asking for _from=2550 returns
 * 400. A category with more products than that simply cannot be walked whole
 * through this endpoint, so we stop there and move on rather than aborting the
 * whole run. Fuller coverage would need the level-3 subcategories.
 */
const MAX_OFFSET = 2500

/** Éxito's grocery subcategories mapped onto OUR taxonomy. */
export const EXITO_CATEGORIES: readonly { id: string; label: string; slug: string }[] = [
  { id: '34185101', label: 'Despensa', slug: 'viveres' },
  { id: '34185103', label: 'Lácteos, huevos y refrigerados', slug: 'lacteos' },
  { id: '34185097', label: 'Pollo, carne y pescado', slug: 'carnes' },
  { id: '34185098', label: 'Charcutería y delicatessen', slug: 'carnes' },
  { id: '34185099', label: 'Frutas y verduras', slug: 'frutas-verduras' },
  { id: '34185100', label: 'Panadería y repostería', slug: 'panaderia' },
  { id: '346084837', label: 'Bebidas', slug: 'bebidas' },
  { id: '34185104', label: 'Congelados', slug: 'congelados' },
  { id: '34185106', label: 'Aseo del hogar', slug: 'aseo-hogar' },
  { id: '34185107', label: 'Mascotas', slug: 'mascotas' },
  { id: '347733901', label: 'Alimentación para bebés', slug: 'bebes' },
  { id: '34185105', label: 'Pasabocas y snacks', slug: 'otros' },
  { id: '346098434', label: 'Dulces y chocolatería', slug: 'otros' },
  { id: '348959797', label: 'Comidas preparadas', slug: 'otros' },
]

const CATEGORY_BY_ID = new Map(EXITO_CATEGORIES.map((c) => [c.id, c.slug]))

/** Marks which category a record came from, so normalize() can map it. */
const SOURCE_CATEGORY = Symbol.for('pocketmarket.sourceCategoryId')

export const exitoAdapter: StoreAdapter = {
  storeSlug: 'exito',
  sourceType: 'api',
  // Éxito varies prices by city, but the public catalogue endpoint returns a
  // single set. Treated as national until a per-region source is found.
  regions: ['NACIONAL'],

  async *fetchCatalog(_region, ctx: FetchContext): AsyncIterable<RawProduct> {
    let yielded = 0

    for (const category of EXITO_CATEGORIES) {
      let from = 0

      for (;;) {
        if (ctx.maxProducts !== undefined && yielded >= ctx.maxProducts) return
        if (from >= MAX_OFFSET) break

        const url = `${BASE}?fq=C:/${MERCADO_ROOT}/${category.id}/&_from=${from}&_to=${from + PAGE_SIZE - 1}`
        const page = await fetchPage(url, ctx)

        // null: the source said "no more" (a 400 past the pagination ceiling),
        // or the page was dropped and already reported to the run.
        if (page === null) break
        if (page.length === 0) break

        for (const raw of page) {
          ;(raw as Record<symbol, unknown>)[SOURCE_CATEGORY] = category.id
          yield raw
          yielded += 1
          if (ctx.maxProducts !== undefined && yielded >= ctx.maxProducts) return
        }

        if (page.length < PAGE_SIZE) break
        from += PAGE_SIZE

        // Be a well-behaved client: one request at a time, with a pause.
        await sleep(ctx.delayMs)
      }

      await sleep(ctx.delayMs)
    }
  },

  normalize(raw: RawProduct): NormalizeResult {
    const product = raw as ExitoProduct

    const item = product.items?.[0]
    const offer = item?.sellers?.[0]?.commertialOffer
    if (item === undefined || offer === undefined) return failed('sin items ni oferta')

    // Price 0 means out of stock today, not a broken record.
    const priceCop = toCop(offer.Price)
    if (priceCop === null) return skipped('sin precio (agotado)')

    const listRaw = toCop(offer.ListPrice)
    // Only a real discount is a list price; equal values are just noise.
    const listPriceCop = listRaw !== null && listRaw > priceCop ? listRaw : null

    const externalId = String(product.productId ?? '').trim()
    if (externalId.length === 0) return failed('sin productId')

    const sourceName = item.nameComplete ?? product.productName ?? ''
    const brand = tidyBrand(product.brand)

    const cleaned = cleanProductName(sourceName, product.brand ?? null)
    // Falling back to the raw name beats shipping an empty row.
    const name = capitaliseFirst(cleaned.length > 0 ? cleaned : sourceName.trim())
    if (name.length === 0) return failed('sin nombre')

    const measure = extractMeasure(sourceName)

    const sourceCategoryId = (raw as Record<symbol, unknown>)[SOURCE_CATEGORY]
    const sourceBucket =
      typeof sourceCategoryId === 'string' ? (CATEGORY_BY_ID.get(sourceCategoryId) ?? null) : null

    // Éxito's buckets are too coarse — "Despensa" holds rice, pasta, oil and
    // tinned fish at once — so the aisle is deduced from the name, with the
    // source bucket as fallback (ingestion/core/classify.ts).
    // Classified with the CLEAN name, not the raw one: the raw name carries
    // the brand in the middle ("Chocolate CORONA de mesa"), which breaks any
    // multi-word rule.
    const categorySlug = classifyProduct(name, sourceBucket)

    const ean = typeof item.ean === 'string' && /^\d{8,14}$/.test(item.ean) ? item.ean : null

    const parsed = normalizedProductSchema.safeParse({
      externalId,
      ean,
      name,
      brand,
      categorySlug,
      sourceBucket,
      unitKind: measure?.kind ?? 'unit',
      unitValue: measure?.value ?? null,
      unitMeasure: measure?.measure ?? null,
      imageUrl: item.images?.[0]?.imageUrl ?? null,
      isAvailable: offer.IsAvailable === true && (offer.AvailableQuantity ?? 0) > 0,
      priceCop,
      listPriceCop,
    })

    return parsed.success ? ok(parsed.data) : failed(parsed.error.issues[0]?.message ?? 'schema')
  },
}

/**
 * A 500 or a 429 from a page deep inside a category is almost always transient
 * — one run died at offset 1600 of a single category and lost every category
 * still pending. core/http retries with exponential backoff (network errors
 * and timeouts included) and only gives up on the PAGE, never on the run; the
 * dropped page reaches the run report through ctx.onRequestDropped.
 */
const MAX_ATTEMPTS = 4

/** null = the category has no more pages, for whatever reason. */
async function fetchPage(url: string, ctx: FetchContext): Promise<RawProduct[] | null> {
  const result = await fetchJsonResult(url, ctx, {
    attempts: MAX_ATTEMPTS,
    // 400 past the pagination ceiling is the source saying "no more", not a
    // failure. Aborting the run there would lose every category still pending.
    endStatuses: [400],
  })

  if (result.kind === 'ok') {
    return Array.isArray(result.body) ? (result.body as RawProduct[]) : []
  }
  // 'end' is routine; 'dropped' was already reported by fetchJsonResult. In
  // both cases the offsets after this one are unknown, so the category ends.
  return null
}

/** Shape of what Éxito returns. Only the parts we read. */
type ExitoProduct = {
  productId?: string | number
  productName?: string
  brand?: string
  items?: {
    ean?: string
    nameComplete?: string
    images?: { imageUrl?: string }[]
    sellers?: {
      commertialOffer?: {
        Price?: number
        ListPrice?: number
        IsAvailable?: boolean
        AvailableQuantity?: number
      }
    }[]
  }[]
}
