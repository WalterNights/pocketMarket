/**
 * Public API of the lists feature.
 *
 * This feature depends on `catalog` — a list is made of products — and that is
 * the only direction the arrow points: catalog never imports lists
 * (01-overview.md, "¿Y si dos features necesitan lo mismo?").
 */
export { AddToListSheet } from './components/AddToListSheet'
export { DraftListBar } from './components/DraftListBar'
export { DraftListScreen } from './components/DraftListScreen'
export { useDraftListStore, selectItemCount, selectQuantityOf } from './store/draft-list-store'
export { grandTotalOf, totalsByStore, subtotalOf, itemCountOf } from './model/totals'
export type { DraftItem, StoreTotal } from './model/totals'
