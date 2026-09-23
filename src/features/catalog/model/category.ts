import { z } from 'zod'

/** Pure domain model for categories within a store. */

export const storeCategorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  productCount: z.number().int().positive(),
})

export type StoreCategory = z.infer<typeof storeCategorySchema>

/**
 * Total products across categories. Shown on the store card so the user knows
 * the size of what they are entering.
 */
export function totalProductsIn(categories: StoreCategory[]): number {
  return categories.reduce((sum, c) => sum + c.productCount, 0)
}
