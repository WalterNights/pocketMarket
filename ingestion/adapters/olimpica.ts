import { createVtexCatalogAdapter, type VtexCategory } from './vtex-catalog'

/**
 * Olímpica — VTEX (plan 0003). Researched 2026-10-04 against
 * /api/catalog_system/pub/category/tree/3.
 *
 * The aisles hang from the "Supermercado" root (900000000). Ids below are the
 * path under that root; a level-3 category needs its parent too
 * ('900150000/900150200'), because VTEX only matches a full category path.
 *
 * Despensa holds ~2.600 products, past the VTEX pagination ceiling (ING-005),
 * so it is walked subcategory by subcategory. Desayuno overlaps Despensa and
 * Lácteos almost entirely, but it is the only aisle carrying coffee and table
 * chocolate ("CAFE SELLO ROJO", "CHOCOLATE CORONA"), so it goes last: the
 * adapter yields each productId once and the FIRST aisle that lists it wins
 * (vtex-catalog.ts), so Desayuno only contributes what no real aisle has.
 *
 * Left out: Licores, Cigarrillos y Vaporizadores, Cuidado Personal y Belleza
 * (Éxito's set has no equivalent), and the cross-cutting showcases "Marcas
 * Propias", "Saludable", "Yia Life" and "Energizantes" (empty, or a copy of
 * products already in a real aisle). Outside "Supermercado": no groceries.
 *
 * Sales channels (`sc=`), checked 2026-10-04: only sc=1 is live — 2 to 4 answer
 * "sc is inactive", 5 answers an empty list, 6+ "sc not found". The default
 * response and sc=1 return the same price, so there is one national price.
 *
 * Olímpica's `nameComplete` glues the SKU's internal name onto the product
 * name, so the name comes from `productName`.
 */
export const OLIMPICA_CATEGORIES: readonly VtexCategory[] = [
  { id: '900020000/900020100', label: 'Despensa > Marcas Propias', slug: 'viveres' },
  { id: '900020000/900020200', label: 'Despensa > Huevos', slug: 'lacteos' },
  { id: '900020000/900020300', label: 'Despensa > Aceites', slug: 'viveres' },
  { id: '900020000/900020400', label: 'Despensa > Arroces Empacados Y Granel', slug: 'viveres' },
  { id: '900020000/900020500', label: 'Despensa > Bebidas Calientes', slug: 'viveres' },
  { id: '900020000/900020600', label: 'Despensa > Caldos Sopas Y Cremas', slug: 'viveres' },
  { id: '900020000/900020700', label: 'Despensa > Carnes Enlatadas', slug: 'viveres' },
  { id: '900020000/900020800', label: 'Despensa > Cereales', slug: 'viveres' },
  { id: '900020000/900020900', label: 'Despensa > Comidas Especiales', slug: 'viveres' },
  { id: '900020000/900021000', label: 'Despensa > Dulces Y Conservas', slug: 'viveres' },
  { id: '900020000/900021100', label: 'Despensa > Endulzantes', slug: 'viveres' },
  { id: '900020000/900021200', label: 'Despensa > Galletas', slug: 'viveres' },
  { id: '900020000/900021300', label: 'Despensa > Granos', slug: 'viveres' },
  { id: '900020000/900021400', label: 'Despensa > Harinas', slug: 'viveres' },
  {
    id: '900020000/900021500',
    label: 'Despensa > Leche En Polvo Y Crema De Leche',
    slug: 'viveres',
  },
  { id: '900020000/900021600', label: 'Despensa > Modificadores De Leche', slug: 'viveres' },
  { id: '900020000/900021700', label: 'Despensa > Pastas Alimenticias', slug: 'viveres' },
  { id: '900020000/900021800', label: 'Despensa > Repostería', slug: 'viveres' },
  {
    id: '900020000/900021900',
    label: 'Despensa > Salsas-Aderezos-Condimentos',
    slug: 'viveres',
  },
  { id: '900020000/900022000', label: 'Despensa > Vegetales Envasados', slug: 'viveres' },
  { id: '900030000', label: 'Huevos y Derivados Lácteos', slug: 'lacteos' },
  { id: '900070000', label: 'Refrigerados', slug: 'lacteos' },
  { id: '900060000', label: 'Pollo, Carne y Pescado', slug: 'carnes' },
  { id: '900050000', label: 'Frutas y verduras', slug: 'frutas-verduras' },
  { id: '900120000', label: 'Panadería', slug: 'panaderia' },
  { id: '900170000', label: 'Repostería', slug: 'panaderia' },
  { id: '900090000', label: 'Bebidas', slug: 'bebidas' },
  { id: '900140000', label: 'Congelados', slug: 'congelados' },
  { id: '900100000', label: 'Aseo del Hogar', slug: 'aseo-hogar' },
  { id: '900180000', label: 'Para tu Mascota', slug: 'mascotas' },
  { id: '900150000/900150200', label: 'Para tu Bebé > Alimentación Del Bebé', slug: 'bebes' },
  { id: '900130000', label: 'Pasabocas y Helados', slug: 'otros' },
  { id: '900160000', label: 'Cafetería Y Delicatessen', slug: 'otros' },
  { id: '900010000', label: 'Desayuno', slug: 'viveres' },
]

export const olimpicaAdapter = createVtexCatalogAdapter({
  storeSlug: 'olimpica',
  baseUrl: 'https://www.olimpica.com',
  parentPath: '/900000000',
  categories: OLIMPICA_CATEGORIES,
  regions: ['NACIONAL'],
  nameField: 'productName',
})
