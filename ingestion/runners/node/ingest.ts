import { z } from 'zod'

import { exitoAdapter } from '../../adapters/exito'
import { runIngestion, type RunReport } from '../../core/pipeline'
import { arg, DELAY_MS, flag, parseArgs, positiveIntArg, supabaseEnv, USER_AGENT } from './cli'

/**
 * Entry point for a run. Used locally and from GitHub Actions.
 *
 *   pnpm run ingest:exito -- --dry-run --max 100
 *
 * SUPABASE_SERVICE_ROLE_KEY bypasses RLS: it lives in GitHub secrets or the
 * local .env, never in the app bundle (rule 13 in CLAUDE.md).
 *
 * Exit code is non-zero when the run aborted, hit an error, or dropped any
 * source page. A dropped page does not stop the run (ING-003) — what was read
 * is written and published — but part of the catalogue was not refreshed, and
 * CI has to show that in red rather than bury it in a log.
 */

const ADAPTERS = { exito: exitoAdapter } as const

const argsSchema = z.object({
  store: z.enum(Object.keys(ADAPTERS) as [keyof typeof ADAPTERS]).default('exito'),
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
    `  agotados          ${report.skipped}${percent(report.skipped, report.seen)}`,
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
  const adapter = ADAPTERS[args.store]
  const { supabaseUrl, serviceRoleKey } = supabaseEnv()
  const dryRun = args['dry-run']

  console.log(`\nIngesta de ${adapter.storeSlug}${dryRun ? ' (DRY RUN, no escribe)' : ''}`)

  const report = await runIngestion(adapter, {
    supabaseUrl,
    serviceRoleKey,
    userAgent: USER_AGENT,
    delayMs: DELAY_MS,
    maxProducts: args.max,
    dryRun,
  })

  printReport(report)
  const failed = report.aborted || report.errors.length > 0 || report.pagesDropped > 0
  process.exit(failed ? 1 : 0)
}

main().catch((cause: unknown) => {
  console.error('\n  La ingesta fallo:', cause instanceof Error ? cause.message : cause, '\n')
  process.exit(1)
})
