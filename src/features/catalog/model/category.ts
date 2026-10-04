import { z } from 'zod'

/** Pure domain model for categories within a store. */

export const storeCategorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  productCount: z.number().int().positive(),
})

export type StoreCategory = z.infer<typeof storeCategorySchema>
