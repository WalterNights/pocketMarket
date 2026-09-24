import { FlashList } from '@shopify/flash-list'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import ListChecks from 'lucide-react-native/icons/list-checks'
import { memo, useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { priceChangeOf } from '@/features/catalog'
import { formatCop } from '@/shared/utils/format-money'

import { useSavedLists } from '../hooks/useSavedLists'
import type { SavedListSummary } from '../model/saved-list'

const MUTED = '#78726B'
const SKELETON_ROWS = ['s1', 's2', 's3'] as const

type SavedListsScreenProps = {
  onOpenList: (listId: string) => void
  onBrowse: () => void
}

/** "Mis listas": every saved list with today's total and how it moved. */
export function SavedListsScreen({ onOpenList, onBrowse }: SavedListsScreenProps) {
  const insets = useSafeAreaInsets()
  const { data, isPending, isError, refetch, isRefetching } = useSavedLists()

  const renderItem = useCallback(
    ({ item }: { item: SavedListSummary }) => <SavedListRow list={item} onPress={onOpenList} />,
    [onOpenList],
  )

  if (isPending) {
    return (
      <View className="flex-1 bg-background px-4 pt-4" accessibilityLabel="Cargando tus listas">
        {SKELETON_ROWS.map((id) => (
          <View key={id} className="mb-3 h-[88px] rounded-lg border border-border bg-card p-4">
            <View className="h-4 w-1/2 rounded-sm bg-muted" />
            <View className="mt-3 h-3 w-1/3 rounded-sm bg-muted" />
          </View>
        ))}
      </View>
    )
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-base text-foreground">No pudimos cargar tus listas.</Text>
        <Pressable
          onPress={() => void refetch()}
          accessibilityRole="button"
          className="mt-4 h-11 justify-center rounded-md bg-primary px-5"
        >
          <Text className="text-base font-medium text-primary-foreground">Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  if (data.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <ListChecks size={32} color={MUTED} strokeWidth={1.5} />
        <Text className="mt-3 text-center text-base text-foreground">Aún no tienes listas</Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          Arma una lista y guárdala para reutilizarla cada mercado.
        </Text>
        <Pressable
          onPress={onBrowse}
          accessibilityRole="button"
          className="mt-4 h-11 justify-center rounded-md bg-primary px-5"
        >
          <Text className="text-base font-medium text-primary-foreground">Ver tiendas</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      <FlashList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onRefresh={() => void refetch()}
        refreshing={isRefetching}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 16 }}
      />
    </View>
  )
}

const keyExtractor = (item: SavedListSummary) => item.id

type SavedListRowProps = {
  list: SavedListSummary
  onPress: (listId: string) => void
}

const SavedListRow = memo(function SavedListRow({ list, onPress }: SavedListRowProps) {
  const change = priceChangeOf(list.totalAtAddCop, list.totalCop)
  const products = list.itemCount === 1 ? '1 producto' : `${list.itemCount} productos`
  const stores = list.storeCount === 1 ? '1 tienda' : `${list.storeCount} tiendas`

  return (
    <Pressable
      onPress={() => onPress(list.id)}
      accessibilityRole="button"
      accessibilityLabel={`${list.name}, ${products}, ${formatCop(list.totalCop)}`}
      className="mx-4 mb-3 flex-row items-center rounded-lg border border-border bg-card p-4 active:bg-muted"
    >
      <View className="flex-1 pr-3">
        <Text className="text-base font-medium text-foreground" numberOfLines={1}>
          {list.name}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          {products} · {stores}
        </Text>
        {change.direction === 'same' ? null : (
          // Colour informs, text carries it: "subió"/"bajó" is readable without it.
          <Text
            className={`mt-1 text-xs ${
              change.direction === 'up' ? 'text-price-up' : 'text-price-down'
            }`}
          >
            {change.direction === 'up' ? 'Subió' : 'Bajó'} {formatCop(Math.abs(change.deltaCop))}{' '}
            desde que la armaste
          </Text>
        )}
      </View>

      <Text className="text-lg font-semibold tabular-nums text-foreground">
        {formatCop(list.totalCop)}
      </Text>
      <ChevronRight size={20} color={MUTED} strokeWidth={1.5} />
    </Pressable>
  )
})
