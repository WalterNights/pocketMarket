import { useLocalSearchParams } from 'expo-router'

import { safeRedirect, SignUpScreen } from '@/features/auth'

/** Route: composition only (rule 2 in CLAUDE.md). */
export default function SignUpRoute() {
  const { redirectTo } = useLocalSearchParams()
  return <SignUpScreen redirectTo={safeRedirect(redirectTo)} />
}
