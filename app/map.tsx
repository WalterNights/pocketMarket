import { Stack } from 'expo-router'

import { StoreMapScreen } from '@/features/branches'

/** Route: composition only (rule 2 in CLAUDE.md). Public — no account needed. */
export default function MapRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Tiendas cercanas',
          headerShown: true,
          headerBackTitle: 'Atrás',
          headerStyle: { backgroundColor: '#FAF8F3' },
          headerTintColor: '#1F1D1B',
          headerShadowVisible: false,
        }}
      />
      <StoreMapScreen />
    </>
  )
}
