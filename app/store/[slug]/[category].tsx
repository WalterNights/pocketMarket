import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { View } from 'react-native'

import { CatalogScreen, categoryRouteParamsSchema } from '@/features/catalog'
import { DraftListBar, useDraftQuantities } from '@/features/lists'
import { NotFound } from '@/shared/ui'

/** Route: products of one category inside one store. Composition only. */
export default function StoreCategoryRoute() {
  const router = useRouter()
  const parsed = categoryRouteParamsSchema.safeParse(useLocalSearchParams())

  const draftQuantities = useDraftQuantities()

  const openProduct = useCallback(
    (productId: string) => router.push({ pathname: '/product/[id]', params: { id: productId } }),
    [router],
  )

  if (!parsed.success) return <NotFound title="Esta categoría no existe" />

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
