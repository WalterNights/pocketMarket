import { FlashList } from '@shopify/flash-list'
import Pencil from 'lucide-react-native/icons/pencil'
import Trash from 'lucide-react-native/icons/trash'
import { memo, useCallback, useMemo } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  formatQuantity,
  priceChangeOf,
  ProductIcon,
  useProductsByIds,
  type Product,
} from '@/features/catalog'
import { ReminderCard } from '@/features/reminders'
import { formatCop } from '@/shared/utils/format-money'

import { useDeleteList, useSavedList, useSavedListTotals } from '../hooks/useSavedLists'
import { splitForEdit, type SavedListItem } from '../model/saved-list'
import { useDraftListStore } from '../store/draft-list-store'

const FOREGROUND = '#1F1D1B'
const DESTRUCTIVE = '#A33F3F'

type SavedListScreenProps = {
  listId: string
  /** Called once the list is loaded into the draft, to open the editor. */
  onEdit: () => void
  onEditReminder: () => void
  onDeleted: () => void
}

/**
 * A saved list with today's prices. The total and the per-store split come
 * from the server (list_totals, rule 17); each row shows how its price moved
 * since it was added.
 */
export function SavedListScreen({
  listId,
  onEdit,
  onEditReminder,
  onDeleted,
}: SavedListScreenProps) {
  const insets = useSafeAreaInsets()
  const list = useSavedList(listId)
  const totals = useSavedListTotals(listId)
  const productIds = useMemo(
    () => list.data?.items.map((item) => item.productId) ?? [],
    [list.data],
  )
  const products = useProductsByIds(productIds)
  const deleteList = useDeleteList()

  const productById = useMemo(
    () => new Map((products.data ?? []).map((product) => [product.id, product])),
    [products.data],
  )

  const renderItem = useCallback(
    ({ item }: { item: SavedListItem }) => (
      <SavedItemRow item={item} product={productById.get(item.productId)} />
    ),
    [productById],
  )

  if (list.isPending) {
    return (
      <View className="flex-1 bg-background px-4 pt-4" accessibilityLabel="Cargando la lista">
        <View className="h-[76px] rounded-lg border border-border bg-card" />
        {['r1', 'r2', 'r3'].map((id) => (
          <View key={id} className="mt-3 h-[60px] rounded-md bg-muted" />
        ))}
      </View>
    )
  }

  if (list.isError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-base text-foreground">No pudimos cargar esta lista.</Text>
        <Pressable
          onPress={() => void list.refetch()}
          accessibilityRole="button"
          className="mt-4 h-11 justify-center rounded-md bg-primary px-5"
        >
          <Text className="text-base font-medium text-primary-foreground">Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  const saved = list.data
  const canEdit = products.isSuccess

  const startEdit = () => {
    const state = useDraftListStore.getState()
    // Already editing this very list: go back to it, keeping unsaved changes.
    if (state.editing?.listId === saved.id) {
      onEdit()
      return
    }

    const load = () => {
      const { draft, kept } = splitForEdit(saved, products.data ?? [])
      state.loadForEdit({ listId: saved.id, name: saved.name, kept }, draft)
      onEdit()
    }

    if (Object.keys(state.items).length === 0) {
      load()
      return
    }

    Alert.alert(
      'Tienes una lista sin guardar',
      'Si editas esta lista, la que estabas armando se descarta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Descartar y editar', style: 'destructive', onPress: load },
      ],
    )
  }

  const confirmDelete = () =>
    Alert.alert('Eliminar lista', `"${saved.name}" y su aviso se borrarán. No se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => deleteList.mutate(saved.id, { onSuccess: onDeleted }),
      },
    ])

  const grandTotal = (totals.data ?? []).reduce((sum, store) => sum + store.subtotalCop, 0)

  return (
    <View className="flex-1 bg-background">
      <FlashList
        data={saved.items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={productById}
        ListHeaderComponent={
          <View className="px-4 pb-2 pt-4">
            <ReminderCard listId={saved.id} onEdit={onEditReminder} />
            <Text className="mb-1 mt-6 text-sm font-medium text-muted-foreground">
              {saved.items.length} {saved.items.length === 1 ? 'producto' : 'productos'}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View className="px-4 pb-4 pt-4">
            {products.isError ? (
              <Pressable
                onPress={() => void products.refetch()}
                accessibilityRole="button"
                className="mb-3 h-11 justify-center"
              >
                <Text className="text-sm text-muted-foreground">
                  No pudimos traer los precios de hoy.{' '}
                  <Text className="font-medium text-foreground underline">Reintentar</Text>
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={startEdit}
              disabled={!canEdit}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canEdit }}
              className={`h-12 flex-row items-center justify-center rounded-md border border-border bg-card ${
                canEdit ? 'active:bg-muted' : 'opacity-50'
              }`}
            >
              <Pencil size={18} color={FOREGROUND} strokeWidth={1.75} />
              <Text className="ml-2 text-base font-medium text-foreground">Editar productos</Text>
            </Pressable>

            <Pressable
              onPress={confirmDelete}
              disabled={deleteList.isPending}
              accessibilityRole="button"
              accessibilityState={{ disabled: deleteList.isPending, busy: deleteList.isPending }}
              className="mt-3 h-12 flex-row items-center justify-center rounded-md active:bg-muted"
            >
              <Trash size={18} color={DESTRUCTIVE} strokeWidth={1.75} />
              <Text className="ml-2 text-base font-medium text-destructive">
                {deleteList.isPending ? 'Eliminando…' : 'Eliminar lista'}
              </Text>
            </Pressable>
            {deleteList.isError ? (
              <Text className="mt-2 text-center text-sm text-destructive">
                No se pudo eliminar. Revisa tu conexión.
              </Text>
            ) : null}
          </View>
        }
      />

      {/* Totals from the server. Same bar as the draft: border and surface, no shadow. */}
      <View
        className="border-t border-border bg-card px-4 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {totals.data && totals.data.length > 1 ? (
          <View className="mb-3">
            {totals.data.map((store) => (
              <View key={store.storeSlug} className="flex-row justify-between py-0.5">
                <Text className="text-sm text-muted-foreground">{store.storeName}</Text>
                <Text className="text-sm tabular-nums text-foreground">
                  {formatCop(store.subtotalCop)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View className="flex-row items-baseline justify-between">
          <Text className="text-base text-muted-foreground">Total hoy</Text>
          {totals.isPending ? (
            <View className="h-8 w-32 rounded-sm bg-muted" />
          ) : totals.isError ? (
            <Pressable onPress={() => void totals.refetch()} accessibilityRole="button">
              <Text className="text-sm text-foreground underline">Reintentar</Text>
            </Pressable>
          ) : (
            <Text className="text-3xl font-semibold tabular-nums text-foreground">
              {formatCop(grandTotal)}
            </Text>
          )}
        </View>
      </View>
    </View>
  )
}

const keyExtractor = (item: SavedListItem) => item.productId

type SavedItemRowProps = {
  item: SavedListItem
  /** Absent when the product has no price today. */
  product: Product | undefined
}

const SavedItemRow = memo(function SavedItemRow({ item, product }: SavedItemRowProps) {
  const quantityText = product
    ? formatQuantity(product, item.quantity)
    : `${item.quantity} ${item.quantity === 1 ? 'unidad' : 'unidades'}`

  if (product === undefined) {
    return (
      <View className="h-[72px] flex-row items-center border-b border-border px-4 opacity-60">
        <View className="flex-1 pr-3">
          <Text className="text-base text-foreground" numberOfLines={1}>
            {item.productName}
          </Text>
          <Text className="mt-0.5 text-xs text-muted-foreground">
            {quantityText} · Sin precio hoy
          </Text>
        </View>
        <Text className="text-sm tabular-nums text-muted-foreground">
          {formatCop(Math.round(item.priceCopAtAdd * item.quantity))}
        </Text>
      </View>
    )
  }

  const change = priceChangeOf(item.priceCopAtAdd, product.priceCop)

  return (
    <View className="min-h-[72px] flex-row items-center border-b border-border px-4 py-2">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-md bg-muted">
        <ProductIcon productName={product.name} categorySlug={product.categorySlug} />
      </View>

      <View className="flex-1 pr-3">
        <Text className="text-base text-foreground" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {quantityText} · {product.storeName}
        </Text>
        {change.direction === 'same' ? null : (
          <Text
            className={`text-xs ${change.direction === 'up' ? 'text-price-up' : 'text-price-down'}`}
          >
            {change.direction === 'up' ? 'Subió' : 'Bajó'} {formatCop(Math.abs(change.deltaCop))}
          </Text>
        )}
      </View>

      <Text className="text-base font-medium tabular-nums text-foreground">
        {formatCop(Math.round(product.priceCop * item.quantity))}
      </Text>
    </View>
  )
})
