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
  type RegionCode,
  type StoreAdapter,
} from '../core/types'

/**
 * Any VTEX store's public catalogue: Éxito, D1, Olímpica (plan 0003). One
 * factory, one configuration per chain — they share the endpoint, the
 * pagination ceiling (ING-005) and the record shape, so a chain differs only in
 * its host and in how its aisles map onto our taxonomy.
 *
 * Deliberately conservative: one page at a time, a pause between requests, an
 * identifiable User-Agent, and only the grocery categories. These stores also
 * sell televisions, and a television in a shopping list is noise as well as
 * storage.
 */

const SEARCH_PATH = '/api/catalog_system/pub/products/search'
const PAGE_SIZE = 50

/**
 * VTEX refuses to paginate past ~2500 results: asking for _from=2550 returns
 * 400. A category with more products than that simply cannot be walked whole
 * through this endpoint, so we stop there and move on rather than aborting the
 * whole run. Fuller coverage would need the level-3 subcategories.
 *
 * Stopping is not silent: a category still handing out full pages at the
 * ceiling was cut short, and the run is told (see `fetchCatalog`).
 */
const MAX_OFFSET = 2500

/**
 * The reason a truncated category is reported with. It travels through
 * `ctx.onRequestDropped`, the same channel as a page lost to a 500, so this
 * exact text is what tells the two apart in a run report: keep it stable.
 *
 * Known edge: a category holding EXACTLY 2500 products is reported too. Its
 * last page is full and the next one cannot be asked for, so "nothing left"
 * and "more we cannot see" look the same from here. Erring towards reporting
 * is deliberate — the cost is a split that was not strictly needed yet.
 */
export const VTEX_TRUNCATED_REASON = 'tope de paginacion de VTEX: categoria truncada'

/** One aisle of the source, mapped onto OUR taxonomy. */
export type VtexCategory = { id: string; label: string; slug: string }

export type VtexCatalogConfig = {
  storeSlug: string
  /** Origin plus any prefix before /api (Carulla serves it under /io). */
  baseUrl: string
  /**
   * Category path above the aisles, as VTEX's `fq=C:` wants it:
   * '/34185082' when the aisles hang from a "Mercado" root, '' when they are
   * top-level.
   */
  parentPath: string
  categories: readonly VtexCategory[]
  regions: RegionCode[]
  /**
   * Which field carries the product's display name. VTEX builds
   * `nameComplete` as product name + SKU name whenever the two differ. On
   * Éxito they never do, but Olímpica and D1 keep an internal SKU name, so
   * `nameComplete` reads "Aceite Medalla de Oro Mezcla 3 Lt ACEITE MEDALLA ORO
   * MEZCLA 3 L" and they use `productName` instead. Defaults to 'nameComplete'.
   */
  nameField?: 'nameComplete' | 'productName'
}

export function createVtexCatalogAdapter(config: VtexCatalogConfig): StoreAdapter {
  const categoryById = new Map(config.categories.map((c) => [c.id, c.slug]))
  const searchUrl = `${config.baseUrl}${SEARCH_PATH}`

  return {
    storeSlug: config.storeSlug,
    sourceType: 'api',
    regions: config.regions,

    async *fetchCatalog(_region, ctx: FetchContext): AsyncIterable<RawProduct> {
      let yielded = 0
      // A product listed in several aisles comes back once per aisle. The
      // pipeline only deduplicates inside a batch, so across batches the LAST
      // aisle would overwrite the source bucket and the product would be
      // counted twice. Remembered here for the whole run, the FIRST aisle
      // wins — which is what the order of `config.categories` means. Ids
      // only: a few tens of thousands of short strings, not the catalogue.
      const yieldedIds = new Set<string>()

      for (const category of config.categories) {
        let from = 0

        for (;;) {
          if (ctx.maxProducts !== undefined && yielded >= ctx.maxProducts) return

          const url = `${searchUrl}?fq=C:${config.parentPath}/${category.id}/&_from=${from}&_to=${from + PAGE_SIZE - 1}`
          const page = await fetchPage(url, ctx)

          // null: the source said "no more" (a 400 past the pagination ceiling),
          // or the page was dropped and already reported to the run.
          if (page === null) break
          if (page.length === 0) break

          for (const raw of page) {
            // A record with no id is still yielded: normalize() reports it as
            // unreadable, and hiding it here would hide a format change.
            const id = productIdOf(raw)
            if (id !== null) {
              if (yieldedIds.has(id)) continue
              yieldedIds.add(id)
            }

            ;(raw as Record<symbol, unknown>)[SOURCE_CATEGORY] = category.id
            yield raw
            yielded += 1
            if (ctx.maxProducts !== undefined && yielded >= ctx.maxProducts) return
          }

          if (page.length < PAGE_SIZE) break
          from += PAGE_SIZE

          if (from >= MAX_OFFSET) {
            // A full page right at the ceiling: there is more and we cannot
            // ask for it. That is a hole in the run, not a normal end — the
            // products past it were never seen, so they must not be mistaken
            // for products gone from the source (ING-005).
            //
            // Once per category (the loop ends here), and with the label: the
            // operator needs to know WHICH aisle to split into subcategories.
            console.warn(
              `  ${VTEX_TRUNCATED_REASON} — "${category.label}" (${config.storeSlug}, id ${category.id}): ` +
                `${MAX_OFFSET} leidos y hay mas; hay que dividirla en subcategorias`,
            )
            ctx.onRequestDropped?.(url, VTEX_TRUNCATED_REASON)
            break
          }

          // Be a well-behaved client: one request at a time, with a pause.
          await sleep(ctx.delayMs)
        }

        await sleep(ctx.delayMs)
      }
    },

    normalize: (raw) => normalizeVtexProduct(raw, categoryById, config.nameField ?? 'nameComplete'),
  }
}

/** Marks which category a record came from, so normalize() can map it. */
const SOURCE_CATEGORY = Symbol.for('pocketmarket.sourceCategoryId')

/** The same id normalize() uses as `externalId`, or null when there is none. */
function productIdOf(raw: RawProduct): string | null {
  const value = raw.productId
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const id = String(value).trim()
  return id.length > 0 ? id : null
}

function normalizeVtexProduct(
  raw: RawProduct,
  categoryById: ReadonlyMap<string, string>,
  nameField: 'nameComplete' | 'productName',
): NormalizeResult {
  const product = raw as VtexProduct

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

  const sourceName =
    (nameField === 'productName'
      ? (product.productName ?? item.nameComplete)
      : (item.nameComplete ?? product.productName)) ?? ''
  const brand = tidyBrand(product.brand)

  const cleaned = cleanProductName(sourceName, product.brand ?? null)
  // Falling back to the raw name beats shipping an empty row.
  const name = capitaliseFirst(cleaned.length > 0 ? cleaned : sourceName.trim())
  if (name.length === 0) return failed('sin nombre')

  const measure = extractMeasure(sourceName)

  const sourceCategoryId = (raw as Record<symbol, unknown>)[SOURCE_CATEGORY]
  const sourceBucket =
    typeof sourceCategoryId === 'string' ? (categoryById.get(sourceCategoryId) ?? null) : null

  // VTEX buckets are too coarse — "Despensa" holds rice, pasta, oil and
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

/** Shape of what VTEX returns. Only the parts we read. */
type VtexProduct = {
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
