import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { View } from 'react-native'

import { CatalogScreen, categoryRouteParamsSchema } from '@/features/catalog'
import { DraftListBar, useDraftListStore } from '@/features/lists'

/** Route: products of one category inside one store. Composition only. */
export default function StoreCategoryRoute() {
  const router = useRouter()
  const parsed = categoryRouteParamsSchema.safeParse(useLocalSearchParams())

  const draftItems = useDraftListStore((s) => s.items)
  const draftQuantities = useMemo(
    () => Object.fromEntries(Object.entries(draftItems).map(([id, item]) => [id, item.quantity])),
    [draftItems],
  )

  const openProduct = useCallback(
    (productId: string) => router.push({ pathname: '/product/[id]', params: { id: productId } }),
    [router],
  )

  if (!parsed.success) return null

  return (
    <View className="flex-1 bg-background">
      <CatalogScreen
        storeSlug={parsed.data.slug}
        categorySlug={parsed.data.category}
        categoryName={parsed.data.categoryName}
        draftQuantities={draftQuantities}
        onProductPress={openProduct}
      />
      <DraftListBar />
    </View>
  )
}
