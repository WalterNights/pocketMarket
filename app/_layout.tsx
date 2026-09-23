import '../global.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { useAppBoot } from '@/shared/lib/app-boot'
import { queryClient } from '@/shared/lib/query-client'
import { LoadingScreen } from '@/shared/ui'

/**
 * Root layout. Composition only: providers, theming and the navigator.
 * No data fetching and no business logic here (rule 2 in CLAUDE.md).
 */
export default function RootLayout() {
  const ready = useAppBoot()

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="auto" />
          {ready ? <Stack screenOptions={{ headerShown: false }} /> : <LoadingScreen />}
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}
