/**
 * Public API of the catalog feature. Everything else is private to it: this is
 * what lets the inside be refactored without breaking consumers, and makes any
 * widening of the surface visible in the diff (01-overview.md).
 */
export { CatalogScreen } from './components/CatalogScreen'
export { useProductSearch } from './hooks/useProductSearch'
export { unitPriceOf, priceChangeOf } from './model/product'
export type { Product, UnitPrice, PriceChange } from './model/product'
