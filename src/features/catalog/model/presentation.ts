import type { Product } from './product'

/**
 * How a product is sold, and therefore what "quantity 2" actually means.
 *
 * A carton of 30 eggs and a dozen are different presentations of the same
 * food: picking "2" must read as "2 cartones" or "2 docenas", never as a bare
 * number. Stores sell fixed presentations, so each one is its own
 * store_product with its own price — the job here is naming it in the user's
 * words (docs/domain/00-overview.md).
 *
 * Pure module: no React, no network (rule 3).
 */

export type Presentation = {
  /** "cartón", "paquete", "botella"… */
  singular: string
  plural: string
  /** Full label including the measure: "Cartón x 30", "Paquete 500 g". */
  label: string
}

/** Lowercase and strip accents so "Plátano" matches "platano". */
const COMBINING_MARKS = new RegExp('[̀-ͯ]', 'g')

function normalise(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
}

/** Containers keyed by a word in the product name. First match wins. */
const CONTAINER_KEYWORDS: readonly (readonly [string, [string, string]])[] = [
  ['leche', ['bolsa', 'bolsas']],
  ['aceite', ['botella', 'botellas']],
  ['gaseosa', ['botella', 'botellas']],
  ['jugo', ['botella', 'botellas']],
  ['agua', ['botella', 'botellas']],
  ['vino', ['botella', 'botellas']],
  ['cerveza', ['lata', 'latas']],
  ['atun', ['lata', 'latas']],
  ['yogur', ['vaso', 'vasos']],
]

const MEASURE_LABELS: Record<string, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  un: 'un',
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * Formats the measure the way a shopper reads it: 1000 g becomes 1 kg, and
 * trailing zeros go away (500.000 g is not how anyone writes half a kilo).
 */
export function formatMeasure(value: number, measure: string): string {
  if (measure === 'g' && value >= 1000) return `${trimZeros(value / 1000)} kg`
  if (measure === 'ml' && value >= 1000) return `${trimZeros(value / 1000)} L`
  return `${trimZeros(value)} ${MEASURE_LABELS[measure] ?? measure}`
}

function trimZeros(value: number): string {
  return Number(value.toFixed(3)).toString().replace('.', ',')
}

/**
 * Names the presentation of a product.
 *
 * Eggs are the case that motivated this: 30 is a cartón, 12 a docena, 6 a
 * panal. Getting that wrong makes the quantity picker read as nonsense.
 */
export function presentationOf(product: Product): Presentation {
  const name = normalise(product.name)
  const { unitKind, unitValue, unitMeasure } = product

  if (name.includes('huevo') && unitValue !== null) {
    if (unitValue >= 24) return withLabel('cartón', 'cartones', `x ${unitValue}`)
    if (unitValue === 12) return withLabel('docena', 'docenas', '')
    if (unitValue === 6) return withLabel('media docena', 'medias docenas', '')
    return withLabel('panal', 'panales', `x ${unitValue}`)
  }

  for (const [keyword, [singular, plural]] of CONTAINER_KEYWORDS) {
    if (name.includes(keyword)) {
      return withLabel(singular, plural, measureSuffix(unitValue, unitMeasure))
    }
  }

  if (unitKind === 'unit') {
    if (unitValue !== null && unitValue > 1) {
      return withLabel('paquete', 'paquetes', `x ${unitValue}`)
    }
    return withLabel('unidad', 'unidades', '')
  }

  if (unitKind === 'volume') {
    return withLabel('envase', 'envases', measureSuffix(unitValue, unitMeasure))
  }

  return withLabel('paquete', 'paquetes', measureSuffix(unitValue, unitMeasure))
}

function measureSuffix(unitValue: number | null, unitMeasure: string | null): string {
  if (unitValue === null || unitMeasure === null) return ''
  return formatMeasure(unitValue, unitMeasure)
}

function withLabel(singular: string, plural: string, suffix: string): Presentation {
  const label = suffix.length > 0 ? `${capitalise(singular)} ${suffix}` : capitalise(singular)
  return { singular, plural, label }
}

/** "1 cartón", "2 cartones" — the unit always spelled out, never a bare number. */
export function formatQuantity(product: Product, quantity: number): string {
  const { singular, plural } = presentationOf(product)
  return `${trimZeros(quantity)} ${quantity === 1 ? singular : plural}`
}

export const MIN_QUANTITY = 1
export const MAX_QUANTITY = 99

/**
 * Step for the quantity picker. Packaged goods move in whole units: you cannot
 * buy half a carton. Bulk goods (sold by loose weight) would step by 0.1, but
 * no source publishes them yet — when one does, this is where it changes.
 */
export function quantityStep(_product: Product): number {
  return 1
}

export function clampQuantity(quantity: number): number {
  if (Number.isNaN(quantity)) return MIN_QUANTITY
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, quantity))
}

/**
 * Total content across the chosen quantity: 2 cartons of 30 is 60 eggs, 3
 * packets of 500 g is 1,5 kg. Shown so the user sees what they are actually
 * taking home, not just how many boxes.
 */
export function totalContentOf(product: Product, quantity: number): string | null {
  const { unitValue, unitMeasure } = product
  if (unitValue === null || unitMeasure === null) return null
  if (quantity <= 1) return null

  return formatMeasure(unitValue * quantity, unitMeasure)
}
