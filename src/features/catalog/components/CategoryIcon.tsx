import type { LucideIcon } from 'lucide-react-native'
// Per-icon imports, not the barrel: lucide-react-native ships
// `sideEffects: "False"` as a STRING instead of the boolean `false`, so Metro
// cannot tree-shake it (see .claude/rules/known-issues.md).
import Apple from 'lucide-react-native/icons/apple'
import Baby from 'lucide-react-native/icons/baby'
import Bath from 'lucide-react-native/icons/bath'
import Beef from 'lucide-react-native/icons/beef'
import Croissant from 'lucide-react-native/icons/croissant'
import CupSoda from 'lucide-react-native/icons/cup-soda'
import Milk from 'lucide-react-native/icons/milk'
import PawPrint from 'lucide-react-native/icons/paw-print'
import ShoppingBasket from 'lucide-react-native/icons/shopping-basket'
import Snowflake from 'lucide-react-native/icons/snowflake'
import SprayCan from 'lucide-react-native/icons/spray-can'
import Wheat from 'lucide-react-native/icons/wheat'

import { categoryIconName } from '../model/product-icon'

/** Only the icons a category can resolve to — a subset of the product ones. */
const ICON_COMPONENTS: Record<string, LucideIcon> = {
  Wheat,
  Apple,
  Beef,
  Milk,
  Croissant,
  CupSoda,
  Snowflake,
  SprayCan,
  Bath,
  Baby,
  PawPrint,
  ShoppingBasket,
}

type CategoryIconProps = {
  categorySlug: string
  size?: number
  color?: string
}

const DEFAULT_COLOR = '#78726B'

export function CategoryIcon({
  categorySlug,
  size = 20,
  color = DEFAULT_COLOR,
}: CategoryIconProps) {
  const Icon = ICON_COMPONENTS[categoryIconName(categorySlug)] ?? ShoppingBasket

  // Decorative: the category name sits next to it and carries the meaning.
  return <Icon size={size} color={color} strokeWidth={1.5} accessibilityElementsHidden />
}
