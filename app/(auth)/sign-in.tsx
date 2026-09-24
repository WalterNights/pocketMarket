import { useLocalSearchParams } from 'expo-router'

import { safeRedirect, SignInScreen } from '@/features/auth'

/** Route: composition only (rule 2 in CLAUDE.md). */
export default function SignInRoute() {
  const { redirectTo } = useLocalSearchParams()
  return <SignInScreen redirectTo={safeRedirect(redirectTo)} />
}
