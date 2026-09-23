import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { View } from 'react-native'

import { CatalogScreen, routeParamsSchema } from '@/features/catalog'
import { DraftListBar, useDraftListStore } from '@/features/lists'

/**
 * Route: wires the catalog and lists features together.
 *
 * Neither feature imports the other — that would be a cycle — so the
 * composition happens here, which is exactly what app/ is for (01-overview.md).
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

  return (
    <View className="flex-1 bg-background">
      <CatalogScreen
        storeSlug={parsed.success ? parsed.data.slug : undefined}
        storeName={parsed.success ? parsed.data.name : undefined}
        draftQuantities={draftQuantities}
        onProductPress={openProduct}
      />
      <DraftListBar />
    </View>
  )
}
