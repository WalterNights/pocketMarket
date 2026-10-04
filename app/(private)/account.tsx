import { Stack, useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

import { AccountScreen } from '@/features/auth'

/**
 * Route: composition only (rule 2 in CLAUDE.md). In development it also links
 * to the reminder diagnostics; auth knows nothing about reminders, so the link
 * is composed here rather than inside AccountScreen.
 */
export default function AccountRoute() {
  const router = useRouter()

  return (
    <>
      <Stack.Screen options={{ title: 'Tu cuenta' }} />
      <View className="flex-1 bg-background">
        <AccountScreen />
        {__DEV__ ? (
          <Pressable
            onPress={() => router.push('/dev/reminders')}
            accessibilityRole="button"
            className="mx-4 mb-8 h-11 justify-center"
          >
            <Text className="text-center text-sm text-muted-foreground underline">
              Diagnóstico de avisos (solo desarrollo)
            </Text>
          </Pressable>
        ) : null}
      </View>
    </>
  )
}
