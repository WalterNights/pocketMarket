import { create } from 'zustand'

import { useSessionStore } from '@/features/auth'
import type { Product } from '@/features/catalog'

import type { KeptItem } from '../model/saved-list'
import type { DraftItem } from '../model/totals'

/**
 * The list being built right now — a new one, or a saved one being edited.
 *
 * Deliberately NOT persisted yet: MMKV is not available in Expo Go, and
 * persisting to a second storage we would then migrate away from is churn. The
 * moment we move to a development build this gains `persist` with `version` +
 * `migrate`, per rules/state-and-data.md.
 *
 * Editing reuses the draft on purpose: the same screens add and remove
 * products, and "Guardar cambios" sends the result to save_list, which works
 * out on the server what was added, removed or changed.
 */
export type EditingList = {
  listId: string
  name: string
  /** Products without a price today: not in the draft, sent back untouched. */
  kept: KeptItem[]
}

type DraftListState = {
  items: Record<string, DraftItem>
  editing: EditingList | null
  addItem: (product: Product, quantity: number) => void
  removeItem: (productId: string) => void
  clear: () => void
  /** Replaces the draft with a saved list's products. */
  loadForEdit: (editing: EditingList, items: DraftItem[]) => void
}

export const useDraftListStore = create<DraftListState>()((set) => ({
  items: {},
  editing: null,

  addItem: (product, quantity) =>
    set((state) => ({
      items: { ...state.items, [product.id]: { product, quantity } },
    })),

  removeItem: (productId) =>
    set((state) => {
      const { [productId]: _removed, ...rest } = state.items
      return { items: rest }
    }),

  // Clearing also leaves edit mode: an empty draft that still points at a saved
  // list would save that list empty.
  clear: () => set({ items: {}, editing: null }),

  loadForEdit: (editing, items) =>
    set({
      editing,
      items: Object.fromEntries(items.map((item) => [item.product.id, item])),
    }),
}))

// Signing out forgets the draft: on a shared phone the next person must not
// find the previous one's list half-built (08-security.md, "Logout borra todo").
useSessionStore.subscribe((state, previous) => {
  if (previous.status === 'signed-in' && state.status === 'signed-out') {
    useDraftListStore.getState().clear()
  }
})

/**
 * Selectors. Consuming the store without one re-renders the whole screen on
 * any change (03-patterns.md).
 */
export const selectItemCount = (state: DraftListState): number => Object.keys(state.items).length

export const selectQuantityOf =
  (productId: string) =>
  (state: DraftListState): number =>
    state.items[productId]?.quantity ?? 0

export const selectEditing = (state: DraftListState): EditingList | null => state.editing
