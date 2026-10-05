import { createVtexCatalogAdapter, type VtexCategory } from './vtex-catalog'

/**
 * Éxito — VTEX. Research and endpoint details in docs/domain/02-ingestion.md.
 * The aisles hang from the "Mercado" root (34185082). Ids below are the path
 * under that root; a deeper category needs its parents too
 * ('34185101/34185256'), because VTEX only matches a full category path.
 *
 * VTEX cannot paginate past 2.500 results per query (ING-005), and a category
 * that reaches the ceiling marks the whole run as incomplete. Nine of the
 * fourteen aisles are at or past it, so they are walked subcategory by
 * subcategory; the rest stay as single entries.
 *
 * Totals measured 2026-10-05 (`_from=0&_to=0`, header `resources: 0-0/TOTAL`).
 * They count every listed product, out of stock included. "Suma" is the sum of
 * the children; the difference is products filed at the aisle itself.
 *
 * | Aisle                          |  Total |   Suma | Largest child                     |
 * |--------------------------------|-------:|-------:|-----------------------------------|
 * | Despensa                       | 12.261 | 12.259 | Salsas, especias y cond. (2.367)  |
 * | Lácteos, huevos y refrigerados |  4.621 |  4.621 | Yogurt y bebidas lácteas (1.344)  |
 * | Pollo, carne y pescado         |  2.415 |  2.414 | Carne de res (722)                |
 * | Charcutería y delicatessen     |  1.629 |      — | single entry                      |
 * | Frutas y verduras              |  1.730 |      — | single entry                      |
 * | Panadería y repostería         |  2.563 |  2.562 | Empacada (1.057)                  |
 * | Bebidas                        |  2.227 |  2.227 | Gaseosas / Jugos (596 each)       |
 * | Congelados                     |  1.449 |      — | single entry                      |
 * | Aseo del hogar                 |  7.968 |  7.962 | Jabones, detergentes... (1.982)   |
 * | Mascotas                       | 23.356 |  6.913 | only the grocery part, see below  |
 * | Alimentación para bebés        |    188 |      — | single entry                      |
 * | Pasabocas y snacks             |  2.251 |  2.249 | Papas fritas y paquetes (1.124)   |
 * | Dulces y chocolatería          |  3.284 |  3.284 | Chocolatería (1.418)              |
 * | Comidas preparadas             |    372 |      — | single entry                      |
 *
 * The aisle itself is NOT kept after its children. Outside Mascotas the
 * leftovers are 0 to 6 products per aisle, and collecting them would mean
 * walking 2.500 offsets of repeats only to hit the ceiling again — the run
 * would be reported as incomplete forever, which is what the split is for.
 *
 * Mascotas is mostly a marketplace dump, and only its grocery part is walked:
 *   - Gatos (1.682) as one entry: its three children add up to 1.483, so the
 *     single entry also catches the 199 products filed at "Gatos" itself.
 *   - Perros (9.984): only "Comida y snack" (2.195) and "Productos de aseo"
 *     (1.992). The other 5.797 sit at "Perros" with no subcategory and cannot
 *     be reached by category; a sampled page (offset 2.400) was all listings
 *     with price 0 — leashes, horse halters, LED fairy lights.
 *   - Comida peces, aves y otras mascotas (1.044).
 *   - Left out: "Juguetes y accesorios mascotas" (10.608 — beds, leashes,
 *     toys, bowls). Not groceries, and two of its children are past the
 *     ceiling with no deeper level to split by (Correas 3.502, Juguetes 3.406).
 *
 * Watch list — close to the ceiling with no deeper level in the tree:
 * Despensa > Salsas, especias y condimentos (2.367) and Perros > Comida y
 * snack (2.195). If one reaches 2.500 the adapter warns with its label
 * (vtex-catalog.ts) and it has to be split by something other than category.
 *
 * A child keeps its aisle's slug unless it plainly belongs elsewhere: cold
 * cuts go with Charcutería (carnes), infant formula with bebes. The slug is
 * only the fallback bucket; the aisle shown in the app is deduced from the
 * name (core/classify.ts).
 */

/** Éxito's grocery categories mapped onto OUR taxonomy. */
export const EXITO_CATEGORIES: readonly VtexCategory[] = [
  // Despensa (34185101)
  { id: '34185101/34185251', label: 'Despensa > Cereales y granolas', slug: 'viveres' },
  { id: '34185101/34185252', label: 'Despensa > Granos y arroz', slug: 'viveres' },
  { id: '34185101/34185253', label: 'Despensa > Aceites y vinagres', slug: 'viveres' },
  { id: '34185101/34185254', label: 'Despensa > Azúcar, panela y endulzante', slug: 'viveres' },
  { id: '34185101/34185255', label: 'Despensa > Harinas y mezclas para preparar', slug: 'viveres' },
  { id: '34185101/34185256', label: 'Despensa > Pastas', slug: 'viveres' },
  { id: '34185101/34185257', label: 'Despensa > Salsas, especias y condimentos', slug: 'viveres' },
  { id: '34185101/34185258', label: 'Despensa > Enlatados y conservas', slug: 'viveres' },
  { id: '34185101/34185259', label: 'Despensa > Tortillas y tacos', slug: 'viveres' },
  { id: '34185101/34185260', label: 'Despensa > Sopas y cremas', slug: 'viveres' },
  { id: '34185101/34185261', label: 'Despensa > Avena en hojuelas y en polvo', slug: 'viveres' },
  { id: '34185101/34185263', label: 'Despensa > Quinua, chía y otras semillas', slug: 'viveres' },
  { id: '34185101/34185264', label: 'Despensa > Aromáticas y té', slug: 'viveres' },
  { id: '34185101/34185266', label: 'Despensa > Anchetas y mercados básicos', slug: 'viveres' },
  {
    id: '34185101/34185268',
    label: 'Despensa > Café, chocolate y cremas no lácteas',
    slug: 'viveres',
  },
  { id: '34185101/34185270', label: 'Despensa > Sal', slug: 'viveres' },
  { id: '34185101/34185276', label: 'Despensa > Mermeladas, dips y untables', slug: 'viveres' },
  { id: '34185101/34185277', label: 'Despensa > Gelatinas en polvo', slug: 'viveres' },
  { id: '34185101/34185278', label: 'Despensa > Galletas', slug: 'viveres' },
  { id: '34185101/346085358', label: 'Despensa > Bebidas en polvo', slug: 'viveres' },

  // Lácteos, huevos y refrigerados (34185103)
  { id: '34185103/34185228', label: 'Lácteos > Mantequilla y margarina', slug: 'lacteos' },
  { id: '34185103/34185229', label: 'Lácteos > Carnes frías y embutidos', slug: 'carnes' },
  { id: '34185103/34185291', label: 'Lácteos > Leche', slug: 'lacteos' },
  { id: '34185103/34185292', label: 'Lácteos > Leches saborizadas', slug: 'lacteos' },
  { id: '34185103/34185293', label: 'Lácteos > Leches en polvo', slug: 'lacteos' },
  { id: '34185103/34185294', label: 'Lácteos > Huevos', slug: 'lacteos' },
  { id: '34185103/34185295', label: 'Lácteos > Fórmulas materno infantil', slug: 'bebes' },
  { id: '34185103/34185296', label: 'Lácteos > Yogurt y bebidas lácteas', slug: 'lacteos' },
  { id: '34185103/34185297', label: 'Lácteos > Quesos, quesitos y cuajadas', slug: 'lacteos' },
  { id: '34185103/34185298', label: 'Lácteos > Postres refrigerados', slug: 'lacteos' },
  {
    id: '34185103/34185300',
    label: 'Lácteos > Cremas de leche, queso cremas y sueros',
    slug: 'lacteos',
  },
  { id: '34185103/34185301', label: 'Lácteos > Arepas', slug: 'lacteos' },

  // Pollo, carne y pescado (34185097)
  { id: '34185097/34185216', label: 'Pollo, carne y pescado > Pollo', slug: 'carnes' },
  { id: '34185097/34185217', label: 'Pollo, carne y pescado > Carne de res', slug: 'carnes' },
  { id: '34185097/34185218', label: 'Pollo, carne y pescado > Carne de cerdo', slug: 'carnes' },
  {
    id: '34185097/34185219',
    label: 'Pollo, carne y pescado > Pescados y mariscos',
    slug: 'carnes',
  },
  { id: '34185097/34185220', label: 'Pollo, carne y pescado > Otras especies', slug: 'carnes' },

  { id: '34185098', label: 'Charcutería y delicatessen', slug: 'carnes' },
  { id: '34185099', label: 'Frutas y verduras', slug: 'frutas-verduras' },

  // Panadería y repostería (34185100)
  {
    id: '34185100/34185240',
    label: 'Panadería > Panadería y pastelería empacada',
    slug: 'panaderia',
  },
  { id: '34185100/34185245', label: 'Panadería > Ingredientes para repostería', slug: 'panaderia' },
  { id: '34185100/34185247', label: 'Panadería > Postres y tortas frescas', slug: 'panaderia' },
  { id: '34185100/34185250', label: 'Panadería > Panadería fresca y artesanal', slug: 'panaderia' },

  // Bebidas (346084837)
  { id: '346084837/346084842', label: 'Bebidas > Agua y té', slug: 'bebidas' },
  { id: '346084837/346084843', label: 'Bebidas > Bebidas de cereal', slug: 'bebidas' },
  { id: '346084837/346084844', label: 'Bebidas > Gaseosas y sodas', slug: 'bebidas' },
  { id: '346084837/346084845', label: 'Bebidas > Hidratantes y energizantes', slug: 'bebidas' },
  { id: '346084837/346084846', label: 'Bebidas > Jugos', slug: 'bebidas' },
  { id: '346084837/346098538', label: 'Bebidas > Otras bebidas', slug: 'bebidas' },

  { id: '34185104', label: 'Congelados', slug: 'congelados' },

  // Aseo del hogar (34185106)
  { id: '34185106/34185325', label: 'Aseo > Ambientadores e insecticidas', slug: 'aseo-hogar' },
  { id: '34185106/34185326', label: 'Aseo > Lavalozas y desengrasante', slug: 'aseo-hogar' },
  {
    id: '34185106/34185327',
    label: 'Aseo > Jabones, detergentes y limpiadores',
    slug: 'aseo-hogar',
  },
  { id: '34185106/34185328', label: 'Aseo > Papel higiénico', slug: 'aseo-hogar' },
  { id: '34185106/34185329', label: 'Aseo > Suavizantes', slug: 'aseo-hogar' },
  { id: '34185106/34185330', label: 'Aseo > Implementos para la limpieza', slug: 'aseo-hogar' },
  { id: '34185106/34185331', label: 'Aseo > Desechables, velas y carbón', slug: 'aseo-hogar' },
  { id: '34185106/346098432', label: 'Aseo > Servilletas y toallas de cocina', slug: 'aseo-hogar' },
  { id: '34185106/346098433', label: 'Aseo > Betunes para zapatos', slug: 'aseo-hogar' },

  // Mascotas (34185107) — the grocery part only, see the note above.
  { id: '34185107/34185332', label: 'Mascotas > Gatos', slug: 'mascotas' },
  {
    id: '34185107/34185333/347733878',
    label: 'Mascotas > Perros > Comida y snack',
    slug: 'mascotas',
  },
  {
    id: '34185107/34185333/347733879',
    label: 'Mascotas > Perros > Productos de aseo',
    slug: 'mascotas',
  },
  {
    id: '34185107/34185334',
    label: 'Mascotas > Comida peces, aves y otras mascotas',
    slug: 'mascotas',
  },

  { id: '347733901', label: 'Alimentación para bebés', slug: 'bebes' },

  // Pasabocas y snacks (34185105)
  { id: '34185105/34185311', label: 'Pasabocas > Pasabocas para preparar', slug: 'otros' },
  { id: '34185105/34185312', label: 'Pasabocas > Nueces, pistachos y frutos secos', slug: 'otros' },
  { id: '34185105/34185313', label: 'Pasabocas > Papas fritas y paquetes', slug: 'otros' },

  // Dulces y chocolatería (346098434)
  { id: '346098434/347532250', label: 'Dulces > Arequipe y leche condensada', slug: 'otros' },
  { id: '346098434/347532251', label: 'Dulces > Chocolatería', slug: 'otros' },
  { id: '346098434/347532252', label: 'Dulces > Confitería', slug: 'otros' },
  { id: '346098434/347532253', label: 'Dulces > Dulces típicos', slug: 'otros' },
  { id: '346098434/347532254', label: 'Dulces > Chicles', slug: 'otros' },
  { id: '346098434/347532255', label: 'Dulces > Masmelos y gomitas', slug: 'otros' },

  { id: '348959797', label: 'Comidas preparadas', slug: 'otros' },
]

export const exitoAdapter = createVtexCatalogAdapter({
  storeSlug: 'exito',
  baseUrl: 'https://www.exito.com',
  parentPath: '/34185082',
  categories: EXITO_CATEGORIES,
  // Éxito varies prices by city, but the public catalogue endpoint returns a
  // single set. Treated as national until a per-region source is found.
  regions: ['NACIONAL'],
})
