import { z } from 'zod'

import { d1Adapter } from '../../adapters/d1'
import { exitoAdapter } from '../../adapters/exito'
import { olimpicaAdapter } from '../../adapters/olimpica'
import { supermuAdapter } from '../../adapters/supermu'
import { runIngestion, type RunReport } from '../../core/pipeline'
import { arg, DELAY_MS, flag, parseArgs, positiveIntArg, supabaseEnv, USER_AGENT } from './cli'

/**
 * Entry point for a run. Used locally and from GitHub Actions.
 *
 *   pnpm run ingest -- --store d1 --dry-run --max 100
 *   pnpm run ingest -- --store all
 *
 * SUPABASE_SERVICE_ROLE_KEY bypasses RLS: it lives in GitHub secrets or the
 * local .env, never in the app bundle (rule 13 in CLAUDE.md).
 *
 * Exit code is non-zero when a store aborted, threw, hit an error, or dropped
 * any source page. A dropped page does not stop the run (ING-003) — what was read
 * is written and published — but part of the catalogue was not refreshed, and
 * CI has to show that in red rather than bury it in a log.
 */

const ADAPTERS = {
  exito: exitoAdapter,
  d1: d1Adapter,
  olimpica: olimpicaAdapter,
  supermu: supermuAdapter,
} as const

const STORE_ARGS = ['exito', 'd1', 'olimpica', 'supermu', 'all'] as const satisfies readonly (
  keyof typeof ADAPTERS | 'all'
)[]

const argsSchema = z.object({
  store: z.enum(STORE_ARGS).default('exito'),
  max: positiveIntArg,
  'dry-run': z.boolean(),
})

function percent(part: number, whole: number): string {
  return whole > 0 ? ` (${Math.round((part / whole) * 100)}%)` : ''
}

function printReport(report: RunReport): void {
  const lines = [
    '',
    `  tienda            ${report.storeSlug}`,
    `  vistos            ${report.seen}`,
    `  normalizados      ${report.normalised}`,
    // Not only out-of-stock: out-of-scope and aisle-less records are skips
    // too, and RunReport carries one total with no per-reason breakdown.
    `  saltados          ${report.skipped}${percent(report.skipped, report.seen)}`,
    `  ilegibles         ${report.failed}${percent(report.failed, report.seen)}`,
    `  productos escritos ${report.productsUpserted}`,
    `  precios cambiados ${report.pricesChanged}`,
    `  precios absurdos  ${report.priceJumpsRejected} (descartados, salto x10 o mas)`,
    `  paginas perdidas  ${report.pagesDropped}`,
    `  retirados         ${report.retired}` +
      (report.retireSkipped === null ? '' : ` (OMITIDO: ${report.retireSkipped})`),
    `  duracion          ${(report.durationMs / 1000).toFixed(1)}s`,
  ]

  if (report.pagesDropped > 0) {
    lines.push(
      `  ATENCION          ${report.pagesDropped} paginas descartadas: catalogo incompleto`,
    )
  }
  if (report.aborted) lines.push(`  ABORTADA          ${report.abortReason ?? ''}`)
  for (const e of report.errors) lines.push(`  error             ${e}`)
  lines.push('')

  // A silent run is a run you know nothing about (docs/domain/02-ingestion.md).
  console.log(lines.join('\n'))
}

async function main(): Promise<void> {
  const args = parseArgs(argsSchema, {
    store: arg('store'),
    max: arg('max'),
    'dry-run': flag('dry-run'),
  })
  const { supabaseUrl, serviceRoleKey } = supabaseEnv()
  const dryRun = args['dry-run']
  // One store after another, never in parallel: each source gets its own
  // polite, sequential run, and one store failing does not skip the rest.
  const adapters = args.store === 'all' ? Object.values(ADAPTERS) : [ADAPTERS[args.store]]
  let anyFailed = false

  for (const adapter of adapters) {
    console.log(`\nIngesta de ${adapter.storeSlug}${dryRun ? ' (DRY RUN, no escribe)' : ''}`)

    try {
      const report = await runIngestion(adapter, {
        supabaseUrl,
        serviceRoleKey,
        userAgent: USER_AGENT,
        delayMs: DELAY_MS,
        maxProducts: args.max,
        dryRun,
      })

      printReport(report)
      anyFailed ||= report.aborted || report.errors.length > 0 || report.pagesDropped > 0
    } catch (cause) {
      // runIngestion catches what happens while walking the catalogue, but its
      // setup (resolving the store, loading categories) and its closing steps
      // can still throw. One store failing is not the run failing (ING-003):
      // report it and go on to the next.
      console.error(`  ERROR en ${adapter.storeSlug}:`, cause)
      anyFailed = true
    }
  }

  process.exit(anyFailed ? 1 : 0)
}

main().catch((cause: unknown) => {
  console.error('\n  La ingesta fallo:', cause instanceof Error ? cause.message : cause, '\n')
  process.exit(1)
})
