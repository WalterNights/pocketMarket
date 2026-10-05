import { useRouter } from 'expo-router'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import StoreIcon from 'lucide-react-native/icons/store'
import { useCallback, type ReactNode } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { ErrorState } from '@/shared/ui'

import { useStores } from '../hooks/useStores'
import {
  distanceLabel,
  freshnessLabel,
  isBrowsable,
  type NearbyOrigin,
  type Store,
} from '../model/store'

const MUTED = '#78726B'

/** Room around the inline text links, so each one is a 44 pt target. */
const LINK_HIT_SLOP = { top: 12, bottom: 12, left: 8, right: 8 } as const

/** Where the list searches from, as the route hands it over from `branches`. */
export type StoreListOrigin = {
  coords: NearbyOrigin
  /** "Cerca de ti", "Cerca de Bogotá". */
  label: string
}

/**
 * Store picker — the step before browsing products.
 *
 * A plain ScrollView is correct here and not a violation of the list rule:
 * there are about a dozen chains and the count is bounded by how many chains
 * exist, not by remote data. FlashList is for collections of unknown length.
 */
type StoreListScreenProps = {
  /**
   * Slot at the right of the title. The account button lives in another
   * feature, so the route composes it in rather than catalog importing it.
   */
  headerAction?: ReactNode
  /**
   * Null shows every chain. With an origin, only the chains with a shop near
   * it (plan 0003). It comes from `branches` through the route (rule 1).
   */
  origin?: StoreListOrigin | null
  /** "Cambiar" / "Ver las de cerca": opens the origin picker. */
  onChangeOrigin?: () => void
  /** "Ver todas" when nothing we know is nearby: drops the origin. */
  onShowAll?: () => void
}

export function StoreListScreen({
  headerAction,
  origin = null,
  onChangeOrigin,
  onShowAll,
}: StoreListScreenProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { data: stores, isPending, isError, refetch } = useStores(origin?.coords ?? null)

  const openStore = useCallback(
    (slug: string, name: string) =>
      router.push({ pathname: '/store/[slug]', params: { slug, name } }),
    [router],
  )

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-start justify-between px-4 pb-4 pt-2">
        <View className="flex-1">
          <Text className="text-2xl font-semibold text-foreground">Tiendas</Text>
          <OriginLine origin={origin} onChangeOrigin={onChangeOrigin} />
        </View>
        {headerAction}
      </View>

      <StoreListBody
        isPending={isPending}
        isError={isError}
        onRetry={refetch}
        stores={stores ?? []}
        nearby={origin !== null}
        onShowAll={onShowAll}
        onOpenStore={openStore}
        bottomInset={insets.bottom}
      />
    </View>
  )
}

type OriginLineProps = {
  origin: StoreListOrigin | null
  onChangeOrigin?: () => void
}

/** Says which list this is, and offers the other one. */
function OriginLine({ origin, onChangeOrigin }: OriginLineProps) {
  const label = origin ? origin.label : 'Todas las tiendas'

  return (
    <View className="mt-1 flex-row flex-wrap items-center">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      {onChangeOrigin ? (
        <>
          <Text className="text-sm text-muted-foreground"> · </Text>
          <Pressable
            onPress={onChangeOrigin}
            accessibilityRole="button"
            accessibilityLabel={
              origin ? 'Cambiar desde dónde buscar tiendas' : 'Ver solo las tiendas cerca'
            }
            hitSlop={LINK_HIT_SLOP}
          >
            <Text className="text-sm text-foreground underline">
              {origin ? 'Cambiar' : 'Ver las de cerca'}
            </Text>
          </Pressable>
        </>
      ) : null}
    </View>
  )
}

const SKELETON_ROWS = ['s1', 's2', 's3', 's4'] as const

type StoreListBodyProps = {
  isPending: boolean
  isError: boolean
  onRetry: () => void
  stores: Store[]
  /** The list is filtered to an origin, so "empty" means "nothing near". */
  nearby: boolean
  onShowAll?: () => void
  onOpenStore: (slug: string, name: string) => void
  bottomInset: number
}

function StoreListBody({
  isPending,
  isError,
  onRetry,
  stores,
  nearby,
  onShowAll,
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
      <ErrorState
        title="No se pudieron cargar las tiendas"
        onRetry={onRetry}
        icon={<StoreIcon size={32} color={MUTED} strokeWidth={1.5} />}
      />
    )
  }

  if (stores.length === 0 && nearby) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <StoreIcon size={32} color={MUTED} strokeWidth={1.5} />
        <Text className="mt-3 text-center text-base text-foreground">
          No conocemos tiendas cerca de aquí
        </Text>
        {onShowAll ? (
          <Pressable
            onPress={onShowAll}
            accessibilityRole="button"
            className="mt-4 h-11 justify-center rounded-md bg-primary px-5 active:opacity-80"
          >
            <Text className="text-base font-medium text-primary-foreground">Ver todas</Text>
          </Pressable>
        ) : null}
      </View>
    )
  }

  if (stores.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <StoreIcon size={32} color={MUTED} strokeWidth={1.5} />
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
  const distance = store.nearestM === null ? null : `a ${distanceLabel(store.nearestM)}`
  const status = browsable ? `${store.productCount} productos` : 'próximamente'

  return (
    <Pressable
      onPress={() => onPress(store.slug, store.name)}
      disabled={!browsable}
      accessibilityRole="button"
      accessibilityState={{ disabled: !browsable }}
      accessibilityLabel={[store.name, status, distance].filter(Boolean).join(', ')}
      className={`mb-3 flex-row items-center rounded-lg border border-border bg-card p-4 ${
        browsable ? '' : 'opacity-50'
      }`}
    >
      <View className="mr-3 h-10 w-10 items-center justify-center rounded-md bg-muted">
        <StoreIcon size={20} color={MUTED} strokeWidth={1.5} />
      </View>

      <View className="flex-1">
        <Text className="text-base font-medium text-foreground">{store.name}</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {browsable
            ? `${store.productCount} productos · ${freshnessLabel(store.lastUpdatedAt)}`
            : 'Próximamente'}
        </Text>
      </View>

      {distance ? <Text className="ml-2 text-xs text-muted-foreground">{distance}</Text> : null}
      {browsable ? <ChevronRight size={20} color={MUTED} strokeWidth={1.5} /> : null}
    </Pressable>
  )
}
