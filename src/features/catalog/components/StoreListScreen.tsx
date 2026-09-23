import { useRouter } from 'expo-router'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import StoreIcon from 'lucide-react-native/icons/store'
import { useCallback } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useStores } from '../hooks/useStores'
import { freshnessLabel, isBrowsable, type Store } from '../model/store'

/**
 * Store picker — the step before browsing products.
 *
 * A plain ScrollView is correct here and not a violation of the list rule:
 * there are four stores and the count is bounded by how many chains exist, not
 * by remote data. FlashList is for collections of unknown length.
 */
export function StoreListScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { data: stores, isPending, isError, refetch } = useStores()

  const openStore = useCallback(
    (slug: string, name: string) =>
      router.push({ pathname: '/store/[slug]/index', params: { slug, name } }),
    [router],
  )

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="px-4 pb-4 pt-2">
        <Text className="text-2xl font-semibold text-foreground">Tiendas</Text>
        <Text className="mt-1 text-sm text-muted-foreground">Elige dónde quieres ver precios</Text>
      </View>

      <StoreListBody
        isPending={isPending}
        isError={isError}
        onRetry={refetch}
        stores={stores ?? []}
        onOpenStore={openStore}
        bottomInset={insets.bottom}
      />
    </View>
  )
}

const SKELETON_ROWS = ['s1', 's2', 's3', 's4'] as const

type StoreListBodyProps = {
  isPending: boolean
  isError: boolean
  onRetry: () => void
  stores: Store[]
  onOpenStore: (slug: string, name: string) => void
  bottomInset: number
}

function StoreListBody({
  isPending,
  isError,
  onRetry,
  stores,
  onOpenStore,
  bottomInset,
}: StoreListBodyProps) {
  if (isPending) {
    return (
      <View className="px-4" accessibilityLabel="Cargando tiendas">
        {SKELETON_ROWS.map((rowId) => (
          <View key={rowId} className="mb-3 h-[84px] rounded-lg border border-border bg-card p-4">
            <View className="h-4 w-1/3 rounded-sm bg-muted" />
            <View className="mt-3 h-3 w-1/2 rounded-sm bg-muted" />
          </View>
        ))}
      </View>
    )
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <StoreIcon size={32} color="#78726B" strokeWidth={1.5} />
        <Text className="mt-3 text-center text-base text-foreground">
          No se pudieron cargar las tiendas
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

  if (stores.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <StoreIcon size={32} color="#78726B" strokeWidth={1.5} />
        <Text className="mt-3 text-center text-base text-foreground">Aún no hay tiendas</Text>
      </View>
    )
  }

  return (
    <ScrollView
      className="px-4"
      contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
      showsVerticalScrollIndicator={false}
    >
      {stores.map((store) => (
        <StoreCard key={store.id} store={store} onPress={onOpenStore} />
      ))}
    </ScrollView>
  )
}

type StoreCardProps = {
  store: Store
  onPress: (slug: string, name: string) => void
}

function StoreCard({ store, onPress }: StoreCardProps) {
  const browsable = isBrowsable(store)

  return (
    <Pressable
      onPress={() => onPress(store.slug, store.name)}
      disabled={!browsable}
      accessibilityRole="button"
      accessibilityState={{ disabled: !browsable }}
      accessibilityLabel={`${store.name}, ${store.productCount} productos`}
      className={`mb-3 flex-row items-center rounded-lg border border-border bg-card p-4 ${
        browsable ? '' : 'opacity-50'
      }`}
    >
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-md bg-muted">
        <StoreIcon size={20} color="#78726B" strokeWidth={1.5} />
      </View>

      <View className="flex-1">
        <Text className="text-base font-medium text-foreground">{store.name}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {browsable
            ? `${store.productCount} productos · ${freshnessLabel(store.lastUpdatedAt)}`
            : 'Próximamente'}
        </Text>
      </View>

      {browsable ? <ChevronRight size={20} color="#78726B" strokeWidth={1.5} /> : null}
    </Pressable>
  )
}
