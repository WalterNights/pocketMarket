import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { notifications, type PermissionState } from '@/shared/lib/notifications'

import { reminderKeys } from '../api/keys'
import { reminderRepository } from '../api/reminder-repository'
import type { Reminder } from '../model/reminder'
import { syncReminders } from './useReminderSync'

/**
 * The whole feature, not just the list: saving may have just asked for
 * notification permission, and the permission query must re-read it.
 */
function invalidateReminders(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: reminderKeys.all })
}

export function useListReminder(listId: string) {
  return useQuery({
    queryKey: reminderKeys.forList(listId),
    queryFn: ({ signal }) => reminderRepository.forList(listId, signal),
    enabled: listId.length > 0,
  })
}

/**
 * Resolves once the server has the reminder and permission is settled; the
 * reconciliation with the phone's schedule runs on without holding the
 * button (it is serialised and logs its own failures).
 *
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
      // must not turn that into "could not save": it is reported and read as
      // "this phone cannot ring", which sends no one to Settings for nothing.
      const permission = await notifications.request().catch((cause: unknown) => {
        console.warn('Notification permission request failed', cause)
        return 'unavailable' as const
      })
      void syncReminders()
      return { permission }
    },
    networkMode: 'always',
    retry: false,
    onSuccess: () => invalidateReminders(queryClient),
  })
}

export function useRemoveReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (listId: string): Promise<void> => {
      await reminderRepository.remove(listId)
      void syncReminders()
    },
    networkMode: 'always',
    retry: false,
    onSuccess: () => invalidateReminders(queryClient),
  })
}

/** For the degraded path: is the OS going to ring at all? */
export function useNotificationPermission() {
  return useQuery({
    queryKey: reminderKeys.permission(),
    queryFn: () => notifications.permission(),
    // Cheap to ask, and the user may flip it in system settings at any time:
    // re-read on every return to the foreground (useQueryLifecycle).
    staleTime: 0,
    refetchOnWindowFocus: true,
    networkMode: 'always',
  })
}

/**
 * "Activar avisos" for a permission that can still be asked (Android after a
 * first no). Once granted, the reminders saved meanwhile get scheduled: the
 * background sync skipped them while permission was missing.
 */
export function useRequestNotificationPermission() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<PermissionState> => {
      const permission = await notifications.request()
      if (permission === 'granted') void syncReminders()
      return permission
    },
    networkMode: 'always',
    retry: false,
    onError: (cause) => console.warn('Notification permission request failed', cause),
    onSettled: () => queryClient.invalidateQueries({ queryKey: reminderKeys.permission() }),
  })
}
