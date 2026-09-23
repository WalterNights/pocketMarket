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
   *
   * Returns null for records that cannot be used. The pipeline counts those:
   * if too many come back null, the source changed format and the run aborts.
   */
  normalize(raw: RawProduct): NormalizedProduct | null
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
