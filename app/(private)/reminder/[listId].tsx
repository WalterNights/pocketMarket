import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Text, View } from 'react-native'

import { reminderListParamSchema } from '@/features/lists'
import { ReminderEditorScreen } from '@/features/reminders'

/**
 * Route: the reminder of one saved list. A malformed id (a bad deep link) gets
 * a message instead of an empty modal.
 */
export default function ReminderRoute() {
  const router = useRouter()
  const parsed = reminderListParamSchema.safeParse(useLocalSearchParams())

  return (
    <>
      <Stack.Screen options={{ title: 'Aviso de mercado', presentation: 'modal' }} />
      {parsed.success ? (
        <ReminderEditorScreen listId={parsed.data.listId} onDone={() => router.back()} />
      ) : (
        <View className="flex-1 items-center justify-center bg-background px-8">
          <Text className="text-center text-base text-foreground">Este aviso no existe.</Text>
        </View>
      )}
    </>
  )
}
