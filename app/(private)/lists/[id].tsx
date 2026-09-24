import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Text, View } from 'react-native'

import { listIdParamSchema, SavedListScreen } from '@/features/lists'

/**
 * Route: a saved list. Also the target of a reminder notification, so the id
 * is parsed, never cast — a malformed link shows a message, not a crash.
 */
export default function SavedListRoute() {
  const router = useRouter()
  const parsed = listIdParamSchema.safeParse(useLocalSearchParams())

  if (!parsed.success) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Stack.Screen options={{ title: '' }} />
        <Text className="text-center text-base text-foreground">Esta lista no existe.</Text>
      </View>
    )
  }

  const id = parsed.data.id

  return (
    <>
      <Stack.Screen options={{ title: 'Lista' }} />
      <SavedListScreen
        listId={id}
        onEdit={() => router.push('/list')}
        onEditReminder={() =>
          router.push({ pathname: '/reminder/[listId]', params: { listId: id } })
        }
        onDeleted={() => router.dismissTo('/lists')}
      />
    </>
  )
}
