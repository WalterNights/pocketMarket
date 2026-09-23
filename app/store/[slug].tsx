import { useLocalSearchParams } from 'expo-router'

import { CatalogScreen } from '@/features/catalog'
import { routeParamsSchema } from '@/features/catalog'

/**
 * Route: translates navigation params into feature props.
 *
 * Params are validated, not cast: a deep link is untrusted input and
 * useLocalSearchParams returns `string | string[]` (05-navigation.md).
 */
export default function StoreCatalogRoute() {
  const raw = useLocalSearchParams()
  const parsed = routeParamsSchema.safeParse(raw)

  if (!parsed.success) return <CatalogScreen />

  return <CatalogScreen storeSlug={parsed.data.slug} storeName={parsed.data.name} />
}
