import { Stack, useRouter } from 'expo-router'
import { useCallback } from 'react'

import { SavedListsScreen } from '@/features/lists'

/** Route: composition only (rule 2 in CLAUDE.md). */
export default function SavedListsRoute() {
  const router = useRouter()

  const openList = useCallback(
    (id: string) => router.push({ pathname: '/lists/[id]', params: { id } }),
    [router],
  )
  const browse = useCallback(() => router.dismissTo('/'), [router])

  return (
    <>
      <Stack.Screen options={{ title: 'Mis listas' }} />
      <SavedListsScreen onOpenList={openList} onBrowse={browse} />
    </>
  )
}
