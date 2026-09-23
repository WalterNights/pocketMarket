import { useRouter } from 'expo-router'
import { useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo } from 'react'

import { CatalogScreen, routeParamsSchema } from '@/features/catalog'
import { useDraftListStore } from '@/features/lists'

/**
 * Route: wires the catalog and lists features together.
 *
 * Neither feature imports the other — that would be a cycle — so the
 * composition happens here, which is exactly what app/ is for
 * (01-overview.md).
 *
 * Params are validated, not cast: a deep link is untrusted input and
 * useLocalSearchParams returns `string | string[]` (05-navigation.md).
 */
export default function StoreCatalogRoute() {
  const router = useRouter()
  const parsed = routeParamsSchema.safeParse(useLocalSearchParams())

  const draftItems = useDraftListStore((s) => s.items)
  const draftQuantities = useMemo(
    () => Object.fromEntries(Object.entries(draftItems).map(([id, item]) => [id, item.quantity])),
    [draftItems],
  )

  const openProduct = useCallback(
    (productId: string) => router.push({ pathname: '/product/[id]', params: { id: productId } }),
    [router],
  )

  if (!parsed.success) {
    return <CatalogScreen draftQuantities={draftQuantities} onProductPress={openProduct} />
  }

  return (
    <CatalogScreen
      storeSlug={parsed.data.slug}
      storeName={parsed.data.name}
      draftQuantities={draftQuantities}
      onProductPress={openProduct}
    />
  )
}
