import { z } from 'zod'

import type { FetchContext } from './types'

/**
 * Contract for a chain's BRANCH source — where its shops are. A different
 * shape from StoreAdapter: no prices, no regions, no snapshots, and it runs
 * monthly, not daily (docs/plans/0001-mapa-de-tiendas.md).
 */

export type RawBranch = Record<string, unknown>

export const normalizedBranchSchema = z.object({
  /** Stable id within the chain, so a reload updates instead of duplicating. */
  externalId: z.string().min(1),
  name: z.string().min(1),
  address: z.string().nullable(),
  city: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
})

export type NormalizedBranch = z.infer<typeof normalizedBranchSchema>

/**
 * Same three outcomes as products, for the same reason (ING-004): `skipped`
 * is routine — a pickup point that is not a shop — and `failed` means the
 * source's format changed. Only `failed` counts toward the abort threshold.
 */
export type BranchNormalizeResult =
  | { status: 'ok'; branch: NormalizedBranch }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string }

export const okBranch = (branch: NormalizedBranch): BranchNormalizeResult => ({
  status: 'ok',
  branch,
})

export type BranchFetchContext = Omit<FetchContext, 'maxProducts'> & {
  /**
   * A grid point whose results hit the source's cap: there may be shops near
   * it that were never returned, so the grid is too coarse there.
   */
  onSaturated?: (pointLabel: string) => void
}

export interface BranchAdapter {
  /** Matches `store.slug`. */
  readonly storeSlug: string
  /** Async iterable: grid sweeps return many overlapping pages. */
  fetchBranches(ctx: BranchFetchContext): AsyncIterable<RawBranch>
  /** PURE: raw record → canonical branch. Tested against saved fixtures. */
  normalize(raw: RawBranch): BranchNormalizeResult
}

/**
 * Colombia's bounding box, mainland plus San Andrés. A coordinate outside it
 * is a source error, the branch equivalent of an absurd price.
 *
 * MUST match the CHECK constraint `store_branch_in_colombia` in
 * supabase/migrations/20261004000000_store_branches.sql: rows that fail here
 * are counted instead of failing the whole batch there.
 */
export const COLOMBIA_BBOX = {
  minLatitude: -4.3,
  maxLatitude: 13.6,
  minLongitude: -82.0,
  maxLongitude: -66.8,
} as const

export function isInColombia(latitude: number, longitude: number): boolean {
  return (
    latitude >= COLOMBIA_BBOX.minLatitude &&
    latitude <= COLOMBIA_BBOX.maxLatitude &&
    longitude >= COLOMBIA_BBOX.minLongitude &&
    longitude <= COLOMBIA_BBOX.maxLongitude
  )
}

/** "BOGOTA, D.C." / "Bogotá D.C." / "bogota" → "Bogotá"-style title case, accents kept. */
export function tidyName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
}
