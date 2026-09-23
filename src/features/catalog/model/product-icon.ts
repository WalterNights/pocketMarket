/**
 * Icon for a product: keyword first, category as fallback.
 *
 * Category alone gives absurd results — "Huevos AA x 30" is dairy, so it would
 * show a milk carton. Matching a keyword in the product name gets the common
 * grocery items right, and the category still covers everything else.
 *
 * Pure module: it maps to an icon NAME. Resolving the name to a component
 * happens in the UI layer, because model/ may not import React (rule 3).
 */

export const ICON_NAMES = [
  'Egg',
  'Wheat',
  'Bean',
  'Nut',
  'Droplet',
  'Coffee',
  'Candy',
  'Cookie',
  'Cake',
  'Milk',
  'Beef',
  'Fish',
  'Drumstick',
  'Ham',
  'Apple',
  'Carrot',
  'Banana',
  'Citrus',
  'Grape',
  'Croissant',
  'CupSoda',
  'Wine',
  'Beer',
  'Soup',
  'Salad',
  'Popcorn',
  'Snowflake',
  'SprayCan',
  'Bath',
  'Baby',
  'PawPrint',
  'ShoppingBasket',
] as const

export type IconName = (typeof ICON_NAMES)[number]

const FALLBACK: IconName = 'ShoppingBasket'

/**
 * Keyword to icon. Order matters: the first match wins, so more specific terms
 * must come before broader ones ("aceite de oliva" before "oliva").
 *
 * Keywords are accent-free and lowercase; the input is normalised the same way,
 * so "Plátano" matches "platano".
 */
const KEYWORD_ICONS: readonly (readonly [string, IconName])[] = [
  // Huevos
  ['huevo', 'Egg'],
  // Granos, cereales y harinas
  ['arroz', 'Wheat'],
  ['avena', 'Wheat'],
  ['harina', 'Wheat'],
  ['cereal', 'Wheat'],
  ['pasta', 'Wheat'],
  ['espagueti', 'Wheat'],
  ['macarron', 'Wheat'],
  ['quinua', 'Wheat'],
  ['trigo', 'Wheat'],
  ['maiz', 'Wheat'],
  // Leguminosas
  ['lenteja', 'Bean'],
  ['frijol', 'Bean'],
  ['garbanzo', 'Bean'],
  ['arveja', 'Bean'],
  ['haba', 'Bean'],
  ['soya', 'Bean'],
  // Frutos secos
  ['mani', 'Nut'],
  ['nuez', 'Nut'],
  ['almendra', 'Nut'],
  ['maranon', 'Nut'],
  // Aceites y líquidos
  ['aceite', 'Droplet'],
  ['vinagre', 'Droplet'],
  ['miel', 'Droplet'],
  // Café, chocolate y dulces
  ['cafe', 'Coffee'],
  ['chocolate', 'Cookie'],
  ['cacao', 'Cookie'],
  ['galleta', 'Cookie'],
  ['panela', 'Candy'],
  ['azucar', 'Candy'],
  ['dulce', 'Candy'],
  ['caramelo', 'Candy'],
  ['torta', 'Cake'],
  ['ponque', 'Cake'],
  // Lácteos
  ['leche', 'Milk'],
  ['yogur', 'Milk'],
  ['kumis', 'Milk'],
  ['queso', 'Milk'],
  ['mantequilla', 'Milk'],
  ['crema de leche', 'Milk'],
  ['arequipe', 'Milk'],
  // Carnes
  ['pollo', 'Drumstick'],
  ['pechuga', 'Drumstick'],
  ['jamon', 'Ham'],
  ['tocineta', 'Ham'],
  ['salchich', 'Ham'],
  ['chorizo', 'Ham'],
  ['carne', 'Beef'],
  ['res', 'Beef'],
  ['cerdo', 'Beef'],
  ['costilla', 'Beef'],
  ['pescado', 'Fish'],
  ['atun', 'Fish'],
  ['salmon', 'Fish'],
  ['tilapia', 'Fish'],
  ['camaron', 'Fish'],
  // Frutas y verduras
  ['banano', 'Banana'],
  ['platano', 'Banana'],
  ['manzana', 'Apple'],
  ['pera', 'Apple'],
  ['naranja', 'Citrus'],
  ['limon', 'Citrus'],
  ['mandarina', 'Citrus'],
  ['uva', 'Grape'],
  ['zanahoria', 'Carrot'],
  ['papa', 'Carrot'],
  ['yuca', 'Carrot'],
  ['cebolla', 'Carrot'],
  ['tomate', 'Salad'],
  ['lechuga', 'Salad'],
  ['espinaca', 'Salad'],
  ['ensalada', 'Salad'],
  ['aguacate', 'Salad'],
  // Panadería
  ['pan', 'Croissant'],
  ['arepa', 'Croissant'],
  ['tortilla', 'Croissant'],
  // Bebidas
  ['gaseosa', 'CupSoda'],
  ['jugo', 'CupSoda'],
  ['refresco', 'CupSoda'],
  ['agua', 'CupSoda'],
  ['te ', 'CupSoda'],
  ['vino', 'Wine'],
  ['cerveza', 'Beer'],
  // Preparados
  ['sopa', 'Soup'],
  ['caldo', 'Soup'],
  ['crema de', 'Soup'],
  ['sal', 'Soup'],
  ['pasabocas', 'Popcorn'],
  ['papas fritas', 'Popcorn'],
  ['crispeta', 'Popcorn'],
]

const CATEGORY_ICONS: Record<string, IconName> = {
  viveres: 'Wheat',
  'frutas-verduras': 'Apple',
  carnes: 'Beef',
  lacteos: 'Milk',
  panaderia: 'Croissant',
  bebidas: 'CupSoda',
  congelados: 'Snowflake',
  'aseo-hogar': 'SprayCan',
  'cuidado-personal': 'Bath',
  bebes: 'Baby',
  mascotas: 'PawPrint',
  otros: 'ShoppingBasket',
}

/** Combining diacritics left behind by NFD normalisation. */
const COMBINING_MARKS = new RegExp('[\u0300-\u036f]', 'g')

/** Lowercase and strip accents so "Plátano" matches the keyword "platano". */
function normalise(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
}

/**
 * Best icon for a product. Never returns null: an unknown product gets a
 * neutral basket rather than an empty gap in the row.
 */
export function productIconName(productName: string, categorySlug: string | null): IconName {
  const haystack = normalise(productName)

  for (const [keyword, icon] of KEYWORD_ICONS) {
    if (haystack.includes(keyword)) return icon
  }

  if (categorySlug !== null) {
    const byCategory = CATEGORY_ICONS[categorySlug]
    if (byCategory !== undefined) return byCategory
  }

  return FALLBACK
}
