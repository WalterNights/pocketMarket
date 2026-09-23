import { create } from 'zustand'

import type { Product } from '@/features/catalog'

import type { DraftItem } from '../model/totals'

/**
 * The list being built right now, before it is saved.
 *
 * Deliberately NOT persisted yet: MMKV is not available in Expo Go, and
 * persisting to a second storage we would then migrate away from is churn. The
 * moment we move to a development build this gains `persist` with `version` +
 * `migrate`, per rules/state-and-data.md.
 *
 * Saving to Supabase needs an account (lists are private, RLS by owner), so
 * that arrives with auth. Until then the draft lives for the session.
 */
type DraftListState = {
  items: Record<string, DraftItem>
  addItem: (product: Product, quantity: number) => void
  removeItem: (productId: string) => void
  clear: () => void
}

export const useDraftListStore = create<DraftListState>()((set) => ({
  items: {},

  addItem: (product, quantity) =>
    set((state) => ({
      items: { ...state.items, [product.id]: { product, quantity } },
    })),

  removeItem: (productId) =>
    set((state) => {
      const { [productId]: _removed, ...rest } = state.items
      return { items: rest }
    }),

  clear: () => set({ items: {} }),
}))

/**
 * Selectors. Consuming the store without one re-renders the whole screen on
 * any change (03-patterns.md).
 */
export const selectItemCount = (state: DraftListState): number => Object.keys(state.items).length

export const selectQuantityOf =
  (productId: string) =>
  (state: DraftListState): number =>
    state.items[productId]?.quantity ?? 0
