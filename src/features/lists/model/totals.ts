import type { Product } from '@/features/catalog'

/**
 * Totals for the draft list.
 *
 * Rule 17 says totals are computed on the server. That rule is about SAVED
 * lists: a stored total goes stale the moment a price changes, and
 * `list_totals` in Postgres is the source of truth for them.
 *
 * The draft is different — it does not exist in the database yet. Its prices
 * come from the server (the catalogue query) and the arithmetic happens here
 * because there is nothing to ask. The moment a list is saved, the total comes
 * from `list_totals` and this stops being used for it.
 *
 * Pure module: no React, no network (rule 3).
 */

export type DraftItem = {
  product: Product
  quantity: number
}

export type StoreTotal = {
  storeSlug: string
  storeName: string
  itemCount: number
  subtotalCop: number
}

export function itemCountOf(items: DraftItem[]): number {
  return items.length
}

/** Integer COP throughout: the peso has no cents and floats lose money. */
export function subtotalOf(item: DraftItem): number {
  return item.product.priceCop * item.quantity
}

export function grandTotalOf(items: DraftItem[]): number {
  return items.reduce((sum, item) => sum + subtotalOf(item), 0)
}

/**
 * Per-store breakdown — the answer to "how much do I take to each shop".
 * Sorted by amount so the biggest spend leads, with the name breaking ties for
 * a stable order.
 */
export function totalsByStore(items: DraftItem[]): StoreTotal[] {
  const byStore = new Map<string, StoreTotal>()

  for (const item of items) {
    const { storeSlug, storeName } = item.product
    const current = byStore.get(storeSlug)

    if (current === undefined) {
      byStore.set(storeSlug, {
        storeSlug,
        storeName,
        itemCount: 1,
        subtotalCop: subtotalOf(item),
      })
      continue
    }

    current.itemCount += 1
    current.subtotalCop += subtotalOf(item)
  }

  return [...byStore.values()].sort(
    (a, b) => b.subtotalCop - a.subtotalCop || a.storeName.localeCompare(b.storeName),
  )
}
