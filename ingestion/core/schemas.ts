import { z } from 'zod'

/**
 * Canonical shape every adapter produces, whatever the source looks like.
 *
 * This is the ONLY module the app is allowed to read from `ingestion/` — it
 * shares the vocabulary, nothing else (rule 14 in CLAUDE.md).
 */

export const UNIT_KINDS = ['unit', 'weight', 'volume'] as const
export const UNIT_MEASURES = ['g', 'kg', 'ml', 'l', 'un'] as const

export type UnitKind = (typeof UNIT_KINDS)[number]
export type UnitMeasure = (typeof UNIT_MEASURES)[number]

export const normalizedProductSchema = z.object({
  /** SKU in the source store. Unique together with the store. */
  externalId: z.string().min(1),
  /** Barcode when published — the key to automatic cross-store equivalence. */
  ean: z
    .string()
    .regex(/^\d{8,14}$/)
    .nullable(),
  name: z.string().min(1),
  brand: z.string().min(1).nullable(),
  /** Slug in OUR taxonomy, not the store's. */
  categorySlug: z.string().min(1).nullable(),
  /**
   * The bucket the SOURCE filed this under, kept as provenance.
   *
   * It is what lets the classifier be re-run over the catalogue already in the
   * database instead of asking the store for it again: classification rules
   * change far more often than prices do, and a store owes us one visit a day,
   * not one per idea.
   */
  sourceBucket: z.string().min(1).nullable(),

  unitKind: z.enum(UNIT_KINDS),
  unitValue: z.number().positive().nullable(),
  unitMeasure: z.enum(UNIT_MEASURES).nullable(),

  imageUrl: z.string().url().nullable(),
  isAvailable: z.boolean(),

  /** Integer COP. The peso has no cents and floats lose money. */
  priceCop: z.number().int().positive(),
  listPriceCop: z.number().int().positive().nullable(),
})

export type NormalizedProduct = z.infer<typeof normalizedProductSchema>

/**
 * Either both measure fields or neither. A value without its unit produces a
 * bogus price-per-measure, which is worse than showing none
 * (docs/domain/02-ingestion.md).
 */
export const normalizedProductWithMeasureCheck = normalizedProductSchema.refine(
  (p) => (p.unitValue === null) === (p.unitMeasure === null),
  { message: 'unitValue y unitMeasure van juntos o no van' },
)
