/**
 * Public API of the lists feature.
 *
 * This feature depends on `catalog` — a list is made of products — and that is
 * the only direction the arrow points: catalog never imports lists
 * (01-overview.md, "¿Y si dos features necesitan lo mismo?").
 */
export { AddToListSheet } from './components/AddToListSheet'
export { useDraftListStore, selectItemCount, selectQuantityOf } from './store/draft-list-store'
export type { DraftItem } from './store/draft-list-store'
