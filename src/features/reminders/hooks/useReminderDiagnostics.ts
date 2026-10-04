import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { notifications } from '@/shared/lib/notifications'

import { reminderKeys } from '../api/keys'
import { reminderRepository } from '../api/reminder-repository'
import {
  parseScheduledIdentifier,
  planNotifications,
  type PlannedNotification,
  type ScheduledReminder,
} from '../model/plan'
import { syncReminders } from './useReminderSync'

/** Test notifications use their own prefix, so reconciliation never touches them. */
const TEST_PREFIX = 'debug:'
const TEST_DELAY_MS = 60_000

export type ReminderDiagnostics = {
  permission: Awaited<ReturnType<typeof notifications.permission>>
  /** What Supabase says should ring, soonest first. */
  planned: PlannedNotification[]
  /** What the phone actually holds, soonest first. */
  scheduled: ScheduledReminder[]
  testCount: number
  /** Planned and scheduled are the same set: reconciliation did its job. */
  inSync: boolean
}

async function diagnose(): Promise<ReminderDiagnostics> {
  const permission = await notifications.permission()
  const planned = planNotifications(await reminderRepository.contexts(), new Date())
  const ids = await notifications.scheduledIds()

  const scheduled = ids
    .map(parseScheduledIdentifier)
    .filter((item) => item !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const plannedIds = new Set(planned.map((item) => item.identifier))
  const inSync =
    scheduled.length === planned.length &&
    scheduled.every((item) => plannedIds.has(item.identifier))

  return {
    permission,
    planned,
    scheduled,
    testCount: ids.filter((id) => id.startsWith(TEST_PREFIX)).length,
    inSync,
  }
}

/**
 * Development-only view of the reminder pipeline: what should ring against what
 * the phone holds. Lets a reminder be verified in minutes instead of waiting
 * for Saturday (docs/guias/probar-avisos.md).
 */
export function useReminderDiagnostics() {
  return useQuery({
    queryKey: reminderKeys.diagnostics(),
    queryFn: diagnose,
    staleTime: 0,
    networkMode: 'always',
  })
}

export function useDiagnosticsActions() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: reminderKeys.diagnostics() })

  const options = { networkMode: 'always', retry: false, onSettled: refresh } as const

  const requestPermission = useMutation({ mutationFn: () => notifications.request(), ...options })

  const syncNow = useMutation({ mutationFn: () => syncReminders(), ...options })

  /**
   * A real notification through the same adapter the reminders use, one
   * minute out. With a list id it also exercises the tap → open-list path.
   */
  const scheduleTest = useMutation({
    mutationFn: (listId: string | null) =>
      notifications.scheduleAt({
        identifier: `${TEST_PREFIX}${Date.now()}`,
        date: new Date(Date.now() + TEST_DELAY_MS),
        title: 'Aviso de prueba',
        body: listId
          ? 'Tócalo: debería abrir la lista.'
          : 'Si ves esto, los avisos funcionan en este teléfono.',
        data: listId ? { listId } : {},
      }),
    ...options,
  })

  const cancelTests = useMutation({
    mutationFn: async () => {
      const ids = await notifications.scheduledIds()
      for (const id of ids.filter((item) => item.startsWith(TEST_PREFIX))) {
        await notifications.cancel(id)
      }
    },
    ...options,
  })

  return { requestPermission, syncNow, scheduleTest, cancelTests }
}
