import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { NormalizedProduct } from './schemas'
import type { RegionCode, StoreAdapter } from './types'

/**
 * The seven stages from docs/domain/02-ingestion.md:
 *
 *   fetch -> normalize -> validate -> upsert -> diff -> append -> refresh
 *
 * Runs with service_role, which bypasses RLS. That key never touches the app
 * bundle (rule 13 in CLAUDE.md).
 */

export type RunReport = {
  storeSlug: string
  seen: number
  normalised: number
  discarded: number
  productsUpserted: number
  pricesChanged: number
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
    discarded: 0,
    productsUpserted: 0,
    pricesChanged: 0,
    errors: [],
    durationMs: 0,
    aborted: false,
  }

  const supabase = createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const storeId = await resolveStoreId(supabase, adapter.storeSlug)
  const categoryIds = await loadCategoryIds(supabase)

  let batch: NormalizedProduct[] = []

  try {
    for await (const raw of adapter.fetchCatalog(region, {
      userAgent: options.userAgent,
      delayMs: options.delayMs,
      maxProducts: options.maxProducts,
    })) {
      report.seen += 1

      const normalised = adapter.normalize(raw)
      if (normalised === null) {
        report.discarded += 1
        continue
      }

      report.normalised += 1
      batch.push(normalised)

      if (batch.length >= BATCH_SIZE) {
        await flush(supabase, batch, storeId, categoryIds, region, report, options)
        batch = []
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
      await flush(supabase, batch, storeId, categoryIds, region, report, options)
    }

    if (!report.aborted && !options.dryRun && report.pricesChanged > 0) {
      // Without this the app keeps serving old prices even though the
      // snapshots are new.
      const { error } = await supabase.rpc('refresh_current_price')
      if (error) report.errors.push(`refresh_current_price: ${error.message}`)
    }
  } catch (cause) {
    report.errors.push(cause instanceof Error ? cause.message : String(cause))
    report.aborted = true
    report.abortReason = 'excepción durante la corrida'
  }

  report.durationMs = Date.now() - startedAt
  return report
}

function discardAbortReason(report: RunReport): string | null {
  if (report.seen < MIN_SAMPLE_FOR_RATIO) return null
  const ratio = report.discarded / report.seen
  if (ratio <= MAX_DISCARD_RATIO) return null

  return `descarte del ${Math.round(ratio * 100)}% (umbral ${MAX_DISCARD_RATIO * 100}%): la fuente probablemente cambió de formato`
}

async function flush(
  supabase: SupabaseClient,
  batch: NormalizedProduct[],
  storeId: string,
  categoryIds: Map<string, string>,
  region: RegionCode,
  report: RunReport,
  options: PipelineOptions,
): Promise<void> {
  if (options.dryRun) {
    report.productsUpserted += batch.length
    return
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
  const rows = deduped.map((p) => ({
    store_id: storeId,
    external_id: p.externalId,
    ean: p.ean,
    name: p.name,
    brand: p.brand,
    category_id: p.categorySlug === null ? null : (categoryIds.get(p.categorySlug) ?? null),
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
    return
  }

  report.productsUpserted += upserted?.length ?? 0

  const idByExternal = new Map(
    (upserted ?? []).map((r) => [r.external_id as string, r.id as string]),
  )
  const productIds = [...idByExternal.values()]
  if (productIds.length === 0) return

  // 5. Diff against what we already have.
  const { data: current, error: currentError } = await supabase
    .from('current_price')
    .select('store_product_id, price_cop')
    .eq('region_code', region)
    .in('store_product_id', productIds)

  if (currentError) {
    report.errors.push(`current_price: ${currentError.message}`)
    return
  }

  const priceById = new Map(
    (current ?? []).map((r) => [r.store_product_id as string, r.price_cop as number]),
  )

  // 6. Append a snapshot ONLY when the price actually moved. Writing an
  //    identical row every day inflates the table without adding information,
  //    and captured_at would stop meaning "has had this price since".
  const snapshots = deduped.flatMap((p) => {
    const id = idByExternal.get(p.externalId)
    if (id === undefined) return []
    if (priceById.get(id) === p.priceCop) return []

    return [
      {
        store_product_id: id,
        region_code: region,
        price_cop: p.priceCop,
        list_price_cop: p.listPriceCop,
      },
    ]
  })

  if (snapshots.length === 0) return

  const { error: snapshotError } = await supabase.from('price_snapshot').insert(snapshots)
  if (snapshotError) {
    report.errors.push(`price_snapshot: ${snapshotError.message}`)
    return
  }

  report.pricesChanged += snapshots.length
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
  if (error) throw new Error(`No se encontró la tienda "${slug}": ${error.message}`)
  return data.id as string
}

async function loadCategoryIds(supabase: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('category').select('id, slug')
  if (error) throw new Error(`No se pudieron cargar las categorías: ${error.message}`)
  return new Map((data ?? []).map((c) => [c.slug as string, c.id as string]))
}
