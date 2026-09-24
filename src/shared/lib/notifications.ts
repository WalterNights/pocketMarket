import * as Notifications from 'expo-notifications'
import { Linking, Platform } from 'react-native'

/**
 * Adapter over expo-notifications: the only file that touches the system
 * notification API (rules/react-native.md, "Específico de móvil"). Local
 * notifications only — no push tokens, no servers (docs/domain/03-reminders.md).
 *
 * Knows nothing about lists or reminders: it schedules, cancels and reports.
 */

/** Android groups notifications by channel; the user can mute ours by name. */
const CHANNEL_ID = 'reminders'

export type PermissionState = 'granted' | 'denied' | 'undetermined'

// Shown while the app is open too: a reminder the user misses because the app
// happened to be in the foreground is a reminder that did not work.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

let channelReady: Promise<void> | null = null

function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve()

  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recordatorios de mercado',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).then(() => undefined)

  return channelReady
}

function toState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  if (status.granted) return 'granted'
  // Denied for good: iOS never asks twice, Android stops asking after two no's.
  return status.canAskAgain ? 'undetermined' : 'denied'
}

export const notifications = {
  async permission(): Promise<PermissionState> {
    return toState(await Notifications.getPermissionsAsync())
  },

  /**
   * Asks the OS. Call ONLY from a user action that needs it — creating a
   * reminder — never at startup: an ask without context is a near-certain
   * no, and on iOS that no is final (03-reminders.md, "Permisos").
   */
  async request(): Promise<PermissionState> {
    const current = await Notifications.getPermissionsAsync()
    if (current.granted || !current.canAskAgain) return toState(current)
    return toState(await Notifications.requestPermissionsAsync())
  },

  /** The app's page in system settings, the way back after a denial. */
  openSettings(): Promise<void> {
    return Linking.openSettings()
  },

  async scheduledIds(): Promise<string[]> {
    const requests = await Notifications.getAllScheduledNotificationsAsync()
    return requests.map((request) => request.identifier)
  },

  /** Same identifier replaces the pending one: scheduling is idempotent. */
  async scheduleAt(input: {
    identifier: string
    date: Date
    title: string
    body: string
    data: Record<string, string>
  }): Promise<void> {
    await ensureChannel()
    await Notifications.scheduleNotificationAsync({
      identifier: input.identifier,
      content: { title: input.title, body: input.body, data: input.data },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: input.date,
        channelId: CHANNEL_ID,
      },
    })
  },

  cancel(identifier: string): Promise<void> {
    return Notifications.cancelScheduledNotificationAsync(identifier)
  },

  /**
   * Calls `onOpen` with the notification's data when the user taps one — also
   * the tap that cold-started the app. Returns the unsubscribe.
   */
  onOpen(onOpen: (data: unknown) => void): () => void {
    const last = Notifications.getLastNotificationResponse()
    if (last !== null) {
      onOpen(last.notification.request.content.data)
      Notifications.clearLastNotificationResponse()
    }

    const subscription = Notifications.addNotificationResponseReceivedListener((response) =>
      onOpen(response.notification.request.content.data),
    )
    return () => subscription.remove()
  },
}
