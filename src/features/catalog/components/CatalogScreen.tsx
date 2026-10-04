import { FlashList } from '@shopify/flash-list'
import { Stack } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue'
import { ErrorState, flatHeaderOptions, PocketLoader } from '@/shared/ui'

import { useProductSearch } from '../hooks/useProductSearch'
import type { Product } from '../model/product'
import { ProductRow } from './ProductRow'

/** Stable ids so the skeleton never keys off an array index. */
const SKELETON_ROWS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const

/** Long enough to skip the keystrokes of a word, short enough to feel live. */
export const SEARCH_DEBOUNCE_MS = 300

const NO_DRAFT: Record<string, number> = {}
const noop = () => {}

type CatalogScreenProps = {
  /** Scopes the catalogue to one store. Undefined searches across all of them. */
  storeSlug?: string
  storeName?: string
  /** Scopes further to a single category. */
  categorySlug?: string
  categoryName?: string
  /**
   * Search term supplied from outside. When present the screen renders no
   * search box of its own — CategoryListScreen already owns one, and two
   * stacked inputs would be nonsense. Expected already debounced.
   */
  embeddedQuery?: string
  /**
   * Units already in the draft list, keyed by product id.
   *
   * Injected rather than read from the lists feature: catalog must not import
   * lists, and lists already imports catalog. A cycle between features is the
   * one thing the dependency rule never allows, so the route wires them
   * together (01-overview.md).
   */
  draftQuantities?: Record<string, number>
  onProductPress?: (productId: string) => void
}

/**
 * Container: owns the data and decides which of the four states to render.
 * Every view backed by remote data resolves loading / error / empty / data —
 * "no network and no cache" is an everyday state on mobile, not an edge case
 * (rule 6 in CLAUDE.md).
 */
export function CatalogScreen({
  storeSlug,
  storeName,
  categorySlug,
  categoryName,
  embeddedQuery,
  draftQuantities = NO_DRAFT,
  onProductPress = noop,
}: CatalogScreenProps = {}) {
  const insets = useSafeAreaInsets()
  const [ownQuery, setOwnQuery] = useState('')

  // Only the own box is debounced here: an embedded query arrives debounced
  // by its owner, and debouncing it twice would double the wait.
  const debouncedOwnQuery = useDebouncedValue(ownQuery, SEARCH_DEBOUNCE_MS)
  const embedded = embeddedQuery !== undefined
  const query = embedded ? embeddedQuery : debouncedOwnQuery

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useProductSearch({ query, storeSlug, categorySlug })

  // Defined outside the render path of each row so memoisation actually holds.
  // Inside a single store the store name on every row is noise.
  const showStore = storeSlug === undefined
  const renderItem = useCallback(
    ({ item }: { item: Product }) => (
      <ProductRow
        product={item}
        showStore={showStore}
        onPress={onProductPress}
        inListQuantity={draftQuantities[item.id] ?? 0}
      />
    ),
    [showStore, onProductPress, draftQuantities],
  )
  const keyExtractor = useCallback((item: Product) => item.id, [])

  const products = useMemo(() => data?.pages.flat() ?? [], [data])
  const headerTitle = categoryName ?? storeName
  const ownsHeader = !embedded && headerTitle !== undefined

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: embedded || ownsHeader ? 0 : insets.top }}
    >
      {ownsHeader ? <Stack.Screen options={{ ...flatHeaderOptions, title: headerTitle }} /> : null}

      {!embedded ? (
        <View className="px-4 pb-3 pt-2">
          {headerTitle === undefined ? (
            <Text className="text-2xl font-semibold text-foreground">Buscar productos</Text>
          ) : null}
          <TextInput
            value={ownQuery}
            onChangeText={setOwnQuery}
            placeholder="Arroz, leche, aceite…"
            returnKeyType="search"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Buscar productos"
            className="mt-2 h-12 rounded-md border border-input bg-card px-3 text-base text-foreground"
          />
        </View>
      ) : null}

      <CatalogBody
        isPending={isPending}
        isError={isError}
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
    return <ErrorState title="No se pudieron cargar los productos" onRetry={onRetry} />
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
          <View className="items-center py-4">
            <PocketLoader size={5} label="Cargando más productos" />
          </View>
        ) : null
      }
    />
  )
}
