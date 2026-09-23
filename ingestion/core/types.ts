import type { NormalizedProduct } from './schemas'

/**
 * Contract every store adapter implements. Adding a store means writing one of
 * these — nothing in `core/` or in the app changes
 * (docs/domain/02-ingestion.md).
 */

export type RegionCode = string
export type SourceType = 'api' | 'scraper' | 'manual'

/** Whatever the source hands back, before normalisation. */
export type RawProduct = Record<string, unknown>

export type FetchContext = {
  /** Identifies us to the source, with a way to get in touch. */
  userAgent: string
  /** Pause between requests, in ms. Adapters must honour it. */
  delayMs: number
  /** Stop early — used by tests and by the run's own limits. */
  maxProducts?: number
  signal?: AbortSignal
}

export interface StoreAdapter {
  /** Matches `store.slug` in the database. */
  readonly storeSlug: string
  readonly sourceType: SourceType
  /** Regions this source publishes prices for. */
  readonly regions: RegionCode[]

  /**
   * Walks the catalogue.
   *
   * Async iterable, never an array: Éxito's catalogue runs to tens of
   * thousands of SKUs and loading it into memory is a guaranteed failure.
   */
  fetchCatalog(region: RegionCode, ctx: FetchContext): AsyncIterable<RawProduct>

  /**
   * Raw source record to canonical shape. PURE — no network, no state — so it
   * can be tested against saved fixtures with no connection.
   */
  normalize(raw: RawProduct): NormalizeResult
}

/**
 * Two ways a record can fail to become a product, and conflating them makes the
 * abort threshold meaningless.
 *
 * `skipped` is routine: an out-of-stock item has Price 0 and is simply not for
 * sale today. Deep pages are full of them — Éxito's "Comidas preparadas"
 * returns 32% — and that says nothing about the format.
 *
 * `failed` is the alarm: the record had a shape we could not read. THAT is what
 * the 20% ceiling watches, because it means the source changed.
 */
export type NormalizeResult =
  | { status: 'ok'; product: NormalizedProduct }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export const ok = (product: NormalizedProduct): NormalizeResult => ({ status: 'ok', product })
export const skipped = (reason: string): NormalizeResult => ({ status: 'skipped', reason })
export const failed = (reason: string): NormalizeResult => ({ status: 'failed', reason })

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
