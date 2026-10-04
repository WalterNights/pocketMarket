import { Stack } from 'expo-router'

import { DraftListScreen } from '@/features/lists'
import { flatHeaderOptions } from '@/shared/ui'

/** Route: composition only (rule 2 in CLAUDE.md). */
export default function ListRoute() {
  return (
    <>
      <Stack.Screen options={{ ...flatHeaderOptions, title: 'Mi lista' }} />
      <DraftListScreen />
    </>
  )
}
