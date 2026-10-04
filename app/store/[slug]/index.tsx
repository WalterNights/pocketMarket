import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback } from 'react'
import { View } from 'react-native'

import { CategoryListScreen, routeParamsSchema } from '@/features/catalog'
import { DraftListBar, useDraftQuantities } from '@/features/lists'
import { NotFound } from '@/shared/ui'

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
  const slug = parsed.success ? parsed.data.slug : null

  const draftQuantities = useDraftQuantities()

  const openProduct = useCallback(
    (productId: string) => router.push({ pathname: '/product/[id]', params: { id: productId } }),
    [router],
  )

  // Depends on the slug string, not on `parsed`: safeParse returns a new object
  // every render, which would recreate this callback every time.
  const openCategory = useCallback(
    (categorySlug: string, categoryName: string) => {
      if (slug === null) return
      router.push({
        pathname: '/store/[slug]/[category]',
        params: { slug, category: categorySlug, categoryName },
      })
    },
    [router, slug],
  )

  if (!parsed.success) return <NotFound title="Esta tienda no existe" />

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
