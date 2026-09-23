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
    const parsed = parseMeasureText(match[1] ?? '')
    if (parsed !== null) return parsed
  }

  // Some names carry it loose at the end: "Arroz Diana x 500g".
  return parseMeasureText(name)
}

function parseMeasureText(text: string): Measure | null {
  // Number, optional whitespace, unit word. Handles "1000  gr" and "500g".
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*([a-zA-Zñ]+)\s*$/)
  if (m === null) return null

  const rawValue = (m[1] ?? '').replace(',', '.')
  const rawUnit = (m[2] ?? '').toLowerCase()

  const measure = MEASURE_ALIASES[rawUnit]
  if (measure === undefined) return null

  const value = Number(rawValue)
  if (!Number.isFinite(value) || value <= 0) return null

  return { value, measure, kind: KIND_OF[measure] }
}

/**
 * Strips the brand and the measure out of the display name.
 *
 * The source repeats the brand inside the name in caps ("Pastas DORIA
 * spaghetti"), and the row already shows it underneath — leaving it in makes
 * the UI say it twice.
 */
export function cleanProductName(rawName: string, brand: string | null): string {
  let name = rawName

  // Drop every parenthesised group: they hold the measure, never the name.
  name = name.replace(/\([^)]*\)/g, ' ')

  if (brand !== null && brand.trim().length > 0) {
    const escaped = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Whitespace boundaries, not \b: a brand ending in a symbol ("H2O+") has
    // no word boundary after it, so \b would never match there.
    name = name.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'gi'), ' ')
  }

  return name.replace(/\s+/g, ' ').trim()
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

/** Title case for names that arrive shouting. */
export function tidyBrand(brand: string | null | undefined): string | null {
  if (typeof brand !== 'string') return null
  const trimmed = brand.trim()
  if (trimmed.length === 0) return null

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
