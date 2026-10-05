import { createVtexCatalogAdapter, type VtexCategory } from './vtex-catalog'

/**
 * D1 — VTEX, same public catalogue endpoint as Éxito (plan 0003). Researched
 * 2026-10-04 against /api/catalog_system/pub/category/tree/2.
 *
 * The aisles are top-level (parentPath ''), and a level-2 category is only
 * found through its full path: `fq=C:/52/` returns nothing, `fq=C:/6/52/` does.
 * That is why some ids below are paths ('6/52'): the factory puts them after
 * `C:` verbatim.
 *
 * Only the grocery aisles. Left out: liquor and cigarettes, personal care
 * (Éxito's set has no equivalent), clothes, electronics, toys, school supplies,
 * the seasonal ("Extraordinario de Temporada"), "Campaña" and "Donaciones".
 *
 * The whole grocery catalogue is ~1.200 products, far below the VTEX
 * pagination ceiling (ING-005). Despensa is split into its subcategories
 * because it mixes staples with snacks and sweets, which Éxito keeps apart.
 *
 * One national price: the record carries a single seller, and sc=1 and sc=2
 * return the same price (checked 2026-10-04; sc=3 is "not found").
 *
 * The name comes from `productName`: when the SKU's name differs from the
 * product's, VTEX's `nameComplete` is both glued together — "Leche
 * Deslactosada Tetrapak UHT Latti 900 Ml Leche Deslac Tetrapak UHT Latti 900
 * Ml" (6 of 326 records sampled).
 */
export const D1_CATEGORIES: readonly VtexCategory[] = [
  { id: '1/16', label: 'Despensa > Caldos sopas y bases', slug: 'viveres' },
  { id: '1/17', label: 'Despensa > Condimentos', slug: 'viveres' },
  { id: '1/18', label: 'Despensa > Enlatados y envasados', slug: 'viveres' },
  { id: '1/19', label: 'Despensa > Pasta', slug: 'viveres' },
  { id: '1/20', label: 'Despensa > Granos azucar y panela', slug: 'viveres' },
  { id: '1/21', label: 'Despensa > Harinas y pre-mezclas', slug: 'viveres' },
  { id: '1/22', label: 'Despensa > Margarinas y aceites', slug: 'viveres' },
  { id: '1/23', label: 'Despensa > Salsas y aderezos', slug: 'viveres' },
  { id: '1/24', label: 'Despensa > Arepas', slug: 'viveres' },
  { id: '1/25', label: 'Despensa > Cereales', slug: 'viveres' },
  { id: '1/28', label: 'Despensa > Saludable y bienestar', slug: 'viveres' },
  { id: '1/29', label: 'Despensa > Cafés y chocolates', slug: 'viveres' },
  { id: '1/26', label: 'Despensa > Pasabocas y snacks', slug: 'otros' },
  { id: '1/27', label: 'Despensa > Dulcería', slug: 'otros' },
  { id: '1/30', label: 'Despensa > Comidas listas', slug: 'otros' },
  { id: '2', label: 'Lacteos y huevos', slug: 'lacteos' },
  { id: '4', label: 'Pollo carne y pescado', slug: 'carnes' },
  { id: '8', label: 'Carnes Frías y delikatessen', slug: 'carnes' },
  { id: '9', label: 'Frutas y verduras', slug: 'frutas-verduras' },
  { id: '5', label: 'Panadería y repostería', slug: 'panaderia' },
  { id: '3', label: 'Bebidas', slug: 'bebidas' },
  { id: '6/52', label: 'Hogar > Aseo y limpieza', slug: 'aseo-hogar' },
  { id: '11', label: 'Mascotas', slug: 'mascotas' },
  { id: '10/77', label: 'Infantil > Alimentación', slug: 'bebes' },
]

export const d1Adapter = createVtexCatalogAdapter({
  storeSlug: 'd1',
  baseUrl: 'https://www.d1.com.co',
  parentPath: '',
  categories: D1_CATEGORIES,
  regions: ['NACIONAL'],
  nameField: 'productName',
})
