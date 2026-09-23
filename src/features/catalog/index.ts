/**
 * Public API of the catalog feature. Everything else is private to it: this is
 * what lets the inside be refactored without breaking consumers, and makes any
 * widening of the surface visible in the diff (01-overview.md).
 */
export { CatalogScreen } from './components/CatalogScreen'
export { ProductIcon } from './components/ProductIcon'
export { StoreListScreen } from './components/StoreListScreen'
export { useProductSearch } from './hooks/useProductSearch'
export { useProduct } from './hooks/useProduct'
export { useStores } from './hooks/useStores'
export { routeParamsSchema, productIdParamSchema } from './model/route-params'
export { unitPriceOf, priceChangeOf } from './model/product'
export {
  presentationOf,
  formatQuantity,
  formatMeasure,
  totalContentOf,
  quantityStep,
  clampQuantity,
  MIN_QUANTITY,
  MAX_QUANTITY,
} from './model/presentation'
export { isBrowsable, freshnessLabel } from './model/store'
export type { Product, UnitPrice, PriceChange } from './model/product'
export type { Store } from './model/store'
export type { Presentation } from './model/presentation'
