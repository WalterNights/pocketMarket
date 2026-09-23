import { useRouter } from 'expo-router'
import Check from 'lucide-react-native/icons/check'
import Minus from 'lucide-react-native/icons/minus'
import Plus from 'lucide-react-native/icons/plus'
import Trash from 'lucide-react-native/icons/trash'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'

// lists depends on catalog: a list is made of products. The arrow only ever
// points this way — catalog never imports lists (01-overview.md).
import {
  clampQuantity,
  formatQuantity,
  MAX_QUANTITY,
  MIN_QUANTITY,
  presentationOf,
  ProductIcon,
  quantityStep,
  totalContentOf,
  unitPriceOf,
  useProduct,
  type Product,
} from '@/features/catalog'
import { formatCop } from '@/shared/utils/format-money'

import { useDraftListStore } from '../store/draft-list-store'

const MUTED = '#78726B'
const ON_PRIMARY = '#FAF8F3'

type AddToListSheetProps = {
  productId: string
}

export function AddToListSheet({ productId }: AddToListSheetProps) {
  const { data: product, isPending, isError, refetch } = useProduct(productId)

  if (isPending) {
    return (
      <View className="flex-1 bg-background p-6" accessibilityLabel="Cargando producto">
        <View className="h-5 w-2/3 rounded-sm bg-muted" />
        <View className="mt-3 h-4 w-1/2 rounded-sm bg-muted" />
        <View className="mt-8 h-12 w-full rounded-md bg-muted" />
      </View>
    )
  }

  if (isError || product === undefined) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Text className="text-center text-base text-foreground">No se pudo cargar el producto</Text>
        <Pressable
          onPress={() => refetch()}
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
          className="mt-4 h-11 justify-center rounded-md bg-primary px-5"
        >
          <Text className="text-base font-medium text-primary-foreground">Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  return <SheetContent product={product} />
}

function SheetContent({ product }: { product: Product }) {
  const router = useRouter()
  const addItem = useDraftListStore((s) => s.addItem)
  const removeItem = useDraftListStore((s) => s.removeItem)
  const savedQuantity = useDraftListStore((s) => s.items[product.id]?.quantity)

  const isInList = savedQuantity !== undefined
  const [quantity, setQuantity] = useState(savedQuantity ?? MIN_QUANTITY)

  const presentation = presentationOf(product)
  const unitPrice = unitPriceOf(product)
  const step = quantityStep(product)
  const total = product.priceCop * quantity
  const totalContent = totalContentOf(product, quantity)

  const changeBy = (delta: number) => setQuantity((q) => clampQuantity(q + delta))

  return (
    <View className="flex-1 bg-background px-6 pt-6">
      <View className="flex-row items-start">
        <View className="mr-3 h-12 w-12 items-center justify-center rounded-md bg-muted">
          <ProductIcon productName={product.name} categorySlug={product.categorySlug} size={24} />
        </View>

        <View className="flex-1">
          <Text className="text-xl font-semibold text-foreground">{product.name}</Text>
          <Text className="mt-1 text-sm text-muted-foreground">
            {[product.brand, product.storeName].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {/* Presentation stated in the user's words: a carton of 30, not "30 un". */}
      <View className="mt-6 flex-row items-end justify-between border-t border-border pt-5">
        <View>
          <Text className="text-xs text-muted-foreground">{presentation.label}</Text>
          <Text className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {formatCop(product.priceCop)}
          </Text>
        </View>
        {unitPrice !== null ? (
          <Text className="pb-1 text-sm tabular-nums text-muted-foreground">
            {formatCop(unitPrice.amountCop)}/{unitPrice.perAmount}
            {unitPrice.measure}
          </Text>
        ) : null}
      </View>

      <Text className="mt-8 text-sm text-muted-foreground">Cantidad</Text>

      <View className="mt-3 flex-row items-center justify-between">
        <StepperButton
          label="Quitar uno"
          onPress={() => changeBy(-step)}
          disabled={quantity <= MIN_QUANTITY}
          icon="minus"
        />

        <View className="flex-1 items-center">
          <Text className="text-2xl font-semibold tabular-nums text-foreground">
            {formatQuantity(product, quantity)}
          </Text>
          {totalContent !== null ? (
            <Text className="mt-1 text-xs text-muted-foreground">En total: {totalContent}</Text>
          ) : null}
        </View>

        <StepperButton
          label="Añadir uno"
          onPress={() => changeBy(step)}
          disabled={quantity >= MAX_QUANTITY}
          icon="plus"
        />
      </View>

      <View className="mt-8 flex-row items-baseline justify-between border-t border-border pt-5">
        <Text className="text-base text-muted-foreground">Total</Text>
        <Text className="text-3xl font-semibold tabular-nums text-foreground">
          {formatCop(total)}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          addItem(product, quantity)
          router.back()
        }}
        accessibilityRole="button"
        accessibilityLabel={isInList ? 'Actualizar en la lista' : 'Añadir a la lista'}
        className="mt-6 h-12 flex-row items-center justify-center rounded-md bg-primary"
      >
        <Check size={18} color={ON_PRIMARY} strokeWidth={2} />
        <Text className="ml-2 text-base font-medium text-primary-foreground">
          {isInList ? 'Actualizar en la lista' : 'Añadir a la lista'}
        </Text>
      </Pressable>

      {isInList ? (
        <Pressable
          onPress={() => {
            removeItem(product.id)
            router.back()
          }}
          accessibilityRole="button"
          accessibilityLabel="Quitar de la lista"
          className="mt-3 h-12 flex-row items-center justify-center rounded-md"
        >
          <Trash size={18} color={MUTED} strokeWidth={1.5} />
          <Text className="ml-2 text-base text-muted-foreground">Quitar de la lista</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

type StepperButtonProps = {
  label: string
  onPress: () => void
  disabled: boolean
  icon: 'plus' | 'minus'
}

/** 52pt square: comfortably past the 44pt minimum touch target. */
function StepperButton({ label, onPress, disabled, icon }: StepperButtonProps) {
  const Icon = icon === 'plus' ? Plus : Minus

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`h-[52px] w-[52px] items-center justify-center rounded-md border border-border bg-card ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <Icon size={20} color={MUTED} strokeWidth={1.5} />
    </Pressable>
  )
}
