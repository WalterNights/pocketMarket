import { useRouter } from 'expo-router'
import ChevronRight from 'lucide-react-native/icons/chevron-right'
import ShoppingCart from 'lucide-react-native/icons/shopping-cart'
import { useMemo } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { formatCop } from '@/shared/utils/format-money'

import { useDraftListStore } from '../store/draft-list-store'
import { grandTotalOf, itemCountOf } from '../model/totals'

const ON_PRIMARY = '#FAF8F3'

/**
 * Fixed bottom bar with the running total.
 *
 * The total is the number this whole app exists for, so it gets the largest
 * type on screen and nothing competes beside it. Separation from the content
 * is a top border plus surface — never a shadow
 * (docs/design/00-visual-direction.md).
 *
 * Renders nothing while the list is empty: an empty bar is chrome that steals
 * a row of products.
 */
export function DraftListBar() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const items = useDraftListStore((s) => s.items)

  const { count, total } = useMemo(() => {
    const list = Object.values(items)
    return { count: itemCountOf(list), total: grandTotalOf(list) }
  }, [items])

  if (count === 0) return null

  return (
    <View
      className="border-t border-border bg-card px-4 pt-3"
      style={{ paddingBottom: insets.bottom + 12 }}
    >
      <Pressable
        onPress={() => router.push('/list')}
        accessibilityRole="button"
        accessibilityLabel={`Ver la lista, ${count} ${
          count === 1 ? 'producto' : 'productos'
        }, total ${formatCop(total)}`}
        className="flex-row items-center"
      >
        <View className="mr-3 h-11 w-11 items-center justify-center rounded-md bg-primary">
          <ShoppingCart size={20} color={ON_PRIMARY} strokeWidth={1.5} />
        </View>

        <View className="flex-1">
          <Text className="text-xs text-muted-foreground">
            {count} {count === 1 ? 'producto' : 'productos'}
          </Text>
          <Text className="text-2xl font-semibold tabular-nums text-foreground">
            {formatCop(total)}
          </Text>
        </View>

        <ChevronRight size={22} color="#78726B" strokeWidth={1.5} />
      </Pressable>
    </View>
  )
}
