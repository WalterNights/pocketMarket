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
