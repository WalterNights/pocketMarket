import { memo } from 'react'
import { Pressable, Text, View } from 'react-native'

import { formatCop } from '@/shared/utils/format-money'

import { unitPriceOf, type Product } from '../model/product'
import { ProductIcon } from './ProductIcon'

type ProductRowProps = {
  product: Product
  /** Inside a single store the name is redundant on every row. */
  showStore?: boolean
  onPress: (productId: string) => void
  /** Units already in the draft list, 0 when not added. */
  inListQuantity: number
}

/**
 * Row height is fixed at 72 so FlashList recycles without reflow, and it clears
 * the 44pt minimum touch target (06-design-system.md).
 *
 * Memoised with primitive-only props: passing a fresh object per row would
 * defeat memo entirely.
 */
function ProductRowComponent({
  product,
  showStore = true,
  onPress,
  inListQuantity,
}: ProductRowProps) {
  const unitPrice = unitPriceOf(product)

  const subtitle = [
    product.brand,
    showStore ? product.storeName : null,
    product.unitValue !== null && product.unitMeasure !== null
      ? `${product.unitValue}${product.unitMeasure}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const inList = inListQuantity > 0

  return (
    <Pressable
      onPress={() => onPress(product.id)}
      accessibilityRole="button"
      accessibilityLabel={`${product.name}, ${formatCop(product.priceCop)}${
        inList ? `, ${inListQuantity} en la lista` : ''
      }`}
      className="h-[72px] flex-row items-center border-b border-border px-4 active:bg-muted"
    >
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-md bg-muted">
        <ProductIcon productName={product.name} categorySlug={product.categorySlug} />
      </View>

      <View className="flex-1 pr-3">
        <Text className="text-base text-foreground" numberOfLines={1}>
          {product.name}
        </Text>
        {subtitle.length > 0 ? (
          <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View className="items-end">
        {/* Tabular figures so prices line up in a column instead of dancing. */}
        <Text className="text-base font-medium tabular-nums text-foreground">
          {formatCop(product.priceCop)}
        </Text>
        {unitPrice !== null ? (
          <Text className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {formatCop(unitPrice.amountCop)}/{unitPrice.perAmount}
            {unitPrice.measure}
          </Text>
        ) : null}
      </View>

      {/* Quantity already in the list. Text, not just a coloured dot: colour is
          never the only carrier of a signal (06-design-system.md). */}
      {inList ? (
        <View className="ml-2 h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5">
          <Text className="text-xs font-medium tabular-nums text-primary-foreground">
            {inListQuantity}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}

export const ProductRow = memo(ProductRowComponent)
