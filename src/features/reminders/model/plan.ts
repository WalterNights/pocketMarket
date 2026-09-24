import { formatCop } from '@/shared/utils/format-money'

import { nextOccurrences, type Reminder } from './reminder'

/**
 * Which notifications the phone should have scheduled right now. Pure: the
 * reconciler compares this against what is actually scheduled and fixes the
 * difference (docs/domain/03-reminders.md, "Reconciliación").
 *
 * Every frequency is scheduled as concrete dates, never as a repeating native
 * trigger:
 * - biweekly has no native trigger at all;
 * - the native monthly trigger on day 31 skips 30-day months, which is the
 *   exact bug the domain doc forbids;
 * - one mechanism means one budget to reason about.
 */

/** iOS drops anything past 64 pending notifications, silently. */
export const IOS_PENDING_LIMIT = 64
/** Kept free for one-off notifications the app may add later. */
export const RESERVED_SLOTS = 8
export const NOTIFICATION_BUDGET = IOS_PENDING_LIMIT - RESERVED_SLOTS

/** Upcoming dates considered per reminder before the global cut. */
export const OCCURRENCES_PER_REMINDER = 8

export const IDENTIFIER_PREFIX = 'reminder:'

export type ReminderContext = {
  reminder: Reminder
  listName: string
  itemCount: number
  totalCop: number
}

export type PlannedNotification = {
  /**
   * Deterministic: the same reminder and date always give the same id, so
   * scheduling it again replaces instead of duplicating. That is what makes
   * reconciliation idempotent without storing any ids on the device.
   */
  identifier: string
  date: Date
  title: string
  body: string
  listId: string
}

function stamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(
    date.getHours(),
  )}${pad(date.getMinutes())}`
}

/**
 * The total is written when the notification is scheduled — a local
 * notification cannot reach the network when it fires — hence the "~".
 */
export function notificationBody(context: Omit<ReminderContext, 'reminder'>): string {
  const products = context.itemCount === 1 ? '1 producto' : `${context.itemCount} productos`
  return `"${context.listName}" · ${products} · ~${formatCop(context.totalCop)}`
}

/**
 * Nearest dates first across ALL reminders, cut at the budget. With many
 * reminders each one keeps its next few dates instead of the first reminders
 * eating the whole budget; opening the app refills the rest.
 */
export function planNotifications(
  contexts: readonly ReminderContext[],
  now: Date,
  budget: number = NOTIFICATION_BUDGET,
): PlannedNotification[] {
  const all = contexts.flatMap((context) =>
    nextOccurrences(context.reminder, now, OCCURRENCES_PER_REMINDER).map((date) => ({
      identifier: `${IDENTIFIER_PREFIX}${context.reminder.listId}:${stamp(date)}`,
      date,
      title: 'Hora del mercado',
      body: notificationBody(context),
      listId: context.reminder.listId,
    })),
  )

  return all
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.identifier.localeCompare(b.identifier))
    .slice(0, budget)
}

export type ReconcileActions = {
  cancel: string[]
  schedule: PlannedNotification[]
}

/**
 * Cancels what should no longer be there and (re)schedules everything planned.
 * Re-scheduling an identifier that already exists replaces it, which also
 * refreshes the total in its text. Only ids with our prefix are touched.
 */
export function reconcile(
  planned: readonly PlannedNotification[],
  scheduledIds: readonly string[],
): ReconcileActions {
  const wanted = new Set(planned.map((p) => p.identifier))

  return {
    cancel: scheduledIds.filter((id) => id.startsWith(IDENTIFIER_PREFIX) && !wanted.has(id)),
    schedule: [...planned],
  }
}
