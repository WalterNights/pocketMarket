import { exitoAdapter } from '../../adapters/exito'
import { runIngestion, type RunReport } from '../../core/pipeline'

/**
 * Entry point for a run. Used locally and from GitHub Actions.
 *
 *   pnpm run ingest:exito -- --dry-run --max 100
 *
 * SUPABASE_SERVICE_ROLE_KEY bypasses RLS: it lives in GitHub secrets or the
 * local .env, never in the app bundle (rule 13 in CLAUDE.md).
 */

const ADAPTERS = { exito: exitoAdapter } as const
type AdapterName = keyof typeof ADAPTERS

/** Identifies us and gives the source a way to get in touch. */
const USER_AGENT =
  'PocketMarket/0.1 (proyecto personal de comparacion de precios; sm9349168@gmail.com)'

/** One request at a time with a pause. Never lower this to "go faster". */
const DELAY_MS = 1200

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function printReport(report: RunReport): void {
  const lines = [
    '',
    `  tienda            ${report.storeSlug}`,
    `  vistos            ${report.seen}`,
    `  normalizados      ${report.normalised}`,
    `  descartados       ${report.discarded}` +
      (report.seen > 0 ? ` (${Math.round((report.discarded / report.seen) * 100)}%)` : ''),
    `  productos escritos ${report.productsUpserted}`,
    `  precios cambiados ${report.pricesChanged}`,
    `  duracion          ${(report.durationMs / 1000).toFixed(1)}s`,
  ]

  if (report.aborted) lines.push(`  ABORTADA          ${report.abortReason ?? ''}`)
  for (const e of report.errors) lines.push(`  error             ${e}`)
  lines.push('')

  // A silent run is a run you know nothing about (docs/domain/02-ingestion.md).
  console.log(lines.join('\n'))
}

async function main(): Promise<void> {
  const name = (arg('store') ?? 'exito') as AdapterName
  const adapter = ADAPTERS[name]
  if (adapter === undefined) throw new Error(`Adaptador desconocido: ${name}`)

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl === undefined || serviceRoleKey === undefined) {
    throw new Error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  }

  const maxRaw = arg('max')
  const dryRun = flag('dry-run')

  console.log(`\nIngesta de ${adapter.storeSlug}${dryRun ? ' (DRY RUN, no escribe)' : ''}`)

  const report = await runIngestion(adapter, {
    supabaseUrl,
    serviceRoleKey,
    userAgent: USER_AGENT,
    delayMs: DELAY_MS,
    maxProducts: maxRaw === undefined ? undefined : Number(maxRaw),
    dryRun,
  })

  printReport(report)
  process.exit(report.aborted || report.errors.length > 0 ? 1 : 0)
}

main().catch((cause: unknown) => {
  console.error('\n  La ingesta fallo:', cause instanceof Error ? cause.message : cause, '\n')
  process.exit(1)
})
