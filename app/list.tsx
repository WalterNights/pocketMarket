import { Stack } from 'expo-router'

import { DraftListScreen } from '@/features/lists'

/** Route: composition only (rule 2 in CLAUDE.md). */
export default function ListRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Mi lista',
          headerShown: true,
          headerBackTitle: 'Atrás',
          headerStyle: { backgroundColor: '#FAF8F3' },
          headerTintColor: '#1F1D1B',
          headerShadowVisible: false,
        }}
      />
      <DraftListScreen />
    </>
  )
}
