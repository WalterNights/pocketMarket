import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { mayRetire } from './retirement'
import type { NormalizedProduct } from './schemas'
import type { RegionCode, StoreAdapter } from './types'

/**
 * The seven stages from docs/domain/02-ingestion.md:
 *
 *   fetch -> normalize -> validate -> upsert -> diff -> append -> refresh
 *
 * plus, at the end of a clean run, retiring what the source stopped listing.
 *
 * Runs with service_role, which bypasses RLS. That key never touches the app
 * bundle (rule 13 in CLAUDE.md).
 */

export type RunReport = {
  storeSlug: string
  seen: number
  normalised: number
  /** Routine: out of stock, no price today. Says nothing about the format. */
  skipped: number
  /** The alarm: a record we could not read. This is what the ceiling watches. */
  failed: number
  productsUpserted: number
  pricesChanged: number
  /**
   * Prices refused because they moved ×MAX_PRICE_JUMP or more against the
   * previous one. Almost always a parse error (a thousands separator read as
   * a decimal point), never written (rules/ingestion.md).
   */
  priceJumpsRejected: number
  /** Source requests given up on. Above 0 the run has holes (ING-003). */
  pagesDropped: number
  /** Products marked is_available = false because the source stopped listing them. */
  retired: number
  /** Why retirement did not run, or null if it ran. */
  retireSkipped: string | null
  /**
   * The store's products with no published price, before and after the run
   * (null in a dry run or if the count failed). The app never shows them; a
   * full run re-reads every listed product, so whatever lost its price to a
   * failed write gets it back here, and `after` says what is still missing.
   */
  unpricedBefore: number | null
  unpricedAfter: number | null
  errors: string[]
  durationMs: number
  aborted: boolean
  abortReason?: string
}

/**
 * Abort threshold. If more than this share of records fails to normalise, the
 * source changed format — writing the rest would mean publishing wrong prices.
 * Never raise it to make a broken run "pass".
 */
const MAX_DISCARD_RATIO = 0.2
/** Below this many records the ratio is noise, not signal. */
const MIN_SAMPLE_FOR_RATIO = 50

const BATCH_SIZE = 200

/**
 * A new price this many times the previous one — or that fraction of it — is
 * a parse error, not a price change: "$ 4.200" read as 4.2, or a pack price
 * read as a unit price. Discarded and reported, never written.
 */
export const MAX_PRICE_JUMP = 10

/**
 * Consecutive batches the database refused before the run gives up. A write
 * that fails three times in a row is not a blip: the database is down or the
 * schema changed, and walking the rest of the source would only spend its
 * patience on rows that cannot be stored.
 */
export const MAX_CONSECUTIVE_WRITE_FAILURES = 3

/**
 * A product absent from the source this long is retired (is_available =
 * false). Runs are daily, so this is "missing from three runs"
 * (rules/ingestion.md) without having to count runs.
 */
export const STALE_AFTER_DAYS = 3

/**
 * How many written prices before publishing what we have so far.
 *
 * `current_price` is what makes a product visible: a product written but not
 * published does not exist for the app, and a store with nothing published
 * shows as "próximamente". Publishing only at the end meant a store stayed
 * dark for the entire run — twelve minutes on the first one.
 *
 * The refresh costs ~35 ms on this catalogue, so the argument for saving them
 * up never held. The run now lights the store up as it fills.
 */
const PUBLISH_EVERY = 1000

export type PipelineOptions = {
  supabaseUrl: string
  serviceRoleKey: string
  region?: RegionCode
  userAgent: string
  delayMs: number
  maxProducts?: number
  /** Log without writing. Used to verify a new adapter before it touches data. */
  dryRun?: boolean
}

/**
 * Latest price this run knows for each product: what it wrote, or what was
 * already there. `current_price` is a materialized view refreshed only every
 * PUBLISH_EVERY changes, so diffing against it alone re-inserts a price this
 * run already wrote whenever the same product comes back in a later batch (a
 * product listed in two categories does). ~20k uuid→int entries: a couple of
 * MB, not the catalogue.
 */
type KnownPrices = Map<string, number>

export async function runIngestion(
  adapter: StoreAdapter,
  options: PipelineOptions,
): Promise<RunReport> {
  const startedAt = Date.now()
  const region = options.region ?? adapter.regions[0] ?? 'NACIONAL'

  const report: RunReport = {
    storeSlug: adapter.storeSlug,
    seen: 0,
    normalised: 0,
    skipped: 0,
    failed: 0,
    productsUpserted: 0,
    pricesChanged: 0,
    priceJumpsRejected: 0,
    pagesDropped: 0,
    retired: 0,
    retireSkipped: null,
    unpricedBefore: null,
    unpricedAfter: null,
    errors: [],
    durationMs: 0,
    aborted: false,
  }

  const supabase = createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const storeId = await resolveStoreId(supabase, adapter.storeSlug)
  const categoryIds = await loadCategoryIds(supabase)
  report.unpricedBefore = await countUnpriced(supabase, storeId, report, options)

  const known: KnownPrices = new Map()
  const write = (batch: NormalizedProduct[]) =>
    flush(supabase, batch, storeId, categoryIds, region, known, report, options)

  let batch: NormalizedProduct[] = []
  /** Value of `pricesChanged` at the last publish. */
  let publishedAt = 0
  let consecutiveWriteFailures = 0

  const recordWrite = (ok: boolean): string | null => {
    consecutiveWriteFailures = ok ? 0 : consecutiveWriteFailures + 1
    return consecutiveWriteFailures >= MAX_CONSECUTIVE_WRITE_FAILURES
      ? `${consecutiveWriteFailures} escrituras seguidas fallidas: la base de datos no acepta lo que se le manda`
      : null
  }

  try {
    for await (const raw of adapter.fetchCatalog(region, {
      userAgent: options.userAgent,
      delayMs: options.delayMs,
      maxProducts: options.maxProducts,
      onRequestDropped: () => {
        report.pagesDropped += 1
      },
    })) {
      report.seen += 1

      const result = adapter.normalize(raw)
      if (result.status === 'skipped') {
        report.skipped += 1
        continue
      }
      if (result.status === 'failed') {
        report.failed += 1
        continue
      }

      report.normalised += 1
      batch.push(result.product)

      if (batch.length >= BATCH_SIZE) {
        const writeAbort = recordWrite(await write(batch))
        batch = []
        if (writeAbort !== null) {
          report.aborted = true
          report.abortReason = writeAbort
          break
        }
      }

      if (report.pricesChanged - publishedAt >= PUBLISH_EVERY) {
        await publish(supabase, report, options)
        publishedAt = report.pricesChanged
      }

      // Checked as we go, so a broken source stops early instead of after an
      // hour of writing nonsense.
      const abort = discardAbortReason(report)
      if (abort !== null) {
        report.aborted = true
        report.abortReason = abort
        break
      }
    }

    if (!report.aborted && batch.length > 0) {
      const writeAbort = recordWrite(await write(batch))
      if (writeAbort !== null) {
        report.aborted = true
        report.abortReason = writeAbort
      }
    }
  } catch (cause) {
    report.errors.push(cause instanceof Error ? cause.message : String(cause))
    report.aborted = true
    report.abortReason = 'excepción durante la corrida'
  }

  // Always publish at the end, including after an abort: prices already
  // written are correct prices, and a run ending early says nothing about
  // them. An aborted run publishes less, never something wrong.
  if (report.pricesChanged > publishedAt) {
    await publish(supabase, report, options)
  }

  await retireVanished(supabase, storeId, startedAt, known.size, report, options)
  report.unpricedAfter = await countUnpriced(supabase, storeId, report, options)

  report.durationMs = Date.now() - startedAt
  return report
}

/**
 * Products of the store without a published price. Counted, not listed: the
 * report needs the size of the gap, and the next run closes it by itself.
 */
async function countUnpriced(
  supabase: SupabaseClient,
  storeId: string,
  report: RunReport,
  options: PipelineOptions,
): Promise<number | null> {
  if (options.dryRun) return null

  const { data, error } = await supabase.rpc('unpriced_product_count', { p_store_id: storeId })
  if (error) {
    report.errors.push(`unpriced_product_count: ${error.message}`)
    return null
  }
  return typeof data === 'number' ? data : null
}

/**
 * Makes everything written so far visible to the app.
 *
 * `current_price` is a materialized view, so a price is only real once it is
 * refreshed. A failure here is reported but never stops the run: the prices
 * are already safely in `price_snapshot` and the next publish picks them up.
 */
async function publish(
  supabase: SupabaseClient,
  report: RunReport,
  options: PipelineOptions,
): Promise<void> {
  if (options.dryRun) return

  const { error } = await supabase.rpc('refresh_current_price')
  if (error) report.errors.push(`refresh_current_price: ${error.message}`)
}

/**
 * Only unreadable records count. Out-of-stock items are routine — deep pages
 * are full of them — and counting those would abort healthy runs.
 */
function discardAbortReason(report: RunReport): string | null {
  if (report.seen < MIN_SAMPLE_FOR_RATIO) return null
  const ratio = report.failed / report.seen
  if (ratio <= MAX_DISCARD_RATIO) return null

  return `${Math.round(ratio * 100)}% de registros ilegibles (umbral ${MAX_DISCARD_RATIO * 100}%): la fuente probablemente cambió de formato`
}

/**
 * PURE: why products missing from the source must NOT be retired this time,
 * or null when they may be.
 *
 * Only a complete, clean run has the right to say "this product is gone". A
 * run that aborted, skipped pages or stopped at --max simply did not look.
 */
export function productRetireSkipReason(input: {
  dryRun: boolean
  aborted: boolean
  partial: boolean
  pagesDropped: number
  found: number
  missing: number
}): string | null {
  if (input.dryRun) return 'dry run'
  if (input.aborted) return 'corrida abortada'
  if (input.partial) return 'corrida parcial (--max)'
  if (input.pagesDropped > 0)
    return `${input.pagesDropped} peticiones descartadas: la corrida tiene huecos`
  if (!mayRetire(input.found, input.missing)) {
    return `faltan ${input.missing} de ${input.found}: demasiados para ser cierres reales`
  }
  return null
}

/**
 * Products not seen for STALE_AFTER_DAYS become is_available = false. Never
 * deleted (rule 16): list_item rows point at them, and the app shows them
 * dimmed with their last known price.
 */
async function retireVanished(
  supabase: SupabaseClient,
  storeId: string,
  startedAt: number,
  found: number,
  report: RunReport,
  options: PipelineOptions,
): Promise<void> {
  const cutoff = new Date(startedAt - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const early = productRetireSkipReason({
    dryRun: options.dryRun === true,
    aborted: report.aborted,
    partial: options.maxProducts !== undefined,
    pagesDropped: report.pagesDropped,
    found,
    missing: 0,
  })
  if (early !== null) {
    report.retireSkipped = early
    return
  }

  const { count, error } = await supabase
    .from('store_product')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .eq('is_available', true)
    .lt('last_seen_at', cutoff)

  if (error) {
    report.errors.push(`contar productos ausentes: ${error.message}`)
    report.retireSkipped = 'no se pudo contar lo ausente'
    return
  }

  const missing = count ?? 0
  if (missing === 0) return

  const skip = productRetireSkipReason({
    dryRun: false,
    aborted: false,
    partial: false,
    pagesDropped: 0,
    found,
    missing,
  })
  if (skip !== null) {
    report.retireSkipped = skip
    return
  }

  const { count: retired, error: retireError } = await supabase
    .from('store_product')
    .update({ is_available: false }, { count: 'exact' })
    .eq('store_id', storeId)
    .eq('is_available', true)
    .lt('last_seen_at', cutoff)

  if (retireError) {
    report.errors.push(`retirar productos ausentes: ${retireError.message}`)
    return
  }
  report.retired = retired ?? 0
}

/** PURE: true when `next` is too far from `previous` to be a real price change. */
export function isAbsurdPriceJump(previous: number | undefined, next: number): boolean {
  if (previous === undefined) return false
  return next >= previous * MAX_PRICE_JUMP || next * MAX_PRICE_JUMP <= previous
}

export type SnapshotRow = {
  store_product_id: string
  region_code: RegionCode
  price_cop: number
  list_price_cop: number | null
}

export type PriceDiff = {
  snapshots: SnapshotRow[]
  rejected: { externalId: string; previous: number; next: number }[]
}

/**
 * PURE: which prices to append. A snapshot ONLY when the price actually moved
 * — an identical row every day inflates the table without adding information,
 * and captured_at would stop meaning "has had this price since" — and never
 * when it moved absurdly far.
 */
export function diffPrices(
  products: readonly NormalizedProduct[],
  idByExternal: ReadonlyMap<string, string>,
  previous: ReadonlyMap<string, number>,
  region: RegionCode,
): PriceDiff {
  const diff: PriceDiff = { snapshots: [], rejected: [] }

  for (const p of products) {
    const id = idByExternal.get(p.externalId)
    if (id === undefined) continue

    const before = previous.get(id)
    if (before === p.priceCop) continue

    if (before !== undefined && isAbsurdPriceJump(before, p.priceCop)) {
      diff.rejected.push({ externalId: p.externalId, previous: before, next: p.priceCop })
      continue
    }

    diff.snapshots.push({
      store_product_id: id,
      region_code: region,
      price_cop: p.priceCop,
      list_price_cop: p.listPriceCop,
    })
  }

  return diff
}

/** Writes one batch. Returns false when the database refused it. */
async function flush(
  supabase: SupabaseClient,
  batch: NormalizedProduct[],
  storeId: string,
  categoryIds: Map<string, string>,
  region: RegionCode,
  known: KnownPrices,
  report: RunReport,
  options: PipelineOptions,
): Promise<boolean> {
  if (options.dryRun) {
    report.productsUpserted += batch.length
    return true
  }

  const now = new Date().toISOString()

  // A product can sit in two of Éxito's categories at once (a ham is both
  // "Charcutería" and "Pollo, carne y pescado"), and we walk category by
  // category, so the same external_id can reach the same batch twice. Postgres
  // refuses that: "ON CONFLICT DO UPDATE command cannot affect row a second
  // time". Keep the first occurrence.
  const deduped = dedupeByExternalId(batch)

  // 4. Upsert. store_product is never deleted — list_item rows point at it, so
  //    a product that vanishes gets is_available = false instead (rule 16).
  //    A product whose price is rejected below is still upserted: its name
  //    and last_seen_at are facts; only the price is suspect.
  const rows = deduped.map((p) => ({
    store_id: storeId,
    external_id: p.externalId,
    ean: p.ean,
    name: p.name,
    brand: p.brand,
    category_id: p.categorySlug === null ? null : (categoryIds.get(p.categorySlug) ?? null),
    source_bucket: p.sourceBucket,
    unit_kind: p.unitKind,
    unit_value: p.unitValue,
    unit_measure: p.unitMeasure,
    image_url: p.imageUrl,
    is_available: p.isAvailable,
    last_seen_at: now,
  }))

  const { data: upserted, error: upsertError } = await supabase
    .from('store_product')
    .upsert(rows, { onConflict: 'store_id,external_id' })
    .select('id, external_id')

  if (upsertError) {
    report.errors.push(`upsert: ${upsertError.message}`)
    return false
  }

  report.productsUpserted += upserted?.length ?? 0

  const idByExternal = new Map(
    (upserted ?? []).map((r) => [r.external_id as string, r.id as string]),
  )
  const productIds = [...idByExternal.values()]
  if (productIds.length === 0) return true

  // 5. Diff against what we already have: this run's own writes first, the
  //    published view only for products this run has not touched yet.
  const { previous, unknownIds } = splitKnown(productIds, known)

  if (unknownIds.length > 0) {
    const { data: current, error: currentError } = await supabase
      .from('current_price')
      .select('store_product_id, price_cop')
      .eq('region_code', region)
      .in('store_product_id', unknownIds)

    if (currentError) {
      report.errors.push(`current_price: ${currentError.message}`)
      return false
    }
    for (const r of current ?? []) {
      previous.set(r.store_product_id as string, r.price_cop as number)
    }
  }

  // 6. Append only what moved, and only if it moved believably.
  const diff = diffPrices(deduped, idByExternal, previous, region)

  report.priceJumpsRejected += diff.rejected.length
  for (const r of diff.rejected) {
    console.warn(
      `  precio descartado ${r.externalId}: ${r.previous} -> ${r.next} (salto x${MAX_PRICE_JUMP} o mas)`,
    )
  }

  if (diff.snapshots.length > 0) {
    const written = await insertSnapshots(supabase, diff.snapshots, report)
    report.pricesChanged += written.length
    rememberPrices(known, previous, written)
    return written.length === diff.snapshots.length
  }

  rememberPrices(known, previous, diff.snapshots)
  return true
}

/**
 * Inserts the batch; if Postgres refuses it, retries ROW BY ROW so one bad
 * price loses one price, not a hundred. A batch insert is all-or-nothing: an
 * Éxito price that did not fit an integer once took 101 good prices down with
 * it (ING-014). The schema now rejects such values earlier; this is the net
 * under it, for whatever the next source invents.
 *
 * Returns the rows that made it in.
 */
export async function insertSnapshots(
  supabase: SupabaseClient,
  snapshots: readonly SnapshotRow[],
  report: RunReport,
): Promise<SnapshotRow[]> {
  const { error } = await supabase.from('price_snapshot').insert([...snapshots])
  if (!error) return [...snapshots]

  console.warn(`  lote de precios rechazado (${error.message}); reintentando fila a fila`)
  const written: SnapshotRow[] = []
  for (const row of snapshots) {
    const { error: rowError } = await supabase.from('price_snapshot').insert(row)
    if (rowError) {
      report.errors.push(`price_snapshot ${row.store_product_id}: ${rowError.message}`)
      continue
    }
    written.push(row)
  }
  return written
}

/**
 * PURE: prices this run already knows for `ids`, and the ids it must still
 * look up in `current_price`. This run's own writes win over the view, which
 * lags until the next refresh.
 */
export function splitKnown(
  ids: readonly string[],
  known: ReadonlyMap<string, number>,
): { previous: Map<string, number>; unknownIds: string[] } {
  const previous = new Map<string, number>()
  const unknownIds: string[] = []
  for (const id of ids) {
    const price = known.get(id)
    if (price === undefined) unknownIds.push(id)
    else previous.set(id, price)
  }
  return { previous, unknownIds }
}

/**
 * Records what the database now holds for each product of a written batch:
 * the new price where a snapshot went in, the previous one otherwise (a
 * rejected jump included — the absurd price was never written).
 */
export function rememberPrices(
  known: Map<string, number>,
  previous: ReadonlyMap<string, number>,
  written: readonly SnapshotRow[],
): void {
  for (const [id, price] of previous) known.set(id, price)
  for (const row of written) known.set(row.store_product_id, row.price_cop)
}

/** First occurrence wins; later duplicates of the same SKU are dropped. */
export function dedupeByExternalId(products: NormalizedProduct[]): NormalizedProduct[] {
  const seen = new Set<string>()
  const out: NormalizedProduct[] = []

  for (const p of products) {
    if (seen.has(p.externalId)) continue
    seen.add(p.externalId)
    out.push(p)
  }

  return out
}

async function resolveStoreId(supabase: SupabaseClient, slug: string): Promise<string> {
  const { data, error } = await supabase.from('store').select('id').eq('slug', slug).single()
  if (error)
    throw new Error(`No se encontró la tienda "${slug}": ${error.message}`, { cause: error })
  return data.id as string
}

async function loadCategoryIds(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('category').select('id, slug')
  if (error) {
    throw new Error(`No se pudieron cargar las categorías: ${error.message}`, { cause: error })
  }
  return new Map((data ?? []).map((c) => [c.slug as string, c.id as string]))
}
