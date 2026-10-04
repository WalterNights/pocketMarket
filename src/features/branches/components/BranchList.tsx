import { FlashList } from '@shopify/flash-list'
import Store from 'lucide-react-native/icons/store'
import { memo, useCallback } from 'react'
import { Pressable, Text, View } from 'react-native'

import { distanceLabel, type Branch } from '../model/branch'

const MUTED = '#78726B'
const SKELETON_ROWS = ['s1', 's2', 's3', 's4'] as const

type BranchListProps = {
  branches: Branch[] | undefined
  isPending: boolean
  isError: boolean
  onRetry: () => void
  selectedId: string | null
  onSelect: (branch: Branch) => void
  bottomInset: number
}

/**
 * The nearest shops as a list, closest first. Also the degraded path: it is
 * readable without map tiles, so the data never depends on the map alone
 * (plan 0001, "Sin red").
 */
export function BranchList({
  branches,
  isPending,
  isError,
  onRetry,
  selectedId,
  onSelect,
  bottomInset,
}: BranchListProps) {
  const renderItem = useCallback(
    ({ item }: { item: Branch }) => (
      <BranchRow branch={item} selected={item.id === selectedId} onPress={onSelect} />
    ),
    [selectedId, onSelect],
  )

  if (isPending) {
    return (
      <View className="px-4 pt-3" accessibilityLabel="Buscando tiendas cercanas">
        {SKELETON_ROWS.map((id) => (
          <View key={id} className="mb-2 h-[64px] rounded-md bg-muted" />
        ))}
      </View>
    )
  }

  if (isError) {
    return (
      <View className="items-center px-8 pt-6">
        <Text className="text-center text-base text-foreground">
          No pudimos cargar las tiendas cercanas.
        </Text>
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          className="mt-4 h-11 justify-center rounded-md bg-primary px-5"
        >
          <Text className="text-base font-medium text-primary-foreground">Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  if (!branches || branches.length === 0) {
    return (
      <View className="items-center px-8 pt-6">
        <Store size={32} color={MUTED} strokeWidth={1.5} />
        <Text className="mt-3 text-center text-base text-foreground">
          No hay tiendas a menos de 25 km
        </Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          Prueba con otra ciudad.
        </Text>
      </View>
    )
  }

  return (
    <FlashList
      data={branches}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      extraData={selectedId}
      contentContainerStyle={{ paddingBottom: bottomInset + 16 }}
    />
  )
}

const keyExtractor = (branch: Branch) => branch.id

type BranchRowProps = {
  branch: Branch
  selected: boolean
  onPress: (branch: Branch) => void
}

const BranchRow = memo(function BranchRow({ branch, selected, onPress }: BranchRowProps) {
  const distance = distanceLabel(branch.distanceM)

  return (
    <Pressable
      onPress={() => onPress(branch)}
      accessibilityRole="button"
      accessibilityLabel={`${branch.name}, ${branch.storeName}, a ${distance}`}
      accessibilityState={{ selected }}
      className={`min-h-[64px] justify-center border-b border-border px-4 py-2 active:bg-muted ${
        selected ? 'bg-muted' : ''
      }`}
    >
      <Text className="text-base text-foreground" numberOfLines={1}>
        {branch.name}
      </Text>
      <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
        {branch.storeName} · {distance}
        {branch.address ? ` · ${branch.address}` : ''}
      </Text>
      {branch.hasPrices ? null : (
        <Text className="mt-0.5 text-xs text-muted-foreground">Precios próximamente</Text>
      )}
    </Pressable>
  )
})
