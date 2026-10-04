import { Stack } from 'expo-router'
import { Text, View } from 'react-native'

import { ReminderDiagnosticsScreen } from '@/features/reminders'

/**
 * Route: reminder diagnostics. Development builds only — `__DEV__` is false in
 * a release build, so a user who reaches this URL sees nothing to act on.
 */
export default function ReminderDiagnosticsRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Diagnóstico de avisos' }} />
      {__DEV__ ? (
        <ReminderDiagnosticsScreen />
      ) : (
        <View className="flex-1 items-center justify-center bg-background px-8">
          <Text className="text-center text-base text-foreground">No disponible.</Text>
        </View>
      )}
    </>
  )
}
