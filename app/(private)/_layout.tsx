import { Redirect, Stack, usePathname } from 'expo-router'

import { selectStatus, useSessionStore } from '@/features/auth'
import { LoadingScreen } from '@/shared/ui'

const HEADER = {
  headerShown: true,
  headerBackTitle: 'Atrás',
  headerStyle: { backgroundColor: '#FAF8F3' },
  headerTintColor: '#1F1D1B',
  headerShadowVisible: false,
} as const

/**
 * Guard for everything that belongs to a user. The catalogue stays public
 * (ADR-0005); only what lives under this group asks for a session.
 *
 * `loading` renders the loader, not the redirect: the session is read from
 * SecureStore asynchronously, and redirecting before it arrives would bounce
 * every signed-in user through the login screen on each cold start.
 */
export default function PrivateGroupLayout() {
  const status = useSessionStore(selectStatus)
  const pathname = usePathname()

  if (status === 'loading') return <LoadingScreen />

  if (status === 'signed-out') {
    return <Redirect href={{ pathname: '/sign-in', params: { redirectTo: pathname } }} />
  }

  return <Stack screenOptions={HEADER} />
}
