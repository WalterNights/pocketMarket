import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useMemo } from 'react'
import { View } from 'react-native'

import { CategoryListScreen, routeParamsSchema } from '@/features/catalog'
import { DraftListBar, useDraftListStore } from '@/features/lists'

/**
 * Route: categories within a store, the step before the product list.
 *
 * Wires the catalog and lists features together. Neither imports the other —
 * that would be a cycle — so the composition happens here, which is exactly
 * what app/ is for (01-overview.md).
 */
export default function StoreCategoriesRoute() {
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

  const openCategory = useCallback(
    (categorySlug: string, categoryName: string) => {
      if (!parsed.success) return
      router.push({
        pathname: '/store/[slug]/[category]',
        params: { slug: parsed.data.slug, category: categorySlug, categoryName },
      })
    },
    [router, parsed],
  )

  if (!parsed.success) return null

  return (
    <View className="flex-1 bg-background">
      <CategoryListScreen
        storeSlug={parsed.data.slug}
        storeName={parsed.data.name}
        onCategoryPress={openCategory}
        draftQuantities={draftQuantities}
        onProductPress={openProduct}
      />
      <DraftListBar />
    </View>
  )
}
