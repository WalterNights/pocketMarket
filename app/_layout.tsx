import '../global.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { Stack, useRouter } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useCallback } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useSessionListener } from '@/features/auth'
import { useOpenListFromNotification, useReminderSync } from '@/features/reminders'
import { useAppBoot } from '@/shared/lib/app-boot'
import { queryClient } from '@/shared/lib/query-client'
import { LoadingScreen } from '@/shared/ui'

/**
 * Root layout. Composition only: providers, theming and the navigator.
 * No data fetching and no business logic here (rule 2 in CLAUDE.md).
 */
export default function RootLayout() {
  const ready = useAppBoot()
  useSessionListener()
  useReminderSync()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          {ready ? (
            <>
              <Stack screenOptions={{ headerShown: false }} />
              <NotificationRouter />
            </>
          ) : (
            <LoadingScreen />
          )}
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

/**
 * Opens the list a reminder was about. Mounted only once the navigator exists:
 * a tap that cold-starts the app arrives immediately, and navigating before
 * the root layout mounts throws. Signed out, the private guard sends the user
 * to sign in and back.
 */
function NotificationRouter() {
  const router = useRouter()
  const openList = useCallback(
    (id: string) => router.push({ pathname: '/lists/[id]', params: { id } }),
    [router],
  )
  useOpenListFromNotification(openList)
  return null
}
