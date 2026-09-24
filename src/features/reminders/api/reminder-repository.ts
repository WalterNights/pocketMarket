import { supabase } from '@/shared/lib/supabase'

import type { ReminderContext } from '../model/plan'
import { reminderSchema, type Reminder } from '../model/reminder'

/** Carries the Postgres/PostgREST code; the UI words it (03-patterns.md). */
export class ReminderError extends Error {
  constructor(
    readonly operation: string,
    override readonly cause: unknown,
  ) {
    super(`Fallo en ${operation}`)
    this.name = 'ReminderError'
  }
}

const COLUMNS = 'list_id, frequency, weekday, day_of_month, time_local, anchor_date, is_enabled'

type ReminderRow = {
  list_id: string
  frequency: string
  weekday: number | null
  day_of_month: number | null
  time_local: string
  anchor_date: string | null
  is_enabled: boolean
}

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

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

export const reminderRepository = {
  async forList(listId: string, signal?: AbortSignal): Promise<Reminder | null> {
    const base = supabase.from('list_reminder').select(COLUMNS).eq('list_id', listId)
    const { data, error } = await (signal ? base.abortSignal(signal) : base).maybeSingle()
    if (error) throw new ReminderError('reminders.forList', error)

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
    if (error) throw new ReminderError('reminders.contexts', error)
    if (reminders.length === 0) return []

    const { data: lists, error: listsError } = await supabase
      .from('list_summary')
      .select('id, name, item_count, total_cop')
      .in(
        'id',
        reminders.map((r) => r.list_id),
      )
    if (listsError) throw new ReminderError('reminders.contexts.lists', listsError)

    const byId = new Map(lists.map((list) => [list.id, list]))

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
    if (ownerId === null) throw new ReminderError('reminders.save', 'signed out')

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
    if (error) throw new ReminderError('reminders.save', error)
  },

  async remove(listId: string): Promise<void> {
    const { error } = await supabase.from('list_reminder').delete().eq('list_id', listId)
    if (error) throw new ReminderError('reminders.remove', error)
  },
}
