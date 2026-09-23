import { z } from 'zod'

/** Pure domain model for stores. No React, no network (rule 3). */

export const storeSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  sourceType: z.enum(['api', 'scraper', 'manual']),
  isActive: z.boolean(),
  productCount: z.number().int().nonnegative(),
  lastUpdatedAt: z.string().nullable(),
})

export type Store = z.infer<typeof storeSchema>

/**
 * A store with no products yet is not an error: its adapter simply is not
 * built. The list shows it dimmed rather than hiding it, so the user can see
 * what is coming (docs/domain/02-ingestion.md).
 */
export function isBrowsable(store: Store): boolean {
  return store.isActive && store.productCount > 0
}

/**
 * How stale the catalogue is, in plain words. Data freshness is stated calmly
 * and in text — never with a red icon (docs/design/00-visual-direction.md).
 */
export function freshnessLabel(lastUpdatedAt: string | null, now: Date = new Date()): string {
  if (lastUpdatedAt === null) return 'Sin datos todavía'

  const updated = new Date(lastUpdatedAt)
  if (Number.isNaN(updated.getTime())) return 'Sin datos todavía'

  const hours = Math.floor((now.getTime() - updated.getTime()) / 3_600_000)
  if (hours < 1) return 'Precios de hace un momento'
  if (hours < 24) return `Precios de hace ${hours} h`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Precios de ayer'
  return `Precios de hace ${days} días`
}
