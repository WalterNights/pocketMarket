import { classifyProduct, normalise } from '../core/classify'
import { fetchJsonResult } from '../core/http'
import {
  capitaliseFirst,
  cleanProductName,
  COMBO_MARKER,
  extractMeasure,
  tidyBrand,
  toCop,
  type Measure,
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
 * Supermú (formerly La Vaquita, Medellín) — a Shopify storefront with one
 * national price. Public `/products.json`, allowed by its robots.txt, paged
 * with `limit=250&page=N` until a page comes back empty (~7.600 products,
 * 31 pages, on 2026-10-04).
 *
 * What makes this source awkward is not the shape but the labelling:
 *
 * - `product_type` is empty for ~58% of the catalogue and "Producto" for
 *   another 8%. It cannot be the aisle on its own.
 * - `tags` carry the store's ERP hierarchy ("ABARROTES", "ASEO HOGAR",
 *   "LICORES Y CIGARRILLOS"...) mixed with suppliers and promotions. That is
 *   the real aisle, so it is read first and `product_type` is the fallback.
 * - Titles are the ERP's: uppercase, abbreviated, with the measure in the
 *   middle ("GALLETA ANTOJOS 170G PROVOCACION") and in its own spellings
 *   ("1000C" for cc, "750M" for ml, "6U" for a six-pack).
 */

const BASE_URL = 'https://supermu.com/products.json'
const PAGE_SIZE = 250
/** Safety net: the catalogue is ~31 pages. A runaway loop stops here. */
const MAX_PAGES = 100
/** Same backoff budget as the VTEX adapters (ING-003). */
const MAX_ATTEMPTS = 4
/**
 * Page-numbered pagination survives a lost page — the next one is still
 * addressable — but two in a row means the source is down, and walking 30
 * more pages with retries would just hammer it.
 */
const MAX_CONSECUTIVE_DROPS = 2

const OUT_OF_SCOPE = 'fuera de mercado'

// --- Aisle mapping ---------------------------------------------------------

/** `null` = out of scope: not something you put on a grocery list. */
type Aisle = string | null

/**
 * Store tags → our source bucket, in PRECEDENCE order: the first tag that
 * matches wins. Products carry several department tags at once, so the order
 * is the decision:
 *
 * 1. Pets, authoritative as everywhere else (ING-008).
 * 2. Out of scope: liquor, personal care, pharmacy, baby care, home goods.
 *    Same scope as Éxito's "Mercado" (no personal care), and a product tagged
 *    both "ASEO" and "BELLEZA Y CUIDADO PERSONAL" is shampoo, not detergent.
 * 3. Fresh aisles before the coarse ones: frozen chicken is chicken, and a
 *    cheese tagged "DESAYUNO" is still dairy.
 *
 * Keys are compared normalised (uppercase, no accents), like ING-001 asks.
 */
const TAG_AISLES: readonly (readonly [string, Aisle])[] = [
  ['MASCOTAS', 'mascotas'],
  ['PRODUCTOS PARA ANIMALES', 'mascotas'],

  ['LICORES Y CIGARRILLOS', null],
  ['BEBIDAS ALCOHOLICAS', null],
  ['PROD LUMINICOS CALORIFICOS Y CIGARRILLOS', null],
  ['BELLEZA Y CUIDADO PERSONAL', null],
  ['ASEO PERSONAL', null],
  ['CUIDADO DEL BEBE', null],
  ['ARTICULOS PARA BEBE', null],
  ['BOTIQUIN', null],
  ['ARTICULOS PARA EL HOGAR', null],

  ['CARNES-POLLO-PESCADO', 'carnes'],
  ['CARNES FRIAS', 'carnes'],
  ['CARNES BLANCAS', 'carnes'],
  ['ALIMENTOS CARNICOS', 'carnes'],
  ['PESCADOS Y MARISCOS', 'carnes'],
  ['CONGELADOS', 'congelados'],
  ['FRUTAS Y VERDURAS', 'frutas-verduras'],
  ['FRUVER', 'frutas-verduras'],
  ['LACTEOS Y DERIVADOS', 'lacteos'],
  ['LACTEOS/DERIVADOS/HUEVOS', 'lacteos'],
  ['LACTEOS DERIVADOS', 'lacteos'],
  ['LACTEOS LECHES', 'lacteos'],
  ['DERIVADOS LACTEOS', 'lacteos'],
  ['PANADERIA', 'panaderia'],
  ['COMPLEMENTOS INFANTILES', 'bebes'],
  ['BEBIDAS LIQUIDAS', 'bebidas'],
  ['ASEO HOGAR', 'aseo-hogar'],
  ['ASEO Y ARTICULOS PARA EL HOGAR', 'aseo-hogar'],
  ['CUIDADO DEL HOGAR', 'aseo-hogar'],
  ['CUIDADO DE LA ROPA', 'aseo-hogar'],
  ['ACCESORIOS DE LIMPIEZA', 'aseo-hogar'],
  ['PASABOCAS', 'otros'],
  ['DULCERIA', 'otros'],
  ['ABARROTES', 'viveres'],
  ['GRANOS', 'viveres'],
  ['REPOSTERIA Y CONSERVAS', 'viveres'],
  ['BEBIDAS EN POLVO', 'viveres'],
  ['DESAYUNO', 'viveres'],
  ['PRODUCTOS SALUDABLES', 'viveres'],
  ['BEBIDAS Y PASABOCAS', 'otros'],
]

/**
 * `product_type` → bucket, only consulted when no tag answered. Free text
 * typed by hand over the years, hence the spellings. "Producto", "General"
 * and "" say nothing and are absent on purpose.
 */
const TYPE_AISLES: ReadonlyMap<string, Aisle> = new Map<string, Aisle>([
  ['MASCOTAS', 'mascotas'],
  ['PRODUCTOS PARA MASCOTAS Y ANIMALES', 'mascotas'],
  ['COMIDA PARA PERRO', 'mascotas'],

  ['LICORES', null],
  ['LICORES Y CIGARRILLOS', null],
  ['BEBIDAS ALCOHOLICAS', null],
  ['BELLEZA Y CUIDADO PERSONAL', null],
  ['CUIDADO PERSONAL', null],
  ['CUIDADO CAPILAR', null],
  ['CUIDADO', null],
  ['CEPILLOS DIENTES', null],
  ['SALUD Y BIENESTAR', null],
  ['PRODUCTOVITAMINAS, MINERALES Y NATURALES', null],

  ['CARNES, POLLO Y PESCADO', 'carnes'],
  ['CARNE Y POLLO', 'carnes'],
  ['CARNE', 'carnes'],
  ['FRUTAS Y VERDURAS', 'frutas-verduras'],
  ['VERDURAS PROCESADAS', 'frutas-verduras'],
  ['LACTEOS Y DERIVADOS', 'lacteos'],
  ['PANADERIA', 'panaderia'],
  ['CONGELADOS', 'congelados'],
  ['BEBES Y NINOS PEQUENOS', 'bebes'],
  ['BEBIDAS', 'bebidas'],
  ['GASEOSA', 'bebidas'],
  ['GASEOSAS', 'bebidas'],
  ['REFRESCO', 'bebidas'],
  ['REFRESCOS', 'bebidas'],
  ['JUGO', 'bebidas'],
  ['JUGUITO', 'bebidas'],
  ['SODA', 'bebidas'],
  ['ENERGIZANTE', 'bebidas'],
  ['ENERGIZANTES', 'bebidas'],
  ['ASEO', 'aseo-hogar'],
  ['ASEO Y ARTICULOS PARA EL HOGAR', 'aseo-hogar'],
  ['BEBIDAS Y SNACKS', 'otros'],
  ['BEBIDAS Y PASABOCAS', 'otros'],
  ['PASABOCAS', 'otros'],
  ['DESPENSA', 'viveres'],
  ['DESPENSAS', 'viveres'],
  ['DESAYUNO', 'viveres'],
  ['ALIMENTOS', 'viveres'],
  ['ABARROTES', 'viveres'],
  ['GRANOS', 'viveres'],
  ['REPOSTERIA Y CONSERVAS', 'viveres'],
  ['CAFE', 'viveres'],
  ['TE', 'viveres'],
  ['MUNDO SALUDABLE', 'viveres'],
  ['PRODUCTOS SALUDABLES', 'viveres'],
])

function normaliseLabel(text: string): string {
  // `normalise` strips the accents (ING-001); the tables above are uppercase.
  return normalise(text).toUpperCase().replace(/\s+/g, ' ').trim()
}

/** `undefined` = the source gave no usable aisle at all. */
export function supermuAisle(tags: readonly string[], productType: string): Aisle | undefined {
  const present = new Set(tags.map(normaliseLabel))
  for (const [tag, aisle] of TAG_AISLES) {
    if (present.has(tag)) return aisle
  }
  return TYPE_AISLES.get(normaliseLabel(productType))
}

// --- Price -----------------------------------------------------------------

/**
 * Shopify sends prices as decimal strings: "8290.00". Read as a whole number
 * of pesos, refusing anything with real cents or any other punctuation — a
 * "8.290" must never become 8.29 (the thousands-separator trap).
 *
 * `undefined` = malformed (the shape changed); `null` = zero or negative.
 */
export function parseShopifyPrice(value: unknown): number | null | undefined {
  if (typeof value !== 'string') return undefined
  const m = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (m === null) return undefined
  if (m[2] !== undefined && Number(m[2]) !== 0) return undefined
  return toCop(Number(m[1]))
}

// --- Measure ---------------------------------------------------------------

/** Supermú's unit spellings → words `extractMeasure` understands. */
const UNIT_WORDS: Record<string, string> = {
  G: 'g',
  GR: 'g',
  GRS: 'g',
  GRAMOS: 'g',
  KG: 'kg',
  KILO: 'kg',
  KILOS: 'kg',
  ML: 'ml',
  // The ERP truncates: "LECHE COLANTA 1000C", "AGUARDIENTE REAL 750M". Both
  // are only trusted as a volume under the conditions of `isBareVolume`.
  M: 'ml',
  C: 'ml',
  CC: 'ml',
  L: 'l',
  LT: 'l',
  LTS: 'l',
  U: 'un',
  UND: 'un',
  UNIDADES: 'un',
}

/**
 * Where "M" is metres, not ml: "PAPEL ALUMINIO HAAS 7M", "SEDA DENTAL 50M".
 * On these the token is dropped, never read as a volume.
 */
const ROLL_GOODS = /\b(PAPEL|ALUMINIO|SEDA|VINIPEL|CINTA)\b/i

/** The truncated spellings: a bare letter that could also be metres or cm. */
const BARE_UNITS: ReadonlySet<string> = new Set(['M', 'C'])

/** Aisles where everything measured is a liquid. */
const LIQUID_AISLES: ReadonlySet<string> = new Set(['bebidas', 'lacteos'])

/**
 * Aisles of things to eat or drink. Outside them — cleaning, pets, or no
 * aisle at all — a bare "M" is metres at any size: "TOALLA COCINA FAMILIA
 * 120M", "HILO 200M".
 */
const FOOD_AISLES: ReadonlySet<string> = new Set([
  'viveres',
  'lacteos',
  'carnes',
  'frutas-verduras',
  'panaderia',
  'bebidas',
  'congelados',
  'bebes',
  'otros',
])

/** Below this a bare "M" is as likely a length as a volume. */
const MIN_BARE_VOLUME = 100

/**
 * Whether a bare "M" / "C" can be read as ml / cc.
 *
 * A list of roll goods cannot hold: "TOALLA COCINA FAMILIA 80M" and "CUERDA
 * ROPA 10M" are metres too, and the next one will be something else. So the
 * rule is positive instead: the aisle is liquid, or it is a food aisle and
 * the number is one no food is sold by the metre at (750M, 1000C, 3000M).
 * Anything else yields no measure — a detergent "500M" included: the same
 * aisle sells kitchen towel by the metre.
 */
function isBareVolume(value: string, aisle: string | null | undefined): boolean {
  if (typeof aisle !== 'string') return false
  if (LIQUID_AISLES.has(aisle)) return true
  return FOOD_AISLES.has(aisle) && Number(value.replace(',', '.')) >= MIN_BARE_VOLUME
}

/**
 * A number and its unit, standing alone. The lookbehind refuses the tail of a
 * decimal the ERP split with a space — "CREMA SOPERA POLLO 42, 5G" is 42.5 g,
 * not 5 g — and of a pack like "3x75ml".
 */
const MEASURE_TOKEN = /(?<![\w.,]|\d[.,]\s)(\d+(?:[.,]\d+)?)\s?([A-Za-z]+)\b/g

const UNIT_ALTERNATION = Object.keys(UNIT_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|')

/**
 * Promotions and packs whose title does not say what the measure covers:
 * "JUGO NECTAR 200ML PAGUE 7 LLEVE 10" is ten 200 ml bottles; "3x75ml" three
 * tubes; "JABON REY X3 300G" three bars.
 *
 * The last branch is an "X" plus a number that is NOT itself the measure: the
 * closing word boundary refuses "PANELERA X 310GR" and the lookahead "PANELA
 * X 500 G". The number is taken whole, separator included, so "PANELA X 2.500
 * G" is not read as "X 2" followed by something else.
 *
 * Combos and word-form packs ("SIXPACK", "GRATIS", "120G + 90G") come from
 * `COMBO_MARKER`, shared with the other adapters.
 */
const MULTIPACK = new RegExp(
  String.raw`\b(?:LLEVE?|LLVE|LLV|PAGUE|PAG|PG)\b|\d\s*X\s*\d|\bX\s?\d+(?:[.,]\d+)?(?![.,\d])\b(?!\s(?:${UNIT_ALTERNATION})\b)`,
  'i',
)

/**
 * A whole number standing on its own right before the size: "ATUN VAN CAMPS 3
 * 160G" is three tins. It may also be part of a name ("SEVEN UP 7 400ML"),
 * and the title cannot tell which — so no measure either way.
 */
const BARE_COUNT_BEFORE = /(?<![\w.,/])\d+\s+$/

/** Above these a title is a typo ("JUGO HIT 1000L"), not a measure. */
const MAX_PLAUSIBLE: Record<string, number> = { g: 50_000, kg: 50, ml: 25_000, l: 25, un: 500 }

type ParsedMeasure = { measure: Measure; tokens: string[] } | null

/**
 * Reads the measure out of the title — and only when it is unambiguous.
 *
 * "LECHE COLANTA 6U 1100ML" is six bags of 1100 ml; "GALLETA TOSH 6U 144G" is
 * six packets making 144 g. The title alone cannot tell them apart, and
 * `grams` is 0 for most products, so a count next to a size yields null: a
 * wrong price-per-measure is worse than none.
 *
 * `aisle` is our source bucket (see `supermuAisle`); it only decides whether
 * a bare "M" / "C" may be a volume.
 */
export function supermuMeasure(title: string, aisle?: string | null): ParsedMeasure {
  if (MULTIPACK.test(title) || COMBO_MARKER.test(title)) return null

  const sizes: { text: string; word: string; value: string }[] = []
  const counts: { text: string; value: string }[] = []

  for (const match of title.matchAll(MEASURE_TOKEN)) {
    const unit = (match[2] ?? '').toUpperCase()
    if (unit === 'M' && ROLL_GOODS.test(title)) continue
    const word = UNIT_WORDS[unit]
    if (word === undefined) continue
    const value = match[1] ?? ''
    if (BARE_UNITS.has(unit) && !isBareVolume(value, aisle)) continue
    const entry = { text: match[0], word, value }
    if (word === 'un') {
      counts.push(entry)
      continue
    }
    if (BARE_COUNT_BEFORE.test(title.slice(0, match.index))) return null
    sizes.push(entry)
  }

  const only = sizes.length === 1 && counts.length === 0 ? sizes[0] : undefined
  const chosen = only ?? (sizes.length === 0 && counts.length === 1 ? counts[0] : undefined)
  if (chosen === undefined) return null

  const word = 'word' in chosen ? chosen.word : 'un'
  const measure = extractMeasure(`${chosen.value} ${word}`)
  if (measure === null) return null
  if (measure.value > (MAX_PLAUSIBLE[measure.measure] ?? Infinity)) return null

  return { measure, tokens: [chosen.text] }
}

// --- Name ------------------------------------------------------------------

/**
 * The ERP shouts. More uppercase than lowercase means the casing carries no
 * information, so it is lowered and the first letter put back; titles typed
 * by a person ("Crema Dental Colgate Total") are left as they came.
 */
export function tidyCase(text: string): string {
  const upper = (text.match(/\p{Lu}/gu) ?? []).length
  const lower = (text.match(/\p{Ll}/gu) ?? []).length
  return capitaliseFirst(upper > lower ? text.toLowerCase() : text)
}

// --- Adapter ---------------------------------------------------------------

export const supermuAdapter: StoreAdapter = {
  storeSlug: 'supermu',
  sourceType: 'api',
  // One price list for every store.
  regions: ['NACIONAL'],

  async *fetchCatalog(_region, ctx: FetchContext): AsyncIterable<RawProduct> {
    let yielded = 0
    let drops = 0

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      if (ctx.maxProducts !== undefined && yielded >= ctx.maxProducts) return
      if (page > 1) await sleep(ctx.delayMs)

      const url = `${BASE_URL}?limit=${PAGE_SIZE}&page=${page}`
      const result = await fetchJsonResult(url, ctx, { attempts: MAX_ATTEMPTS })

      if (result.kind !== 'ok') {
        // Already reported to the run by fetchJsonResult.
        drops += 1
        if (drops >= MAX_CONSECUTIVE_DROPS) return
        continue
      }
      drops = 0

      const products = readProducts(result.body)
      if (products === null) {
        ctx.onRequestDropped?.(url, 'respuesta sin "products"')
        return
      }
      if (products.length === 0) return

      for (const raw of products) {
        yield raw
        yielded += 1
        if (ctx.maxProducts !== undefined && yielded >= ctx.maxProducts) return
      }
    }
  },

  normalize: normalizeSupermuProduct,
}

function readProducts(body: unknown): RawProduct[] | null {
  if (typeof body !== 'object' || body === null || !('products' in body)) return null
  return Array.isArray(body.products) ? (body.products as RawProduct[]) : null
}

/**
 * `/products.json` sends `tags` as an array of strings (every record of the
 * fixture). Shopify's Admin API sends the same list as one comma-separated
 * string, so that documented shape is accepted too. Anything else — missing,
 * null, an object — is `null`: unreadable.
 */
function readTags(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === 'string')
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
  }
  return null
}

function normalizeSupermuProduct(raw: RawProduct): NormalizeResult {
  const product = raw as ShopifyProduct

  const externalId =
    typeof product.id === 'number' || typeof product.id === 'string'
      ? String(product.id).trim()
      : ''
  if (externalId.length === 0) return failed('sin id')

  const title = typeof product.title === 'string' ? product.title.trim() : ''
  if (title.length === 0) return failed('sin titulo')

  const variant = product.variants?.[0]
  if (variant === undefined) return failed('sin variantes')

  const priceCop = parseShopifyPrice(variant.price)
  if (priceCop === undefined) return failed(`precio ilegible: ${String(variant.price)}`)
  if (priceCop === null) return skipped('sin precio')

  // Scope before anything else: a whisky is not a broken record, just not ours.
  // `tags` is where the aisle lives. If it stops being a list the format
  // changed, and that has to count towards the abort threshold (ING-004):
  // read as "no tags" it would turn the whole catalogue into routine skips.
  const tags = readTags(product.tags)
  if (tags === null) return failed('tags ilegibles')
  const aisle = supermuAisle(
    tags,
    typeof product.product_type === 'string' ? product.product_type : '',
  )
  if (aisle === null) return skipped(OUT_OF_SCOPE)
  if (aisle === undefined) return skipped('sin pasillo en la fuente')

  // A malformed compare-at is not worth losing the product over.
  const compareCop = parseShopifyPrice(variant.compare_at_price ?? undefined) ?? null
  const listPriceCop = compareCop !== null && compareCop > priceCop ? compareCop : null

  const vendor = typeof product.vendor === 'string' ? product.vendor : null
  // "SUPERMU" is the house brand: keep it, the shopper buys it as a brand.
  const brand = tidyBrand(vendor)

  const parsedMeasure = supermuMeasure(title, aisle)
  // The measure is shown apart, as with Éxito; strip it from the name only
  // when it was understood — otherwise the title is the only place it lives.
  let nameSource = title
  if (parsedMeasure !== null) {
    for (const token of parsedMeasure.tokens) nameSource = nameSource.replace(token, ' ')
    // What hung off the measure: "MONDONGO ESPECIAL*500gr", "PANELERA X
    // 310GR", "NARANJA Aprox 5000gr".
    nameSource = nameSource.replace(/\*/g, ' ').replace(/(^|\s)(?:x|aprox\.?)(?=\s|$)/gi, ' ')
  }
  const cleaned = cleanProductName(nameSource, vendor)
  const name = tidyCase(cleaned.length > 0 ? cleaned : title)

  const measure = parsedMeasure?.measure ?? null
  const categorySlug = classifyProduct(name, aisle)

  const barcode = typeof variant.barcode === 'string' ? variant.barcode.trim() : ''
  const ean = /^\d{8,14}$/.test(barcode) ? barcode : null

  const image = product.images?.[0]?.src
  const parsed = normalizedProductSchema.safeParse({
    externalId,
    ean,
    name,
    brand,
    categorySlug,
    sourceBucket: aisle,
    unitKind: measure?.kind ?? 'unit',
    unitValue: measure?.value ?? null,
    unitMeasure: measure?.measure ?? null,
    imageUrl: typeof image === 'string' && image.length > 0 ? image : null,
    isAvailable: variant.available === true,
    priceCop,
    listPriceCop,
  })

  return parsed.success ? ok(parsed.data) : failed(parsed.error.issues[0]?.message ?? 'schema')
}

/** Shape of what Shopify returns. Only the parts we read. */
type ShopifyProduct = {
  id?: number | string
  title?: string
  vendor?: string
  product_type?: string
  tags?: unknown
  variants?: {
    price?: unknown
    compare_at_price?: unknown
    available?: boolean
    sku?: string
    barcode?: string | null
  }[]
  images?: { src?: string }[]
}
