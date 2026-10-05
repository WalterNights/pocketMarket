import { z } from 'zod'

import mercadoMadrid from '../data/branches/mercado-madrid.json'
import supermu from '../data/branches/supermu.json'
import vaquitaExpress from '../data/branches/vaquita-express.json'
import {
  isInColombia,
  normalizedBranchSchema,
  okBranch,
  type BranchAdapter,
  type BranchNormalizeResult,
  type RawBranch,
} from '../core/branch-types'

/**
 * Small chains whose shops are a hand-verified file in the repo
 * (ingestion/data/branches/<slug>.json), not a feed: Supermú (14), La Vaquita
 * Express (8), Mercado Madrid (2). Scraping an HTML directory for a dozen
 * shops that almost never change would be more fragile than checking them by
 * hand once (plan 0003, "Decisiones de diseño").
 *
 * Every coordinate in those files comes from the chain's own page (a Google
 * Maps pin, the store page's map widget) or from an OSM feature matching the
 * shop — the file says which. NEVER typed in by guess: a shop without a
 * reliable coordinate stays out of the file.
 *
 * No network: fetchBranches() reads the file. To update, re-check the
 * `source` page, edit the file and bump `verifiedAt`.
 */

export const curatedFileSchema = z.object({
  source: z.string().min(1),
  verifiedAt: z.iso.date(),
  /** Where the coordinates came from, for whoever re-verifies the file. */
  coordinates: z.string().min(1),
  branches: z.array(z.unknown()).min(1),
})

export type CuratedFile = z.infer<typeof curatedFileSchema>

export function curatedBranchAdapter(storeSlug: string, file: unknown): BranchAdapter {
  // A malformed file is a programming error, caught by the tests at once.
  const data = curatedFileSchema.parse(file)

  return {
    storeSlug,

    async *fetchBranches() {
      for (const row of data.branches) yield (row ?? {}) as RawBranch
    },

    normalize(raw: RawBranch): BranchNormalizeResult {
      const parsed = normalizedBranchSchema.safeParse(raw)
      if (!parsed.success) return { status: 'failed', reason: 'fila curada ilegible' }
      if (!isInColombia(parsed.data.latitude, parsed.data.longitude)) {
        return { status: 'failed', reason: 'fila curada fuera de Colombia' }
      }
      return okBranch(parsed.data)
    },
  }
}

export const supermuBranchAdapter = curatedBranchAdapter('supermu', supermu)
export const vaquitaExpressBranchAdapter = curatedBranchAdapter('vaquita-express', vaquitaExpress)
export const mercadoMadridBranchAdapter = curatedBranchAdapter('mercado-madrid', mercadoMadrid)
