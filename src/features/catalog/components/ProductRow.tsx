import { memo } from 'react'
import { Text, View } from 'react-native'

import { formatCop } from '@/shared/utils/format-money'

import { unitPriceOf, type Product } from '../model/product'

type ProductRowProps = {
  product: Product
}

/**
 * Row height is fixed at 72 so FlashList can size without reflow, and it clears
 * the 44pt minimum touch target (06-design-system.md).
 *
 * Memoised with a primitive-only comparison: a new object per row would defeat
 * memo entirely.
 */
function ProductRowComponent({ product }: ProductRowProps) {
  const unitPrice = unitPriceOf(product)

  return (
    <View className="h-[72px] flex-row items-center justify-between border-b border-border px-4">
      <View className="flex-1 pr-3">
        <Text className="text-base text-foreground" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="mt-0.5 text-xs text-muted-foreground" numberOfLines={1}>
          {[product.brand, product.storeName].filter(Boolean).join(' · ')}
          {product.unitValue !== null && product.unitMeasure !== null
            ? ` · ${product.unitValue}${product.unitMeasure}`
            : ''}
        </Text>
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
    </View>
  )
}

export const ProductRow = memo(ProductRowComponent)
