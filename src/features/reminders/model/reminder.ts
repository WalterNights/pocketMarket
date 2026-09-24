import { z } from 'zod'

/**
 * A "time to shop" reminder attached to a saved list. Pure: no React, no
 * network, no notifications API — the calendar arithmetic lives here so every
 * edge case in docs/domain/03-reminders.md is a unit test.
 *
 * Weekdays are ISO: 1 = lunes … 7 = domingo. JavaScript's getDay() counts from
 * Sunday = 0; `isoWeekday` is the only place that converts.
 */

export const FREQUENCIES = ['weekly', 'biweekly', 'monthly'] as const
export type Frequency = (typeof FREQUENCIES)[number]

/**
 * Fixed choices instead of a free time picker: it avoids a native dependency,
 * and "remind me to shop" needs a moment of the day, not a minute.
 */
export const REMINDER_TIMES = ['08:00', '12:00', '18:00', '20:00'] as const
export type ReminderTime = (typeof REMINDER_TIMES)[number]

const time = z
  .string()
  // Postgres `time` arrives as HH:MM:SS; the app only deals in HH:MM.
  .transform((value) => value.slice(0, 5))
  .pipe(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))

export const reminderSchema = z
  .object({
    listId: z.string().uuid(),
    frequency: z.enum(FREQUENCIES),
    weekday: z.number().int().min(1).max(7).nullable(),
    dayOfMonth: z.number().int().min(1).max(31).nullable(),
    timeLocal: time,
    anchorDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    isEnabled: z.boolean(),
  })
  // Same shape rules as the list_reminder CHECK constraints: each frequency
  // carries its own field and not the others'.
  .refine(
    (r) =>
      r.frequency === 'monthly'
        ? r.dayOfMonth !== null && r.weekday === null
        : r.weekday !== null && r.dayOfMonth === null,
    'Forma de recordatorio inválida',
  )
  .refine((r) => r.frequency !== 'biweekly' || r.anchorDate !== null, 'Quincenal sin ancla')

export type Reminder = z.infer<typeof reminderSchema>

/**
 * Days offered for a monthly reminder: the usual paydays. 31 reads as "fin de
 * mes" and lands on the last day of shorter months.
 */
export const MONTH_DAYS = [1, 5, 10, 15, 20, 25, 31] as const
export const END_OF_MONTH = 31

/** What the picker edits. Every field has a value so switching frequency keeps choices. */
export type ReminderDraft = {
  frequency: Frequency
  weekday: number
  dayOfMonth: number
  timeLocal: string
}

export const DEFAULT_DRAFT: ReminderDraft = {
  frequency: 'weekly',
  weekday: 6,
  dayOfMonth: 15,
  timeLocal: '08:00',
}

export function draftOf(reminder: Reminder): ReminderDraft {
  return {
    frequency: reminder.frequency,
    weekday: reminder.weekday ?? DEFAULT_DRAFT.weekday,
    dayOfMonth: reminder.dayOfMonth ?? DEFAULT_DRAFT.dayOfMonth,
    timeLocal: reminder.timeLocal,
  }
}

/**
 * Picker choice → the row to save. A biweekly reminder keeps its anchor when
 * the weekday did not change: recomputing it would silently shift the
 * fortnight by a week every time the user touched the time.
 */
export function toReminder(
  draft: ReminderDraft,
  listId: string,
  now: Date,
  previous: Reminder | null = null,
): Reminder {
  if (draft.frequency === 'monthly') {
    return {
      listId,
      frequency: 'monthly',
      weekday: null,
      dayOfMonth: draft.dayOfMonth,
      timeLocal: draft.timeLocal,
      anchorDate: null,
      isEnabled: true,
    }
  }

  const keepAnchor =
    draft.frequency === 'biweekly' &&
    previous?.frequency === 'biweekly' &&
    previous.weekday === draft.weekday &&
    previous.anchorDate !== null

  return {
    listId,
    frequency: draft.frequency,
    weekday: draft.weekday,
    dayOfMonth: null,
    timeLocal: draft.timeLocal,
    anchorDate:
      draft.frequency === 'biweekly'
        ? keepAnchor
          ? previous.anchorDate
          : anchorFor(draft.weekday, now)
        : null,
    isEnabled: true,
  }
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function atTime(year: number, month: number, day: number, hhmm: string): Date {
  const [hours = 0, minutes = 0] = hhmm.split(':').map(Number)
  return new Date(year, month, day, hours, minutes, 0, 0)
}

function parseLocalDate(isoDate: string): Date {
  const [year = 1970, month = 1, day = 1] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function toLocalIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/**
 * First date on or after `from` that falls on `weekday`. The anchor of a new
 * biweekly reminder: the fortnight is counted from the first one.
 */
export function anchorFor(weekday: number, from: Date): string {
  const offset = (weekday - isoWeekday(from) + 7) % 7
  return toLocalIsoDate(new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset))
}

/**
 * The next `count` moments the reminder fires, strictly after `from`. A
 * reminder created at 9:00 for "today at 8:00" fires next time, never at once.
 */
export function nextOccurrences(reminder: Reminder, from: Date, count: number): Date[] {
  if (!reminder.isEnabled || count <= 0) return []

  const out: Date[] = []
  const push = (candidate: Date) => {
    if (candidate.getTime() > from.getTime()) out.push(candidate)
  }

  if (reminder.frequency === 'monthly') {
    const wanted = reminder.dayOfMonth ?? 1
    for (let i = 0; out.length < count && i < count + 2; i += 1) {
      const year = from.getFullYear()
      const month = from.getMonth() + i
      // Day 31 in a 30-day month fires on the 30th: a reminder that skips
      // months is worse than one a day early (03-reminders.md).
      const day = Math.min(wanted, lastDayOfMonth(year, month))
      push(atTime(year, month, day, reminder.timeLocal))
    }
    return out
  }

  const step = reminder.frequency === 'weekly' ? 7 : 14
  const start =
    reminder.frequency === 'biweekly' && reminder.anchorDate !== null
      ? parseLocalDate(reminder.anchorDate)
      : parseLocalDate(anchorFor(reminder.weekday ?? 1, from))

  // Jump close to `from` instead of walking from an anchor months in the past.
  const daysSince = Math.floor((from.getTime() - start.getTime()) / 86_400_000)
  let k = Math.max(0, Math.floor(daysSince / step) - 1)

  while (out.length < count) {
    push(
      atTime(start.getFullYear(), start.getMonth(), start.getDate() + k * step, reminder.timeLocal),
    )
    k += 1
  }
  return out
}

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const WEEKDAY_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
const MONTH_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

export function weekdayName(weekday: number): string {
  return WEEKDAY_NAMES[weekday - 1] ?? ''
}

/** "07:00" → "7:00 a. m."; the way Colombians read a clock. */
export function formatTime(hhmm: string): string {
  const [hours = 0, minutes = 0] = hhmm.split(':').map(Number)
  const suffix = hours < 12 ? 'a. m.' : 'p. m.'
  const h12 = hours % 12 === 0 ? 12 : hours % 12
  return `${h12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

export function describeReminder(reminder: Reminder): string {
  const at = formatTime(reminder.timeLocal)

  if (reminder.frequency === 'monthly') {
    const day = reminder.dayOfMonth ?? 1
    const tail = day > 28 ? ' (o el último día, si el mes es más corto)' : ''
    return `El día ${day} de cada mes, a las ${at}${tail}`
  }

  const name = weekdayName(reminder.weekday ?? 1)
  return reminder.frequency === 'weekly'
    ? `Cada ${name}, a las ${at}`
    : `Cada dos semanas, el ${name}, a las ${at}`
}

/** "sáb 4 oct" — for "Próximo mercado: …" when notifications are off. */
export function formatShortDate(date: Date): string {
  return `${WEEKDAY_SHORT[isoWeekday(date) - 1]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`
}
