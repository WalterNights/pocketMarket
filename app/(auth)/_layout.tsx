import { Redirect, Stack, useGlobalSearchParams, type Href } from 'expo-router'

import { safeRedirect, selectStatus, useSessionStore } from '@/features/auth'

const HEADER = {
  headerShown: true,
  title: '',
  headerBackTitle: 'Atrás',
  headerStyle: { backgroundColor: '#FAF8F3' },
  headerTintColor: '#1F1D1B',
  headerShadowVisible: false,
} as const

/**
 * Typed routes cannot know a path that arrives as a param at runtime. This
 * guard checks what the type claims — an absolute in-app path — instead of
 * casting; safeRedirect has already rejected anything leaving the app.
 */
function isInternalHref(path: string): path is Extract<Href, `/${string}`> {
  return path.startsWith('/') && !path.startsWith('//')
}

/**
 * Sign-in and sign-up. Once the session turns signed-in this layout sends the
 * user on — to where they were headed, or home — with a replace, so "back"
 * never returns to a login screen they have already passed (05-navigation.md).
 */
export default function AuthGroupLayout() {
  const status = useSessionStore(selectStatus)
  const { redirectTo } = useGlobalSearchParams()

  if (status === 'signed-in') {
    const target = safeRedirect(redirectTo)
    return <Redirect href={isInternalHref(target) ? target : '/'} />
  }

  return <Stack screenOptions={HEADER} />
}
