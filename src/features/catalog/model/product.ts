import { z } from 'zod'

/**
 * Domain model for the catalogue. Pure: no React, no network, no platform
 * (rule 3 in CLAUDE.md). Everything here is testable without rendering or
 * mocking anything.
 */

export const UNIT_KINDS = ['unit', 'weight', 'volume'] as const
export const UNIT_MEASURES = ['g', 'kg', 'ml', 'l', 'un'] as const

export type UnitKind = (typeof UNIT_KINDS)[number]
export type UnitMeasure = (typeof UNIT_MEASURES)[number]

/**
 * Validated at the repository boundary. The generated database types describe
 * the schema, not what actually arrived: a migration applied without
 * regenerating them makes TypeScript confidently wrong.
 */
export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().nullable(),
  storeSlug: z.string().min(1),
  storeName: z.string().min(1),
  categorySlug: z.string().nullable(),
  unitKind: z.enum(UNIT_KINDS),
  unitValue: z.number().positive().nullable(),
  unitMeasure: z.enum(UNIT_MEASURES).nullable(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  // Colombian peso has no cents. Integer, never float (rule 15).
  priceCop: z.number().int().positive(),
})

export type Product = z.infer<typeof productSchema>

/**
 * Price normalised to a comparable amount of measure.
 *
 * This is what makes comparing a hard discounter against a national brand
 * honest: 500 g of rice at $4.200 is dearer than 1 kg at $7.800, and without
 * normalising the app would mislead the user.
 *
 * Returns null when the source did not publish a usable measure — a made-up
 * unit price is worse than none at all.
 */
export type UnitPrice = {
  /** Cost in COP for `perAmount` of `measure`. */
  amountCop: number
  perAmount: number
  measure: BaseMeasure
}

/** Measures we normalise to. kg collapses to g, l collapses to ml. */
export type BaseMeasure = Extract<UnitMeasure, 'g' | 'ml' | 'un'>

const BASE_MEASURE: Record<UnitMeasure, BaseMeasure> = {
  g: 'g',
  kg: 'g',
  ml: 'ml',
  l: 'ml',
  un: 'un',
}

const TO_BASE_FACTOR: Record<UnitMeasure, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  un: 1,
}

/** How much of the base measure we quote the price for. */
const REFERENCE_AMOUNT: Record<BaseMeasure, number> = {
  g: 100,
  ml: 100,
  un: 1,
}

export function unitPriceOf(product: Product): UnitPrice | null {
  const { unitValue, unitMeasure, priceCop } = product
  if (unitValue === null || unitMeasure === null) return null

  const base = BASE_MEASURE[unitMeasure]
  const amountInBase = unitValue * TO_BASE_FACTOR[unitMeasure]
  if (amountInBase <= 0) return null

  const reference = REFERENCE_AMOUNT[base]
  const amountCop = Math.round((priceCop / amountInBase) * reference)

  return { amountCop, perAmount: reference, measure: base }
}

/**
 * Change between the price frozen when the product was added to a list and the
 * current one. `direction` exists so the UI never relies on colour alone to
 * carry the signal (06-design-system.md).
 */
export type PriceChange = {
  deltaCop: number
  direction: 'up' | 'down' | 'same'
  /** Positive percentage, rounded. */
  percent: number
}

export function priceChangeOf(previousCop: number, currentCop: number): PriceChange {
  const deltaCop = currentCop - previousCop
  if (deltaCop === 0 || previousCop <= 0) {
    return { deltaCop: 0, direction: 'same', percent: 0 }
  }

  return {
    deltaCop,
    direction: deltaCop > 0 ? 'up' : 'down',
    percent: Math.round((Math.abs(deltaCop) / previousCop) * 100),
  }
}
