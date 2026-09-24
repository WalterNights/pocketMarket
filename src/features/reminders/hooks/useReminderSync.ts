import { useEffect } from 'react'
import { AppState } from 'react-native'
import { z } from 'zod'

import { selectStatus, useSessionStore } from '@/features/auth'
import { notifications } from '@/shared/lib/notifications'

import { reminderRepository } from '../api/reminder-repository'
import { planNotifications, reconcile } from '../model/plan'

let running: Promise<void> | null = null
let again = false

async function runOnce(): Promise<void> {
  // Without permission there is nothing to schedule, and asking belongs to a
  // user action, never to a background sync (03-reminders.md, "Permisos").
  if ((await notifications.permission()) !== 'granted') return

  const contexts = await reminderRepository.contexts()
  const planned = planNotifications(contexts, new Date())
  const { cancel, schedule } = reconcile(planned, await notifications.scheduledIds())

  for (const identifier of cancel) await notifications.cancel(identifier)
  for (const item of schedule) {
    await notifications.scheduleAt({
      identifier: item.identifier,
      date: item.date,
      title: item.title,
      body: item.body,
      data: { listId: item.listId },
    })
  }
}

/**
 * Brings the phone's scheduled notifications in line with the reminders in
 * Supabase. Idempotent (deterministic ids), so calling it often is safe; calls
 * that arrive while one is running collapse into a single re-run.
 *
 * Call after anything that changes what should ring: saving or deleting a
 * list or a reminder, signing in or out.
 */
export function syncReminders(): Promise<void> {
  if (running !== null) {
    again = true
    return running
  }

  running = (async () => {
    try {
      do {
        again = false
        await runOnce()
      } while (again)
    } catch (cause) {
      // Reported, not swallowed: the next foreground retries, and a failed
      // sync leaves the previous schedule in place rather than none.
      console.warn('No se pudieron sincronizar los recordatorios', cause)
    } finally {
      running = null
    }
  })()

  return running
}

/**
 * Keeps notifications reconciled for the life of the app: on start, on every
 * return to the foreground (refills consumed biweekly dates) and whenever the
 * session changes. Mounted once, in the root layout.
 */
export function useReminderSync(): void {
  const status = useSessionStore(selectStatus)

  useEffect(() => {
    if (status === 'loading') return
    void syncReminders()
  }, [status])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders()
    })
    return () => subscription.remove()
  }, [])
}

const notificationDataSchema = z.object({ listId: z.string().uuid() })

/**
 * Tapping a reminder opens its list. The payload is untrusted input like any
 * deep link, and it only navigates — it never performs an action
 * (05-navigation.md).
 */
export function useOpenListFromNotification(onOpenList: (listId: string) => void): void {
  useEffect(
    () =>
      notifications.onOpen((data) => {
        const parsed = notificationDataSchema.safeParse(data)
        if (parsed.success) onOpenList(parsed.data.listId)
      }),
    [onOpenList],
  )
}
