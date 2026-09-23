import type { LucideIcon } from 'lucide-react-native'
// Per-icon imports, not the barrel: lucide-react-native ships
// `sideEffects: "False"` as a STRING instead of the boolean `false`, so Metro
// cannot tree-shake it and the barrel drags all 1839 icons into the bundle
// (~2 MB measured). See .claude/rules/known-issues.md
import Apple from 'lucide-react-native/icons/apple'
import Baby from 'lucide-react-native/icons/baby'
import Banana from 'lucide-react-native/icons/banana'
import Bath from 'lucide-react-native/icons/bath'
import Bean from 'lucide-react-native/icons/bean'
import Beef from 'lucide-react-native/icons/beef'
import Beer from 'lucide-react-native/icons/beer'
import Cake from 'lucide-react-native/icons/cake'
import Candy from 'lucide-react-native/icons/candy'
import Carrot from 'lucide-react-native/icons/carrot'
import Citrus from 'lucide-react-native/icons/citrus'
import Coffee from 'lucide-react-native/icons/coffee'
import Cookie from 'lucide-react-native/icons/cookie'
import Croissant from 'lucide-react-native/icons/croissant'
import CupSoda from 'lucide-react-native/icons/cup-soda'
import Drumstick from 'lucide-react-native/icons/drumstick'
import Droplet from 'lucide-react-native/icons/droplet'
import Egg from 'lucide-react-native/icons/egg'
import Fish from 'lucide-react-native/icons/fish'
import Grape from 'lucide-react-native/icons/grape'
import Ham from 'lucide-react-native/icons/ham'
import Milk from 'lucide-react-native/icons/milk'
import Nut from 'lucide-react-native/icons/nut'
import PawPrint from 'lucide-react-native/icons/paw-print'
import Popcorn from 'lucide-react-native/icons/popcorn'
import Salad from 'lucide-react-native/icons/salad'
import ShoppingBasket from 'lucide-react-native/icons/shopping-basket'
import Snowflake from 'lucide-react-native/icons/snowflake'
import Soup from 'lucide-react-native/icons/soup'
import SprayCan from 'lucide-react-native/icons/spray-can'
import Wheat from 'lucide-react-native/icons/wheat'
import Wine from 'lucide-react-native/icons/wine'

import { productIconName, type IconName } from '../model/product-icon'

const ICON_COMPONENTS: Record<IconName, LucideIcon> = {
  Egg,
  Wheat,
  Bean,
  Nut,
  Droplet,
  Coffee,
  Candy,
  Cookie,
  Cake,
  Milk,
  Beef,
  Fish,
  Drumstick,
  Ham,
  Apple,
  Carrot,
  Banana,
  Citrus,
  Grape,
  Croissant,
  CupSoda,
  Wine,
  Beer,
  Soup,
  Salad,
  Popcorn,
  Snowflake,
  SprayCan,
  Bath,
  Baby,
  PawPrint,
  ShoppingBasket,
}

type ProductIconProps = {
  productName: string
  categorySlug: string | null
  size?: number
  color?: string
}

/** Muted foreground. Line icons inherit text colour, never carry their own. */
const DEFAULT_COLOR = '#78726B'

export function ProductIcon({
  productName,
  categorySlug,
  size = 20,
  color = DEFAULT_COLOR,
}: ProductIconProps) {
  const Icon = ICON_COMPONENTS[productIconName(productName, categorySlug)]

  // Decorative: the product name sits right next to it and already carries the
  // meaning, so announcing the icon would only make the screen reader noisier.
  return <Icon size={size} color={color} strokeWidth={1.5} accessibilityElementsHidden />
}
