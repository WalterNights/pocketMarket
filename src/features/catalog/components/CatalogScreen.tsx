import { FlashList } from '@shopify/flash-list'
import { Stack } from 'expo-router'
import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useProductSearch } from '../hooks/useProductSearch'
import type { Product } from '../model/product'
import { ProductRow } from './ProductRow'

/** Stable ids so the skeleton never keys off an array index. */
const SKELETON_ROWS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const

/**
 * Container: owns the data and decides which of the four states to render.
 * Every view backed by remote data resolves loading / error / empty / data —
 * "no network and no cache" is an everyday state on mobile, not an edge case
 * (rule 6 in CLAUDE.md).
 */
type CatalogScreenProps = {
  /** Scopes the catalogue to one store. Undefined searches across all of them. */
  storeSlug?: string
  storeName?: string
}

export function CatalogScreen({ storeSlug, storeName }: CatalogScreenProps = {}) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')

  const {
    data,
    isPending,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useProductSearch({ query, storeSlug })

  // Defined outside the render path of each row so memoisation actually holds.
  const showStore = storeSlug === undefined
  const renderItem = useCallback(
    ({ item }: { item: Product }) => <ProductRow product={item} showStore={showStore} />,
    [showStore],
  )
  const keyExtractor = useCallback((item: Product) => item.id, [])

  const products = data?.pages.flat() ?? []

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: storeSlug === undefined ? insets.top : 0 }}
    >
      {storeName !== undefined ? (
        <Stack.Screen
          options={{
            title: storeName,
            headerShown: true,
            headerBackTitle: 'Tiendas',
            headerStyle: { backgroundColor: '#FAF8F3' },
            headerTintColor: '#1F1D1B',
            // Flat header: separation comes from surface and border, never shadow
            // (docs/design/00-visual-direction.md).
            headerShadowVisible: false,
          }}
        />
      ) : null}

      <View className="px-4 pb-3 pt-2">
        {storeSlug === undefined ? (
          <Text className="text-2xl font-semibold text-foreground">Buscar productos</Text>
        ) : null}
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Arroz, leche, aceite…"
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Buscar productos"
          className="mt-2 h-12 rounded-md border border-input bg-card px-3 text-base text-foreground"
        />
      </View>

      <CatalogBody
        isPending={isPending}
        isError={isError}
        error={error}
        onRetry={refetch}
        products={products}
        query={query}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
        }}
        isFetchingNextPage={isFetchingNextPage}
        bottomInset={insets.bottom}
      />
    </View>
  )
}

type CatalogBodyProps = {
  isPending: boolean
  isError: boolean
  error: Error | null
  onRetry: () => void
  products: Product[]
  query: string
  renderItem: ({ item }: { item: Product }) => React.ReactElement
  keyExtractor: (item: Product) => string
  onEndReached: () => void
  isFetchingNextPage: boolean
  bottomInset: number
}

function CatalogBody({
  isPending,
  isError,
  onRetry,
  products,
  query,
  renderItem,
  keyExtractor,
  onEndReached,
  isFetchingNextPage,
  bottomInset,
}: CatalogBodyProps) {
  // 1. Loading — skeleton shaped like the real content, not a centred spinner.
  if (isPending) {
    return (
      <View accessibilityLabel="Cargando productos">
        {SKELETON_ROWS.map((rowId) => (
          <View key={rowId} className="h-[72px] justify-center border-b border-border px-4">
            <View className="h-4 w-1/2 rounded-sm bg-muted" />
            <View className="mt-2 h-3 w-1/3 rounded-sm bg-muted" />
          </View>
        ))}
      </View>
    )
  }

  // 2. Error — actionable, with a retry. Never a dead end.
  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-base text-foreground">
          No se pudieron cargar los productos
        </Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          Revisa tu conexión e inténtalo de nuevo.
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

  // 3. Empty — a line icon, a sentence and an action. No illustration.
  if (products.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-base text-foreground">
          {query.trim().length > 0 ? 'Sin resultados' : 'Aún no hay productos'}
        </Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          {query.trim().length > 0
            ? `No encontramos nada para "${query.trim()}".`
            : 'El catálogo se llena con la ingesta de precios.'}
        </Text>
      </View>
    )
  }

  // 4. Data
  return (
    <FlashList
      data={products}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="py-4">
            <ActivityIndicator />
          </View>
        ) : null
      }
    />
  )
}
