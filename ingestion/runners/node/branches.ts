import { z } from 'zod'

import { araBranchAdapter } from '../../adapters/ara-branches'
import { carullaBranchAdapter } from '../../adapters/carulla-branches'
import {
  mercadoMadridBranchAdapter,
  supermuBranchAdapter,
  vaquitaExpressBranchAdapter,
} from '../../adapters/curated-branches'
import { d1BranchAdapter } from '../../adapters/d1-branches'
import { dollarcityBranchAdapter } from '../../adapters/dollarcity-branches'
import { exitoBranchAdapter } from '../../adapters/exito-branches'
import { isimoBranchAdapter } from '../../adapters/isimo-branches'
import { jumboBranchAdapter } from '../../adapters/jumbo-branches'
import { olimpicaBranchAdapter } from '../../adapters/olimpica-branches'
import { runBranches, type BranchRunReport } from '../../core/branch-pipeline'
import type { BranchAdapter } from '../../core/branch-types'
import { trustMissingIntermediates } from '../../core/tls'
import { arg, DELAY_MS, flag, parseArgs, supabaseEnv, USER_AGENT } from './cli'

/**
 * Loads where each chain's shops are. Monthly, never in the daily price run:
 * a shop does not move every night (docs/plans/0001-mapa-de-tiendas.md).
 *
 *   pnpm run branches -- --store ara
 *   pnpm run branches -- --store all --dry-run
 *
 * SUPABASE_SERVICE_ROLE_KEY bypasses RLS: GitHub secrets or local env only,
 * never the app bundle (rule 13).
 *
 * Exit code is non-zero when a chain aborted, threw, or dropped any request
 * (its retirement was skipped, so the map may keep a closed shop a month).
 */

const ADAPTERS = {
  ara: araBranchAdapter,
  dollarcity: dollarcityBranchAdapter,
  exito: exitoBranchAdapter,
  d1: d1BranchAdapter,
  olimpica: olimpicaBranchAdapter,
  jumbo: jumboBranchAdapter,
  carulla: carullaBranchAdapter,
  supermu: supermuBranchAdapter,
  'vaquita-express': vaquitaExpressBranchAdapter,
  'mercado-madrid': mercadoMadridBranchAdapter,
  // Last: geocoding runs at 1 request/s (~10 min without cache).
  isimo: isimoBranchAdapter,
} as const satisfies Record<string, BranchAdapter>

type ChainName = keyof typeof ADAPTERS

const argsSchema = z.object({
  store: z
    .enum(['all', ...(Object.keys(ADAPTERS) as ChainName[])] as ['all', ...ChainName[]])
    .default('all'),
  'dry-run': z.boolean(),
})

function printReport(report: BranchRunReport): void {
  const lines = [
    '',
    `  cadena            ${report.storeSlug}`,
    `  vistos            ${report.seen}`,
    `  tiendas unicas    ${report.branches.length}`,
    `  duplicadas        ${report.duplicates}`,
    `  saltadas          ${report.skipped}`,
    `  ilegibles         ${report.failed}`,
    `  peticiones perdidas ${report.requestsDropped}`,
    `  escritas          ${report.written}`,
    `  retiradas         ${report.retired}` +
      (report.retireSkipped === null ? '' : ` (OMITIDO: ${report.retireSkipped})`),
    `  duracion          ${(report.durationMs / 1000).toFixed(1)}s`,
  ]
  for (const [reason, count] of Object.entries(report.skipReasons)) {
    lines.push(`    saltada: ${reason} × ${count}`)
  }
  if (report.saturatedPoints.length > 0) {
    lines.push(
      `  TOPE ALCANZADO en ${report.saturatedPoints.length} puntos: la cuadricula es gruesa ahi`,
    )
    lines.push(`    ${report.saturatedPoints.join(', ')}`)
  }
  if (report.aborted) lines.push(`  ABORTADA          ${report.abortReason ?? ''}`)
  lines.push('')
  console.log(lines.join('\n'))
}

async function main(): Promise<void> {
  trustMissingIntermediates()

  const args = parseArgs(argsSchema, { store: arg('store'), 'dry-run': flag('dry-run') })
  const names: ChainName[] =
    args.store === 'all' ? (Object.keys(ADAPTERS) as ChainName[]) : [args.store]
  const { supabaseUrl, serviceRoleKey } = supabaseEnv()
  const dryRun = args['dry-run']
  let failed = false

  for (const name of names) {
    console.log(`\nSucursales de ${name}${dryRun ? ' (DRY RUN, no escribe)' : ''}`)
    try {
      const report = await runBranches(ADAPTERS[name], {
        supabaseUrl,
        serviceRoleKey,
        userAgent: USER_AGENT,
        delayMs: DELAY_MS,
        dryRun,
      })
      printReport(report)
      if (report.aborted || report.requestsDropped > 0) failed = true
    } catch (cause) {
      // One chain failing is not the run failing (ING-003): report and go on.
      console.error(`  ERROR en ${name}:`, cause)
      failed = true
    }
  }

  // Non-zero exit so CI marks the run red.
  if (failed) process.exitCode = 1
}

main().catch((cause: unknown) => {
  console.error('\n  Sucursales fallo:', cause instanceof Error ? cause.message : cause, '\n')
  process.exitCode = 1
})
