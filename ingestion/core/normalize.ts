import type { UnitKind, UnitMeasure } from './schemas'

/**
 * Normalisation helpers shared by every adapter.
 *
 * Pure functions: raw string in, canonical value out. No network, no database.
 * This is where the bulk of the ingestion tests live, because this is where
 * the data actually gets mangled.
 */

export type Measure = {
  value: number
  measure: UnitMeasure
  kind: UnitKind
}

/** Source spellings mapped to our canonical units. */
const MEASURE_ALIASES: Record<string, UnitMeasure> = {
  g: 'g',
  gr: 'g',
  grs: 'g',
  gramo: 'g',
  gramos: 'g',
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  ml: 'ml',
  mls: 'ml',
  cc: 'ml',
  l: 'l',
  lt: 'l',
  lts: 'l',
  litro: 'l',
  litros: 'l',
  un: 'un',
  und: 'un',
  uds: 'un',
  unid: 'un',
  unidad: 'un',
  unidades: 'un',
}

const KIND_OF: Record<UnitMeasure, UnitKind> = {
  g: 'weight',
  kg: 'weight',
  ml: 'volume',
  l: 'volume',
  un: 'unit',
}

/**
 * Pulls the measure out of the product name.
 *
 * Éxito puts it there and nowhere else: `measurementUnit` always says "un" and
 * `unitMultiplier` always 1.0, so both fields are useless. Real examples:
 *
 *   "Pastas DORIA spaghetti clásico (1000  gr)"   -> 1000 g
 *   "Sal REFISAL alta pureza  (1000  gr)"         -> 1000 g   (double space)
 *   "Lomitos de atún FRESCAMPO en agua (110.5 gr)"-> 110.5 g  (decimal)
 *
 * Returns null when there is nothing trustworthy to read. Never guesses: an
 * invented measure produces a false unit price.
 */
export function extractMeasure(name: string): Measure | null {
  // Last parenthesised group wins: "Café (descafeinado) (500 gr)".
  const matches = [...name.matchAll(/\(([^)]*)\)/g)]
  for (const match of matches.reverse()) {
    const parsed = parseMeasureText(match[1] ?? '', name.slice(0, match.index))
    // The name announced a measure we cannot trust; looking elsewhere in the
    // same name for another one would be guessing.
    if (parsed === UNTRUSTED) return null
    if (parsed !== null) return parsed
  }

  // Some names carry it loose at the end: "Arroz Diana x 500g".
  const loose = parseMeasureText(name, '')
  return loose === UNTRUSTED ? null : loose
}

/** A measure is written there, but reading it would be a guess. */
const UNTRUSTED = 'untrusted'

/**
 * Units small enough that a four-digit quantity is ordinary: 2500 g, 3000 ml.
 * What counts is the unit AS WRITTEN, before anything is converted.
 */
const SMALL_UNITS: ReadonlySet<UnitMeasure> = new Set(['g', 'ml', 'un'])

/**
 * Reads the number once the unit is known, because the separator means
 * different things next to different units.
 *
 * Colombian names use the dot as the thousands separator ("ARROZ 2.500 G",
 * "Aceite 3.000 Ml"), while Éxito also writes decimals with a dot ("110.5
 * gr"). Next to a SMALL unit, a dot followed by exactly three digits after a
 * non-zero integer part is thousands. Next to kg or l it is a decimal: "Pollo
 * 1.200 Kg" is a chicken of 1.2 kg, not 1.2 tonnes.
 *
 * A comma is the decimal mark ("1,1 L"), with one exception: "1,000 g" could be
 * one gram written with three decimals or a thousand written the English way.
 * Nothing in the name settles it, so it is not read at all.
 */
function measureNumber(text: string, measure: UnitMeasure): number | null {
  if (SMALL_UNITS.has(measure)) {
    if (/^[1-9]\d{0,2}\.\d{3}$/.test(text)) return Number(text.replace('.', ''))
    if (/^[1-9]\d{0,2},\d{3}$/.test(text)) return null
  }
  return Number(text.replace(',', '.'))
}

/**
 * A pack count in front of the measure: "6 x 330 ml", "x6 330 ml", "3 Latas
 * 160 G", "3 Und 125 G". The measure that follows is the size of ONE unit, not
 * of what is being sold, and a unit price built on it is several times too
 * high. "x 500g" is not a pack: the x is followed by the measure itself.
 */
const PACK_COUNT_BEFORE = new RegExp(
  [
    // "6 x" right before the size, and "x6" / "x 6" anywhere before it
    '\\d\\s*x\\s*$',
    '(?:^|[\\s\\d])x\\s*\\d',
    // "3 latas", "12 und", "6 pack"
    '(?:^|\\D)\\d+\\s*(?:und|unds|uds|un|unid|unidad|unidades|latas?|packs?|pacas?|sobres?|bolsas?|botellas?)\\b',
  ].join('|'),
  String.raw`i`,
)

const UNIT_WORD = Object.keys(MEASURE_ALIASES).join('|')

/**
 * Words that say the price covers several things, wherever they stand in the
 * name: "Leche entera six pack (900 ml)" is six cartons, "Endulzante 100 G +
 * Gratis 50 G" is 150 g, "Combo Mortadela 250 G + Salchichón 250 G" is two
 * products. The measure that can be read is the size of one piece.
 *
 * Only the pack words that count ("six", "tri", "dúo"...) are here: "doy
 * pack", "econopack" and a bare "pack" describe the packaging, not a count.
 * "Kit Kat" is a chocolate bar.
 *
 * A "+" marks a combo only when a quantity leads into it — "330 G + Fresa 80
 * G", "135G+FRES 80G", "400+RAST 400ML". On its own it is part of the name:
 * "Arroz Vita+ 5 Kg", "Detergente Bicarbonato + Manzana 1000 G", "Protector
 * Solar FPS 50+ 177ml", "Alimento Lácteo 1+ 252 Gr".
 *
 * Exported so an adapter with its own title parser can apply the same words.
 */
export const COMBO_MARKER = new RegExp(
  [
    String.raw`\b(?:gratis|combo|pague|lleve)\b`,
    String.raw`\bkit\b(?!\s*-?\s*kat)`,
    String.raw`\b(?:six|four|tri|bi|duo|dúo|twin|multi)\s*-?\s*pack`,
    String.raw`\d\s*(?:${UNIT_WORD})\s*\+`,
    String.raw`\d\+(?=\S)`,
  ].join('|'),
  'i',
)

/** "Ambientador Unidad + 1 repuesto 9g": a "+" introducing another quantity. */
const PLUS_COUNT_BEFORE = /\+\s*\d/

/**
 * What stands right before the number shows it is not the size of the product:
 *
 * - a bare number of one or two digits — "Cafe 2 500 g", "Arena 4 5 Kg",
 *   "Atun 3 160 G": a count, a split decimal or a thousands gap, and the name
 *   cannot tell which. Longer ones are names ("Queso 1923 250g", "Arroz 151 3
 *   Kg"), and so are "#5", "T-5" and "3 en 1";
 * - a fraction or a decimal split by a space — "Arroz 1/2 kg", "42, 5G";
 * - a range — "Langostino 16-20 Kg", "Perros de 4 a 8 Kg", "20Kg a 40Kg";
 * - a bound — "Gatos hasta 2.5Kg".
 */
const NOT_A_SIZE_BEFORE = new RegExp(
  [
    String.raw`(?<![\p{L}\d_.,/#°º-])(?<!#\s+)(?<!\d\s+en\s+)\d{1,2}\s+$`,
    String.raw`\d\s*/\s*$`,
    String.raw`\d\s*(?:(?:${UNIT_WORD})\s*)?(?:-|–|\ba)\s*$`,
    String.raw`\b(?:hasta|desde|m[aá]s\s+de|menos\s+de)\s+$`,
  ].join('|'),
  'iu',
)

/**
 * Another measure right before this one. Two of the same kind is a range or a
 * pair ("Perro 20Kg 40Kg") and neither can be trusted; of different kinds
 * they describe one product twice ("Té Durazno 2L 12G" is 12 g of powder that
 * makes two litres).
 */
const MEASURE_BEFORE = new RegExp(String.raw`\d\s*(${UNIT_WORD})\s+$`, 'i')

const SPLIT_DECIMAL_BEFORE = /\d[.,]\s+$/

function sameKindBefore(before: string, measure: UnitMeasure): boolean {
  const previous = MEASURE_ALIASES[(before.match(MEASURE_BEFORE)?.[1] ?? '').toLowerCase()]
  return previous !== undefined && KIND_OF[previous] === KIND_OF[measure]
}

/**
 * Flea and worm treatments are sold by the weight of the ANIMAL: "Bravecto
 * 40Kg" and "Credelio Perros 3Tab 45 kg" are one tablet for a 45 kg dog.
 */
const PET_DOSE =
  /\b(?:antipulgas|antiparasitari[oa]s?|desparasitantes?|garrapatas|bravecto|simparica|credelio|nexgard|advocate|comprimidos?|masticables?|pipetas?)\b|\d\s*tab(?:s|letas?)?\b/i

/**
 * What a single grocery item can plausibly measure, in base units (g, ml,
 * un). Outside it the source made a typo — "Menú Especial 1069 Kg",
 * "Blanqueador 3800 Lt", "Yogurt Líquido 1,75 G", "Pan Artesano 1 gr" — and a
 * unit price built on it is off by orders of magnitude.
 *
 * Checked against the catalogue (2026-10-05): the smallest real ones are
 * spices of 4 g and a 3,2 ml pipette; the largest a 30 kg sack of dog food and
 * a 20 l water jug.
 */
const PLAUSIBLE: Record<UnitKind, readonly [min: number, max: number]> = {
  weight: [3, 50_000],
  volume: [3, 25_000],
  unit: [1, 2_000],
}

const TO_BASE: Record<UnitMeasure, number> = { g: 1, kg: 1000, ml: 1, l: 1000, un: 1 }

function isPlausible(value: number, measure: UnitMeasure): boolean {
  const [min, max] = PLAUSIBLE[KIND_OF[measure]]
  const base = value * TO_BASE[measure]
  return base >= min && base <= max
}

/**
 * `lead` is whatever the name says before the text being read (the part in
 * front of a parenthesis): it cannot hold the measure, but it can say the
 * measure is not to be trusted.
 */
function parseMeasureText(text: string, lead: string): Measure | typeof UNTRUSTED | null {
  // Number, optional whitespace, unit word. Handles "1000  gr" and "500g".
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*([a-zA-Zñ]+)\s*$/)
  if (m === null) return null

  const rawUnit = (m[2] ?? '').toLowerCase()
  const measure = MEASURE_ALIASES[rawUnit]
  if (measure === undefined) return null

  const before = text.slice(0, m.index ?? 0)
  const context = `${lead} ${before}`
  if (PACK_COUNT_BEFORE.test(before) || NOT_A_SIZE_BEFORE.test(before)) return UNTRUSTED
  if (sameKindBefore(before, measure)) return UNTRUSTED
  // "42, 5G" is 42,5 g. Three digits after the gap are a size of their own:
  // "Lavaplatos 7 en 1, 750 mL".
  if (SPLIT_DECIMAL_BEFORE.test(before) && /^\d{1,2}$/.test(m[1] ?? '')) return UNTRUSTED
  if (COMBO_MARKER.test(context) || PLUS_COUNT_BEFORE.test(context)) return UNTRUSTED
  if (measure === 'kg' && PET_DOSE.test(`${lead} ${text}`)) return UNTRUSTED

  const value = measureNumber(m[1] ?? '', measure)
  if (value === null) return UNTRUSTED
  if (!Number.isFinite(value) || value <= 0) return null
  if (!isPlausible(value, measure)) return UNTRUSTED

  return { value, measure, kind: KIND_OF[measure] }
}

/**
 * Words that say how a product is packed or how much of it there is, never
 * what it is. A name left with only these after the brand is removed has lost
 * its product: "HALLS TUBO SURTIDO" is not a "Tubo surtido".
 */
const FILLER_WORDS: ReadonlySet<string> = new Set([
  String.raw`x`,
  String.raw`und`,
  String.raw`unds`,
  String.raw`un`,
  String.raw`unidad`,
  String.raw`unidades`,
  String.raw`aprox`,
  String.raw`pack`,
  String.raw`paca`,
  String.raw`tubo`,
  String.raw`bolsa`,
  String.raw`sobre`,
  String.raw`caja`,
  String.raw`frasco`,
  String.raw`lata`,
  String.raw`botella`,
  String.raw`tarro`,
  String.raw`display`,
  String.raw`surtido`,
  String.raw`surtida`,
  String.raw`surtidos`,
  String.raw`surtidas`,
  String.raw`de`,
  String.raw`del`,
  String.raw`la`,
  String.raw`el`,
  String.raw`los`,
  String.raw`las`,
  String.raw`y`,
  String.raw`con`,
  String.raw`en`,
  String.raw`por`,
])

/** A token that is a number or a measure: "90", "16G", "640g", "x8", "2.500". */
const MEASURE_TOKEN = /^(?:x?\d+(?:[.,]\d+)?[a-zñ]*|[a-z]{1,3}\d+)$/i

function hasProductWord(text: string): boolean {
  return text
    .split(/\s+/)
    .map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
    .some((w) => w.length > 0 && /\p{L}/u.test(w) && !MEASURE_TOKEN.test(w) && !FILLER_WORDS.has(w))
}

/**
 * Strips the brand and the measure out of the display name.
 *
 * The source repeats the brand inside the name in caps ("Pastas DORIA
 * spaghetti"), and the row already shows it underneath — leaving it in makes
 * the UI say it twice.
 *
 * Except when the brand IS the product. Colombian retail names the generic
 * noun first and the brand after it ("Arroz Diana", "Pastas DORIA"); a name
 * that OPENS with the brand is one where the brand is the noun: "Maizena 90 G",
 * "HALLS TUBO SURTIDO", "TRIGUISAR 16G LA GRAN COCINA". Removing it there
 * leaves "90 G", "Tubo surtido" or the manufacturer's line. The same goes for
 * any name where the brand was the only real word. In both cases the brand
 * stays: saying it twice is a cosmetic flaw, losing the product is not.
 */
export function cleanProductName(rawName: string, brand: string | null): string {
  // Drop every parenthesised group: they hold the measure, never the name.
  const name = rawName
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (brand === null || brand.trim().length === 0) return name

  const escaped = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Whitespace boundaries, not \b: a brand ending in a symbol ("H2O+") has
  // no word boundary after it, so \b would never match there.
  const brandPattern = new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'gi')

  const opensWithBrand = new RegExp(`^${escaped}(?=\\s|$)`, 'i').test(name)
  const stripped = name.replace(brandPattern, ' ').replace(/\s+/g, ' ').trim()

  if (opensWithBrand || !hasProductWord(stripped)) return name
  return stripped
}

/**
 * Source prices arrive as floats (39990.0, 14407.0). Rounds to integer COP:
 * the peso has no cents, and floats in money are a design error.
 *
 * Returns null for anything not a usable price, so the caller can discard the
 * item rather than write a zero.
 */
export function toCop(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : null
}

/**
 * Values the source puts in the brand field when there is no brand: "Sin
 * Marca", "Sin Marca 2", "sin marca.", "Generico" (924 products at Éxito),
 * "NA", "No Aplica", "-", or a number with separators ("20.09") leaked from an
 * ERP column. Shown under the product they read as a brand called "Sin Marca".
 * A plain integer is NOT a placeholder: "1800" is a tequila.
 */
const PLACEHOLDER_BRAND =
  /^(?:sin\s+marca(?:\s+\d+)?\.?|gen[eé]ric[oa]s?\.?|no\s+aplica|n\.?\/?a\.?|-+|\d+(?:[.,/-]\d+)+)$/i

/** Title case for names that arrive shouting. Placeholders are no brand. */
export function tidyBrand(brand: string | null | undefined): string | null {
  if (typeof brand !== 'string') return null
  const trimmed = brand.trim()
  if (trimmed.length === 0 || PLACEHOLDER_BRAND.test(trimmed)) return null

  return trimmed
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** First letter up, rest untouched: the source already varies its casing. */
export function capitaliseFirst(text: string): string {
  if (text.length === 0) return text
  return text.charAt(0).toUpperCase() + text.slice(1)
}
