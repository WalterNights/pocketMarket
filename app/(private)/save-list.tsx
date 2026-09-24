import { Stack, useRouter } from 'expo-router'

import { SaveListScreen, useDraftListStore } from '@/features/lists'

/**
 * Route: name and save the draft. Behind the private guard, so a signed-out
 * user goes through sign-in first and comes back here with the draft intact.
 */
export default function SaveListRoute() {
  const router = useRouter()
  // Read once, at render: after saving, the draft (and edit mode) is cleared.
  const isEditing = useDraftListStore((s) => s.editing !== null)

  const onSaved = (listId: string) => {
    if (isEditing) {
      // Back to the list that was being edited, dropping the editor screens.
      router.dismissTo({ pathname: '/lists/[id]', params: { id: listId } })
      return
    }
    router.dismissTo('/')
    router.push({ pathname: '/lists/[id]', params: { id: listId } })
  }

  return (
    <>
      <Stack.Screen
        options={{ title: isEditing ? 'Guardar cambios' : 'Guardar lista', presentation: 'modal' }}
      />
      <SaveListScreen onSaved={onSaved} />
    </>
  )
}
