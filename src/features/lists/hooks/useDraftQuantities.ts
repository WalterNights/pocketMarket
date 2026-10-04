import { useShallow } from 'zustand/react/shallow'

import { useDraftListStore } from '../store/draft-list-store'

/**
 * Units already in the draft, keyed by product id — what the catalogue rows
 * show as "2 en la lista".
 *
 * `useShallow` keeps the same object while no quantity changes, so the
 * catalogue's memoised rows do not all re-render on unrelated store updates.
 */
export function useDraftQuantities(): Record<string, number> {
  return useDraftListStore(
    useShallow((state) => {
      const quantities: Record<string, number> = {}
      for (const [productId, item] of Object.entries(state.items)) {
        quantities[productId] = item.quantity
      }
      return quantities
    }),
  )
}
