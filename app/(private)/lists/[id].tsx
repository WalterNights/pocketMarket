import { Stack, useLocalSearchParams, useRouter } from 'expo-router'

import { listIdParamSchema, SavedListScreen } from '@/features/lists'
import { NotFound } from '@/shared/ui'

/**
 * Route: a saved list. Also the target of a reminder notification, so the id
 * is parsed, never cast — a malformed link shows a message, not a crash.
 */
export default function SavedListRoute() {
  const router = useRouter()
  const parsed = listIdParamSchema.safeParse(useLocalSearchParams())

  if (!parsed.success) {
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        <NotFound title="Esta lista no existe" />
      </>
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
