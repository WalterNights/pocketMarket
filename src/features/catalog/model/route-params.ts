import { z } from 'zod'

/**
 * Deep links are untrusted input and useLocalSearchParams returns
 * `string | string[]`. Casting it crashes on malformed links; parsing it does
 * not (docs/architecture/05-navigation.md).
 */
const firstOf = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v[0] : v))

export const routeParamsSchema = z.object({
  slug: firstOf.pipe(z.string().min(1)),
  name: firstOf.pipe(z.string().min(1)).optional(),
})

export type RouteParams = z.infer<typeof routeParamsSchema>

export const categoryRouteParamsSchema = z.object({
  slug: firstOf.pipe(z.string().min(1)),
  category: firstOf.pipe(z.string().min(1)),
  categoryName: firstOf.pipe(z.string().min(1)).optional(),
})

export type CategoryRouteParams = z.infer<typeof categoryRouteParamsSchema>

export const productIdParamSchema = z.object({
  id: firstOf.pipe(z.string().uuid()),
})

export type ProductIdParam = z.infer<typeof productIdParamSchema>
