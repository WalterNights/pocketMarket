import { Stack } from 'expo-router'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import LayoutGrid from 'lucide-react-native/icons/layout-grid'
import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import { useStoreCategories } from '../hooks/useStoreCategories'
import type { StoreCategory } from '../model/category'
import { CatalogScreen } from './CatalogScreen'
import { CategoryIcon } from './CategoryIcon'

const MUTED = '#78726B'

type CategoryListScreenProps = {
  storeSlug: string
  storeName?: string
  onCategoryPress: (categorySlug: string, categoryName: string) => void
  /** Forwarded to the search results, which are products like anywhere else. */
  draftQuantities?: Record<string, number>
  onProductPress?: (productId: string) => void
}

/**
 * Categories within a store — the step that keeps dairy out of the grains list.
 *
 * The search box lives here rather than inside each category: looking for
 * "arroz" should not require guessing which aisle it is in. Typing switches
 * this screen to store-wide results; clearing it goes back to the categories.
 */
export function CategoryListScreen({
  storeSlug,
  storeName,
  onCategoryPress,
  draftQuantities,
  onProductPress,
}: CategoryListScreenProps) {
  const [query, setQuery] = useState('')
  const { data: categories, isPending, isError, refetch } = useStoreCategories(storeSlug)

  const searching = query.trim().length > 0

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: storeName ?? 'Tienda',
          headerShown: true,
          headerBackTitle: 'Tiendas',
          headerStyle: { backgroundColor: '#FAF8F3' },
          headerTintColor: '#1F1D1B',
          headerShadowVisible: false,
        }}
      />

      <View className="px-4 pb-3 pt-2">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar en toda la tienda…"
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Buscar productos en toda la tienda"
          className="h-12 rounded-md border border-input bg-card px-3 text-base text-foreground"
        />
      </View>

      {searching ? (
        <CatalogScreen
          storeSlug={storeSlug}
          embeddedQuery={query}
          draftQuantities={draftQuantities}
          onProductPress={onProductPress}
        />
      ) : (
        <CategoryBody
          isPending={isPending}
          isError={isError}
          onRetry={refetch}
          categories={categories ?? []}
          onCategoryPress={onCategoryPress}
        />
      )}
    </View>
  )
}

const SKELETON_ROWS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as const

type CategoryBodyProps = {
  isPending: boolean
  isError: boolean
  onRetry: () => void
  categories: StoreCategory[]
  onCategoryPress: (categorySlug: string, categoryName: string) => void
}

function CategoryBody({
  isPending,
  isError,
  onRetry,
  categories,
  onCategoryPress,
}: CategoryBodyProps) {
  if (isPending) {
    return (
      <View className="px-4" accessibilityLabel="Cargando categorías">
        {SKELETON_ROWS.map((rowId) => (
          <View key={rowId} className="mb-2 h-[64px] rounded-lg border border-border bg-card p-4">
            <View className="h-4 w-1/3 rounded-sm bg-muted" />
            <View className="mt-2 h-3 w-1/4 rounded-sm bg-muted" />
          </View>
        ))}
      </View>
    )
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <LayoutGrid size={32} color={MUTED} strokeWidth={1.5} />
        <Text className="mt-3 text-center text-base text-foreground">
          No se pudieron cargar las categorías
        </Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
          className="mt-4 h-11 justify-center rounded-md bg-primary px-5"
        >
          <Text className="text-base font-medium text-primary-foreground">Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  if (categories.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <LayoutGrid size={32} color={MUTED} strokeWidth={1.5} />
        <Text className="mt-3 text-center text-base text-foreground">
          Esta tienda aún no tiene productos
        </Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          El catálogo se llena con la ingesta de precios.
        </Text>
      </View>
    )
  }

  return (
    <ScrollView
      className="px-4"
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {categories.map((category) => (
        <Pressable
          key={category.id}
          onPress={() => onCategoryPress(category.slug, category.name)}
          accessibilityRole="button"
          accessibilityLabel={`${category.name}, ${category.productCount} productos`}
          className="mb-2 h-[64px] flex-row items-center rounded-lg border border-border bg-card px-4 active:bg-muted"
        >
          <View className="mr-3 h-9 w-9 items-center justify-center rounded-md bg-muted">
            <CategoryIcon categorySlug={category.slug} />
          </View>

          <View className="flex-1">
            <Text className="text-base font-medium text-foreground">{category.name}</Text>
            <Text className="mt-0.5 text-xs text-muted-foreground">
              {category.productCount} {category.productCount === 1 ? 'producto' : 'productos'}
            </Text>
          </View>

          <ChevronRight size={20} color={MUTED} strokeWidth={1.5} />
        </Pressable>
      ))}
    </ScrollView>
  )
}
