import { FlashList } from '@shopify/flash-list'
import { useRouter } from 'expo-router'
import ShoppingCart from 'lucide-react-native/icons/shopping-cart'
import Trash from 'lucide-react-native/icons/trash'
import { useCallback, useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { formatQuantity, ProductIcon } from '@/features/catalog'
import { formatCop } from '@/shared/utils/format-money'

import { grandTotalOf, subtotalOf, totalsByStore, type DraftItem } from '../model/totals'
import { selectEditing, useDraftListStore, type EditingList } from '../store/draft-list-store'

const MUTED = '#78726B'

/**
 * The list being built, with the per-store breakdown.
 *
 * "Saco $92.950: $48.300 para el Éxito y $31.750 para el D1" is the sentence
 * this app exists to answer (docs/domain/00-overview.md).
 */
export function DraftListScreen() {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const items = useDraftListStore((s) => s.items)
  const clear = useDraftListStore((s) => s.clear)
  const editing = useDraftListStore(selectEditing)

  const list = useMemo(() => Object.values(items), [items])
  const byStore = useMemo(() => totalsByStore(list), [list])
  const total = useMemo(() => grandTotalOf(list), [list])

  const openProduct = useCallback(
    (productId: string) => router.push({ pathname: '/product/[id]', params: { id: productId } }),
    [router],
  )

  const renderItem = useCallback(
    ({ item }: { item: DraftItem }) => <DraftRow item={item} onPress={openProduct} />,
    [openProduct],
  )

  const keyExtractor = useCallback((item: DraftItem) => item.product.id, [])

  // Leaving edit mode drops the unsaved changes; the saved list is untouched.
  const cancelEdit = useCallback(() => {
    clear()
    router.back()
  }, [clear, router])

  if (list.length === 0) {
    return (
      <View className="flex-1 bg-background">
        {editing ? <EditingBanner editing={editing} onCancel={cancelEdit} /> : null}
        <View className="flex-1 items-center justify-center px-8">
          <ShoppingCart size={32} color={MUTED} strokeWidth={1.5} />
          <Text className="mt-3 text-center text-base text-foreground">Tu lista está vacía</Text>
          <Text className="mt-1 text-center text-sm text-muted-foreground">
            Toca un producto para añadirlo y ver cuánto necesitas.
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-background">
      {editing ? <EditingBanner editing={editing} onCancel={cancelEdit} /> : null}
      <FlashList
        data={list}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingBottom: 16 }}
        ListFooterComponent={editing ? null : <ClearButton onPress={clear} />}
      />

      {/* Totals bar: overall total in the largest type, per-store breakdown
          beneath it. Separated by border and surface, no shadow. */}
      <View
        className="border-t border-border bg-card px-4 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {byStore.length > 1 ? (
          <View className="mb-3">
            {byStore.map((store) => (
              <View key={store.storeSlug} className="flex-row justify-between py-0.5">
                <Text className="text-sm text-muted-foreground">
                  {store.storeName} · {store.itemCount}{' '}
                  {store.itemCount === 1 ? 'producto' : 'productos'}
                </Text>
                <Text className="text-sm tabular-nums text-foreground">
                  {formatCop(store.subtotalCop)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View className="flex-row items-baseline justify-between border-t border-border pt-3">
          <Text className="text-base text-muted-foreground">Total</Text>
          <Text className="text-3xl font-semibold tabular-nums text-foreground">
            {formatCop(total)}
          </Text>
        </View>

        <Text className="mt-2 text-xs text-muted-foreground">
          Estimado con los precios publicados por las tiendas.
        </Text>

        {/* Saving asks for a session: /save-list lives behind the private guard. */}
        <Pressable
          onPress={() => router.push('/save-list')}
          accessibilityRole="button"
          className="mt-4 h-12 items-center justify-center rounded-md bg-primary active:opacity-80"
        >
          <Text className="text-base font-medium text-primary-foreground">
            {editing ? 'Guardar cambios' : 'Guardar lista'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

type DraftRowProps = {
  item: DraftItem
  onPress: (productId: string) => void
}

function DraftRow({ item, onPress }: DraftRowProps) {
  const { product, quantity } = item

  return (
    <Pressable
      onPress={() => onPress(product.id)}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatQuantity(product, quantity)}, ${formatCop(
        subtotalOf(item),
      )}`}
      className="h-[72px] flex-row items-center border-b border-border px-4 active:bg-muted"
    >
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-md bg-muted">
        <ProductIcon productName={product.name} categorySlug={product.categorySlug} />
      </View>

      <View className="flex-1 pr-3">
        <Text className="text-base text-foreground" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {formatQuantity(product, quantity)} · {product.storeName}
        </Text>
      </View>

      <Text className="text-base font-medium tabular-nums text-foreground">
        {formatCop(subtotalOf(item))}
      </Text>
    </Pressable>
  )
}

function ClearButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Vaciar la lista"
      className="mt-4 h-11 flex-row items-center justify-center"
    >
      <Trash size={16} color={MUTED} strokeWidth={1.5} />
      <Text className="ml-2 text-sm text-muted-foreground">Vaciar la lista</Text>
    </Pressable>
  )
}

function EditingBanner({ editing, onCancel }: { editing: EditingList; onCancel: () => void }) {
  return (
    <View className="flex-row items-center border-b border-border bg-card px-4 py-2">
      <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
        Editando <Text className="font-semibold">{editing.name}</Text>
      </Text>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancelar la edición"
        hitSlop={8}
        className="h-11 justify-center pl-3"
      >
        <Text className="text-sm font-medium text-foreground underline">Cancelar</Text>
      </Pressable>
    </View>
  )
}
