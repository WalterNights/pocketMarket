import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { notifications, type PermissionState } from '@/shared/lib/notifications'

import { reminderKeys } from '../api/keys'
import { reminderRepository } from '../api/reminder-repository'
import type { Reminder } from '../model/reminder'
import { syncReminders } from './useReminderSync'

export function useListReminder(listId: string) {
  return useQuery({
    queryKey: reminderKeys.forList(listId),
    queryFn: ({ signal }) => reminderRepository.forList(listId, signal),
    enabled: listId.length > 0,
  })
}

/**
 * Saves first, asks for permission second. A denial must not lose the
 * reminder: it is kept in Supabase, the list shows the next shopping day, and
 * the user can enable notifications later (03-reminders.md, "Si se deniega").
 *
 * `networkMode: 'always'`: saving needs the server, and 'offlineFirst' would
 * park the mutation as paused with the button spinning and no explanation.
 */
export function useSaveReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reminder: Reminder): Promise<{ permission: PermissionState }> => {
      await reminderRepository.save(reminder)
      // Past this line the reminder IS saved. A failure asking for permission
      // (e.g. a runtime without notification support) must not turn that into
      // "could not save": it is reported and read as "will not ring".
      const permission = await notifications.request().catch((cause: unknown) => {
        console.warn('Notification permission request failed', cause)
        return 'denied' as const
      })
      await syncReminders()
      return { permission }
    },
    networkMode: 'always',
    retry: false,
    onSuccess: (_result, reminder) =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.forList(reminder.listId) }),
  })
}

export function useRemoveReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (listId: string): Promise<void> => {
      await reminderRepository.remove(listId)
      await syncReminders()
    },
    networkMode: 'always',
    retry: false,
    onSuccess: (_result, listId) =>
      queryClient.invalidateQueries({ queryKey: reminderKeys.forList(listId) }),
  })
}

/** For the degraded path: is the OS going to ring at all? */
export function useNotificationPermission() {
  return useQuery({
    queryKey: reminderKeys.permission(),
    queryFn: () => notifications.permission(),
    // Cheap to ask, and the user may flip it in system settings at any time.
    staleTime: 0,
    networkMode: 'always',
  })
}
