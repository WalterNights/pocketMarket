import { isRunningInExpoGo } from 'expo'
import type * as ExpoNotifications from 'expo-notifications'
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

/**
 * `unavailable`: this runtime cannot show notifications at all — Expo Go on
 * Android. Not the user's choice, so the UI must not send them to Settings.
 */
export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable'

type NotificationsModule = typeof ExpoNotifications

let loaded: NotificationsModule | null | undefined

/**
 * Loaded lazily, never at import time. Since SDK 53, merely importing
 * expo-notifications in Expo Go on Android THROWS — and because the reminders
 * feature is reachable from the root layout, a top-level import took the whole
 * app down with it (EXPO-003). Development and store builds load it normally.
 */
function load(): NotificationsModule | null {
  if (loaded !== undefined) return loaded

  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    loaded = null
    return loaded
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose: a static import throws in Expo Go (see above)
    const module: NotificationsModule = require('expo-notifications')

    // Shown while the app is open too: a reminder missed because the app
    // happened to be in the foreground is a reminder that did not work.
    module.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })

    loaded = module
  } catch (cause) {
    console.warn('expo-notifications could not be loaded; reminders will not ring', cause)
    loaded = null
  }

  return loaded
}

let channelReady: Promise<void> | null = null

function ensureChannel(module: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve()

  channelReady ??= module
    .setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Recordatorios de mercado',
      importance: module.AndroidImportance.DEFAULT,
    })
    .then(() => undefined)

  return channelReady
}

function toState(status: ExpoNotifications.NotificationPermissionsStatus): PermissionState {
  if (status.granted) return 'granted'
  // Denied for good: iOS never asks twice, Android stops asking after two no's.
  return status.canAskAgain ? 'undetermined' : 'denied'
}

export const notifications = {
  async permission(): Promise<PermissionState> {
    const module = load()
    if (module === null) return 'unavailable'
    return toState(await module.getPermissionsAsync())
  },

  /**
   * Asks the OS. Call ONLY from a user action that needs it — creating a
   * reminder — never at startup: an ask without context is a near-certain
   * no, and on iOS that no is final (03-reminders.md, "Permisos").
   */
  async request(): Promise<PermissionState> {
    const module = load()
    if (module === null) return 'unavailable'

    const current = await module.getPermissionsAsync()
    if (current.granted || !current.canAskAgain) return toState(current)
    return toState(await module.requestPermissionsAsync())
  },

  /** The app's page in system settings, the way back after a denial. */
  openSettings(): Promise<void> {
    return Linking.openSettings()
  },

  async scheduledIds(): Promise<string[]> {
    const module = load()
    if (module === null) return []

    const requests = await module.getAllScheduledNotificationsAsync()
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
    const module = load()
    if (module === null) return

    await ensureChannel(module)
    await module.scheduleNotificationAsync({
      identifier: input.identifier,
      content: { title: input.title, body: input.body, data: input.data },
      trigger: {
        type: module.SchedulableTriggerInputTypes.DATE,
        date: input.date,
        channelId: CHANNEL_ID,
      },
    })
  },

  async cancel(identifier: string): Promise<void> {
    const module = load()
    if (module === null) return
    await module.cancelScheduledNotificationAsync(identifier)
  },

  /**
   * Calls `onOpen` with the notification's data when the user taps one — also
   * the tap that cold-started the app. Returns the unsubscribe.
   */
  onOpen(onOpen: (data: unknown) => void): () => void {
    const module = load()
    if (module === null) return () => undefined

    const last = module.getLastNotificationResponse()
    if (last !== null) {
      onOpen(last.notification.request.content.data)
      module.clearLastNotificationResponse()
    }

    const subscription = module.addNotificationResponseReceivedListener((response) =>
      onOpen(response.notification.request.content.data),
    )
    return () => subscription.remove()
  },
}
