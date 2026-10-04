import { z } from 'zod'

import { supabase } from '@/shared/lib/supabase'
import type { Tables } from '@/shared/types/database.types'

import type { ReminderContext } from '../model/plan'
import { reminderSchema, type Reminder } from '../model/reminder'

/**
 * `code` is the PostgREST/Postgres code, `'network'` when the request never
 * reached the server, or `'signed_out'` when there is no session to write as.
 * The UI words it (03-patterns.md); the message is for logs only.
 */
export class ReminderError extends Error {
  constructor(
    readonly operation: string,
    readonly code: string | undefined,
    override readonly cause?: unknown,
  ) {
    super(`${operation} failed${code === undefined ? '' : ` (${code})`}`)
    this.name = 'ReminderError'
  }
}

function fail(operation: string, error: { code?: string }): ReminderError {
  // PostgREST reports a request that never reached the server with an empty code.
  return new ReminderError(operation, error.code === '' ? 'network' : error.code, error)
}

const COLUMNS = 'list_id, frequency, weekday, day_of_month, time_local, anchor_date, is_enabled'

type ReminderRow = Pick<
  Tables<'list_reminder'>,
  'list_id' | 'frequency' | 'weekday' | 'day_of_month' | 'time_local' | 'anchor_date' | 'is_enabled'
>

function toReminder(row: ReminderRow): Reminder {
  return reminderSchema.parse({
    listId: row.list_id,
    frequency: row.frequency,
    weekday: row.weekday,
    dayOfMonth: row.day_of_month,
    timeLocal: row.time_local,
    anchorDate: row.anchor_date,
    isEnabled: row.is_enabled,
  })
}

/**
 * What a notification says about its list. Every column of a view is nullable
 * to PostgREST; a missing name means the list is archived or gone.
 */
const listSummarySchema = z.object({
  id: z.uuid(),
  name: z.string().nullable(),
  item_count: z.number().int().nonnegative().nullable(),
  total_cop: z.number().int().nonnegative().nullable(),
})

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export const reminderRepository = {
  async forList(listId: string, signal?: AbortSignal): Promise<Reminder | null> {
    const base = supabase.from('list_reminder').select(COLUMNS).eq('list_id', listId)
    const { data, error } = await (signal ? base.abortSignal(signal) : base).maybeSingle()
    if (error) throw fail('reminders.forList', error)

    return data === null ? null : toReminder(data)
  },

  /**
   * Every enabled reminder with what its notification says: list name, item
   * count and today's total. Signed out, there is nothing to remind — and the
   * reconciler then cancels whatever was left on the phone.
   */
  async contexts(): Promise<ReminderContext[]> {
    if ((await currentUserId()) === null) return []

    const { data: reminders, error } = await supabase
      .from('list_reminder')
      .select(COLUMNS)
      .eq('is_enabled', true)
    if (error) throw fail('reminders.contexts', error)
    if (reminders.length === 0) return []

    const { data: lists, error: listsError } = await supabase
      .from('list_summary')
      .select('id, name, item_count, total_cop')
      .in(
        'id',
        reminders.map((r) => r.list_id),
      )
    if (listsError) throw fail('reminders.contexts.lists', listsError)

    const byId = new Map(
      z
        .array(listSummarySchema)
        .parse(lists)
        .map((list) => [list.id, list]),
    )

    return reminders.flatMap((row) => {
      const list = byId.get(row.list_id)
      // A reminder whose list is archived or gone has nothing to announce.
      if (list === undefined || list.name === null) return []
      return [
        {
          reminder: toReminder(row),
          listName: list.name,
          itemCount: list.item_count ?? 0,
          totalCop: list.total_cop ?? 0,
        },
      ]
    })
  },

  /** One reminder per list (list_reminder_one_per_list): upsert on list_id. */
  async save(reminder: Reminder): Promise<void> {
    const ownerId = await currentUserId()
    if (ownerId === null) throw new ReminderError('reminders.save', 'signed_out')

    const { error } = await supabase.from('list_reminder').upsert(
      {
        list_id: reminder.listId,
        // RLS checks this against auth.uid(); it cannot be spoofed, only sent.
        owner_id: ownerId,
        frequency: reminder.frequency,
        weekday: reminder.weekday,
        day_of_month: reminder.dayOfMonth,
        time_local: reminder.timeLocal,
        anchor_date: reminder.anchorDate,
        is_enabled: reminder.isEnabled,
      },
      { onConflict: 'list_id' },
    )
    if (error) throw fail('reminders.save', error)
  },

  async remove(listId: string): Promise<void> {
    const { error } = await supabase.from('list_reminder').delete().eq('list_id', listId)
    if (error) throw fail('reminders.remove', error)
  },
}
