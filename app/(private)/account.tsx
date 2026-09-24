import { Stack } from 'expo-router'

import { AccountScreen } from '@/features/auth'

/** Route: composition only (rule 2 in CLAUDE.md). */
export default function AccountRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Tu cuenta' }} />
      <AccountScreen />
    </>
  )
}
