import { createClient } from '@supabase/supabase-js'

import {
  normalizedBranchSchema,
  type BranchAdapter,
  type BranchFetchContext,
  type BranchNormalizeResult,
  type NormalizedBranch,
} from './branch-types'
import { mayRetire } from './retirement'

// Re-exported: the branch tests and runner read them from here.
export { MAX_RETIRE_RATIO, mayRetire } from './retirement'

/**
 * Branch run: fetch → normalise → dedupe → upsert → retire what vanished.
 * Monthly, separate from the daily price run (plan 0001).
 */

/** Same ceiling as prices: more unreadable records than this means the source changed. */
export const MAX_FAILED_RATIO = 0.2

export type BranchCollection = {
  branches: NormalizedBranch[]
  seen: number
  skipped: number
  failed: number
  duplicates: number
  skipReasons: Record<string, number>
}

/**
 * PURE: the results of normalize() in, the branches to write out. The same
 * shop arrives several times from overlapping grid points (and twice per shop
 * from Éxito); the first sighting wins.
 */
export function collectBranches(results: Iterable<BranchNormalizeResult>): BranchCollection {
  const byId = new Map<string, NormalizedBranch>()
  const collection: BranchCollection = {
    branches: [],
    seen: 0,
    skipped: 0,
    failed: 0,
    duplicates: 0,
    skipReasons: {},
  }

  for (const result of results) {
    collection.seen += 1

    if (result.status === 'skipped') {
      collection.skipped += 1
      collection.skipReasons[result.reason] = (collection.skipReasons[result.reason] ?? 0) + 1
      continue
    }

    const parsed = result.status === 'ok' ? normalizedBranchSchema.safeParse(result.branch) : null
    if (parsed === null || !parsed.success) {
      collection.failed += 1
      continue
    }

    if (byId.has(parsed.data.externalId)) {
      collection.duplicates += 1
      continue
    }
    byId.set(parsed.data.externalId, parsed.data)
  }

  collection.branches = [...byId.values()]
  return collection
}

/** PURE: should this run abort instead of writing? Null when it may proceed. */
export function abortReason(collection: BranchCollection): string | null {
  if (collection.seen === 0) return 'la fuente no devolvio nada'
  const ratio = collection.failed / collection.seen
  if (ratio > MAX_FAILED_RATIO) {
    return `${Math.round(ratio * 100)}% ilegibles: la fuente cambio de formato`
  }
  return null
}

export type BranchRunReport = BranchCollection & {
  storeSlug: string
  written: number
  retired: number
  /** Why retirement did not run, or null if it ran (or nothing was missing). */
  retireSkipped: string | null
  /** Source requests given up on. Above 0 the sweep has holes. */
  requestsDropped: number
  /** Grid points that hit the source's result cap: the grid is too coarse there. */
  saturatedPoints: string[]
  aborted: boolean
  abortReason: string | null
  durationMs: number
}

export type BranchRunOptions = BranchFetchContext & {
  supabaseUrl: string
  serviceRoleKey: string
  dryRun: boolean
}

/**
 * PURE: why shops missing from this run must NOT be retired, or null when
 * they may be. A sweep with a dropped request did not look everywhere, so a
 * shop missing from it may simply be behind the hole.
 */
export function branchRetireSkipReason(input: {
  requestsDropped: number
  found: number
  missing: number
}): string | null {
  if (input.requestsDropped > 0) {
    return `${input.requestsDropped} peticiones descartadas: el barrido tiene huecos`
  }
  if (!mayRetire(input.found, input.missing)) {
    return `faltan ${input.missing} de ${input.found}: demasiadas para ser cierres reales`
  }
  return null
}

const BATCH = 200

export async function runBranches(
  adapter: BranchAdapter,
  options: BranchRunOptions,
): Promise<BranchRunReport> {
  const startedAt = new Date()
  const db = createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: store, error: storeError } = await db
    .from('store')
    .select('id')
    .eq('slug', adapter.storeSlug)
    .single()
  if (storeError) {
    throw new Error(`Tienda ${adapter.storeSlug} no encontrada: ${storeError.message}`, {
      cause: storeError,
    })
  }

  // Run-scoped counters, fed by the adapter through the context. Never state
  // on the adapter itself: adapters are module singletons, and anything kept
  // there leaks from one run into the next.
  let requestsDropped = 0
  const saturatedPoints: string[] = []
  const ctx: BranchFetchContext = {
    ...options,
    onRequestDropped: (url, reason) => {
      requestsDropped += 1
      options.onRequestDropped?.(url, reason)
    },
    onSaturated: (label) => {
      saturatedPoints.push(label)
      options.onSaturated?.(label)
    },
  }

  const results: BranchNormalizeResult[] = []
  for await (const raw of adapter.fetchBranches(ctx)) {
    results.push(adapter.normalize(raw))
  }

  const collection = collectBranches(results)
  const reason = abortReason(collection)
  const report: BranchRunReport = {
    ...collection,
    storeSlug: adapter.storeSlug,
    written: 0,
    retired: 0,
    retireSkipped: null,
    requestsDropped,
    saturatedPoints,
    aborted: reason !== null,
    abortReason: reason,
    durationMs: 0,
  }

  if (reason !== null || options.dryRun) {
    report.durationMs = Date.now() - startedAt.getTime()
    return report
  }

  const seenAt = startedAt.toISOString()
  for (let i = 0; i < collection.branches.length; i += BATCH) {
    const rows = collection.branches.slice(i, i + BATCH).map((branch) => ({
      store_id: store.id,
      external_id: branch.externalId,
      name: branch.name,
      address: branch.address,
      city: branch.city,
      // EWKT: Postgres parses it straight into geography(Point, 4326).
      location: `SRID=4326;POINT(${branch.longitude} ${branch.latitude})`,
      source: 'official',
      is_active: true,
      last_seen_at: seenAt,
    }))

    const { error } = await db
      .from('store_branch')
      .upsert(rows, { onConflict: 'store_id,external_id' })
    if (error) throw new Error(`Error escribiendo sucursales: ${error.message}`, { cause: error })
    report.written += rows.length
  }

  // Shops that were not in this run: retired, never deleted — a list may one
  // day point at a branch, and history matters more than tidiness.
  const { count: missingCount, error: countError } = await db
    .from('store_branch')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', store.id)
    .eq('is_active', true)
    .lt('last_seen_at', seenAt)
  if (countError) {
    throw new Error(`Error contando sucursales ausentes: ${countError.message}`, {
      cause: countError,
    })
  }

  const missing = missingCount ?? 0
  const skip =
    missing === 0
      ? null
      : branchRetireSkipReason({ requestsDropped, found: collection.branches.length, missing })

  if (missing > 0 && skip === null) {
    const { error, count } = await db
      .from('store_branch')
      .update({ is_active: false }, { count: 'exact' })
      .eq('store_id', store.id)
      .eq('is_active', true)
      .lt('last_seen_at', seenAt)
    if (error) throw new Error(`Error retirando sucursales: ${error.message}`, { cause: error })
    report.retired = count ?? 0
  } else {
    report.retireSkipped = skip
  }

  report.durationMs = Date.now() - startedAt.getTime()
  return report
}
