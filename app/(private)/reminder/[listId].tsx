import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { reminderListParamSchema } from '@/features/lists'
import { ReminderEditorScreen } from '@/features/reminders'

/** Route: the reminder of one saved list. */
export default function ReminderRoute() {
  const router = useRouter()
  const parsed = reminderListParamSchema.safeParse(useLocalSearchParams())

  return (
    <>
      <Stack.Screen options={{ title: 'Aviso de mercado', presentation: 'modal' }} />
      {parsed.success ? (
        <ReminderEditorScreen listId={parsed.data.listId} onDone={() => router.back()} />
      ) : null}
    </>
  )
}
