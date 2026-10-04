import { ZodError, z } from 'zod'

import { supabase } from '@/shared/lib/supabase'
import { isClientErrorCode } from '@/shared/utils/error-classification'

import {
  savedListSchema,
  savedListSummarySchema,
  type SavedList,
  type SavedListSummary,
  type SaveListItemPayload,
} from '../model/saved-list'
import { storeTotalSchema, type StoreTotal } from '../model/totals'

/**
 * Carries the Postgres/PostgREST code so the UI can say what happened in the
 * user's words (`saveListErrorMessage`), never the raw message.
 */
export class ListError extends Error {
  constructor(
    readonly operation: string,
    readonly code: string | undefined,
    override readonly cause: unknown,
  ) {
    super(`List operation failed: ${operation}`)
    this.name = 'ListError'
  }

  /** True when retrying cannot help: denied, gone, or an invalid response. */
  get isClientError(): boolean {
    return this.cause instanceof ZodError || isClientErrorCode(this.code)
  }
}

function fail(operation: string, error: { code?: string }): ListError {
  // PostgREST reports a request that never reached the server with an empty code.
  return new ListError(operation, error.code === '' ? 'network' : error.code, error)
}

/** Validates a response at the boundary; a mismatch is a typed ListError too. */
function parseResponse<T>(schema: z.ZodType<T>, input: unknown, operation: string): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new ListError(operation, undefined, result.error)
  return result.data
}

const listIdSchema = z.uuid()

export const listRepository = {
  /** "Mis listas", most recently touched first. Totals computed by the server. */
  async summaries(signal?: AbortSignal): Promise<SavedListSummary[]> {
    const base = supabase
      .from('list_summary')
      .select('id, name, updated_at, item_count, store_count, total_cop, total_at_add_cop')
      .order('updated_at', { ascending: false })
    const { data, error } = await (signal ? base.abortSignal(signal) : base)
    if (error) throw fail('lists.summaries', error)

    return parseResponse(
      savedListSummarySchema.array(),
      data.map((row) => ({
        id: row.id,
        name: row.name,
        updatedAt: row.updated_at,
        itemCount: row.item_count,
        storeCount: row.store_count,
        totalCop: row.total_cop,
        totalAtAddCop: row.total_at_add_cop,
      })),
      'lists.summaries',
    )
  },

  /**
   * One list with its products, in the order they were saved. The product
   * name comes along so a product that lost its price can still be shown.
   */
  async byId(id: string, signal?: AbortSignal): Promise<SavedList> {
    const base = supabase
      .from('shopping_list')
      .select(
        'id, name, list_item(store_product_id, quantity, price_cop_at_add, store_product(name))',
      )
      .eq('id', id)
      .order('position', { referencedTable: 'list_item' })
    const { data, error } = await (signal ? base.abortSignal(signal) : base).single()
    if (error) throw fail('lists.byId', error)

    return parseResponse(
      savedListSchema,
      {
        id: data.id,
        name: data.name,
        items: data.list_item.map((item) => ({
          productId: item.store_product_id,
          productName: item.store_product?.name,
          quantity: item.quantity,
          priceCopAtAdd: item.price_cop_at_add,
        })),
      },
      'lists.byId',
    )
  },

  /** Per-store breakdown of a saved list, from the list_totals view (rule 17). */
  async totals(listId: string, signal?: AbortSignal): Promise<StoreTotal[]> {
    const base = supabase
      .from('list_totals')
      .select('store_slug, store_name, item_count, subtotal_cop')
      .eq('list_id', listId)
      .order('subtotal_cop', { ascending: false })
    const { data, error } = await (signal ? base.abortSignal(signal) : base)
    if (error) throw fail('lists.totals', error)

    // View columns are all nullable in the generated types. A row with no
    // store cannot be attributed to one, so it is skipped rather than rejected.
    const rows = data.flatMap((row) =>
      row.store_slug === null || row.store_name === null
        ? []
        : [
            {
              storeSlug: row.store_slug,
              storeName: row.store_name,
              itemCount: row.item_count ?? 0,
              subtotalCop: row.subtotal_cop ?? 0,
            },
          ],
    )
    return parseResponse(storeTotalSchema.array(), rows, 'lists.totals')
  },

  /**
   * Creates the list, or — with `listId` — renames it and replaces its
   * products. One call, one transaction (save_list in Postgres). Returns the id.
   */
  async save(input: {
    listId: string | null
    name: string
    items: SaveListItemPayload[]
  }): Promise<string> {
    const { data, error } = await supabase.rpc('save_list', {
      p_name: input.name,
      p_items: input.items,
      ...(input.listId === null ? {} : { p_list_id: input.listId }),
    })
    if (error) throw fail('lists.save', error)
    return parseResponse(listIdSchema, data, 'lists.save')
  },

  /** Deleting cascades to items and reminder. RLS makes a foreign id a no-op. */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('shopping_list').delete().eq('id', id)
    if (error) throw fail('lists.remove', error)
  },
}
