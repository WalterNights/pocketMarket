import { z } from 'zod'

import type { DraftItem } from './totals'

/**
 * Saved lists, as the server returns them. Pure: no React, no network.
 */

export const LIST_NAME_MAX = 60

export const listNameSchema = z
  .string()
  .trim()
  .min(1, 'Ponle un nombre a la lista')
  .max(LIST_NAME_MAX, `Máximo ${LIST_NAME_MAX} caracteres`)

/** One row of "Mis listas". Totals are computed by the server (rule 17). */
export const savedListSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  updatedAt: z.string(),
  itemCount: z.number().int().nonnegative(),
  storeCount: z.number().int().nonnegative(),
  totalCop: z.number().int().nonnegative(),
  totalAtAddCop: z.number().int().nonnegative(),
})

export type SavedListSummary = z.infer<typeof savedListSummarySchema>

export const savedListItemSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().min(1),
  // numeric(10,3) arrives as a number or a string depending on the driver.
  quantity: z.coerce.number().positive(),
  priceCopAtAdd: z.number().int().nonnegative(),
})

export type SavedListItem = z.infer<typeof savedListItemSchema>

export const savedListSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  items: z.array(savedListItemSchema),
})

export type SavedList = z.infer<typeof savedListSchema>

/**
 * A saved list's product that cannot go into the draft because it no longer
 * has a price today. Carried through an edit untouched, so saving does not
 * silently delete it.
 */
export type KeptItem = {
  productId: string
  quantity: number
}

export type SaveListItemPayload = {
  store_product_id: string
  quantity: number
}

/**
 * What `save_list` receives. Draft items first, in the order the user sees
 * them, then the kept ones. A kept product that is also in the draft is sent
 * once, with the draft's quantity: the draft is what the user just edited.
 */
export function toSavePayload(
  draft: readonly DraftItem[],
  kept: readonly KeptItem[] = [],
): SaveListItemPayload[] {
  const inDraft = new Set(draft.map((item) => item.product.id))

  return [
    ...draft.map((item) => ({ store_product_id: item.product.id, quantity: item.quantity })),
    ...kept
      .filter((item) => !inDraft.has(item.productId))
      .map((item) => ({ store_product_id: item.productId, quantity: item.quantity })),
  ]
}

/**
 * Splits a saved list for editing: products with a price today go into the
 * draft; the rest are kept aside and sent back unchanged.
 */
export function splitForEdit<P extends { id: string }>(
  list: SavedList,
  productsWithPrice: readonly P[],
): { draft: { product: P; quantity: number }[]; kept: KeptItem[] } {
  const byId = new Map(productsWithPrice.map((product) => [product.id, product]))
  const draft: { product: P; quantity: number }[] = []
  const kept: KeptItem[] = []

  for (const item of list.items) {
    const product = byId.get(item.productId)
    if (product === undefined) kept.push({ productId: item.productId, quantity: item.quantity })
    else draft.push({ product, quantity: item.quantity })
  }

  return { draft, kept }
}

/**
 * Postgres / PostgREST codes from save_list, in the user's words.
 * P0002 is also what someone else's list looks like: RLS hides it, so "gone"
 * is the honest and the safe answer at once.
 */
const SAVE_MESSAGES: Record<string, string> = {
  P0002: 'Esta lista ya no existe. Guárdala como una lista nueva.',
  P0001: 'Uno de los productos ya no tiene precio en la tienda. Quítalo y vuelve a guardar.',
  '42501': 'Inicia sesión para guardar tus listas.',
  '22023': 'Añade al menos un producto antes de guardar.',
  network: 'Sin conexión. Tu lista sigue aquí; vuelve a intentarlo cuando tengas internet.',
}

export function saveListErrorMessage(code: string | undefined): string {
  return (code !== undefined && SAVE_MESSAGES[code]) || 'No se pudo guardar. Vuelve a intentarlo.'
}

/**
 * Route params are untrusted input — a notification or deep link can put
 * anything there (05-navigation.md). `string | string[]` in, one uuid out.
 */
const firstOf = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value[0] : value))

export const listIdParamSchema = z.object({ id: firstOf.pipe(z.string().uuid()) })
export const reminderListParamSchema = z.object({ listId: firstOf.pipe(z.string().uuid()) })
