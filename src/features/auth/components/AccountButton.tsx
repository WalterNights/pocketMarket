import { useRouter } from 'expo-router'
import CircleUserRound from 'lucide-react-native/icons/circle-user-round'
import { Pressable, Text } from 'react-native'

import { greetingName } from '../model/session'
import { selectStatus, selectUser, useSessionStore } from '../store/session-store'

const FOREGROUND = '#1F1D1B'

/**
 * Header entry to the account. Signed out it offers "Entrar"; signed in it
 * greets by name, so the user can tell at a glance whose lists they will see.
 */
export function AccountButton() {
  const router = useRouter()
  const status = useSessionStore(selectStatus)
  const user = useSessionStore(selectUser)

  // While the session is being read, show nothing rather than a wrong label.
  if (status === 'loading') return null

  const signedIn = status === 'signed-in' && user !== null
  const label = signedIn ? greetingName(user) : 'Entrar'

  return (
    <Pressable
      onPress={() => router.push(signedIn ? '/account' : '/sign-in')}
      accessibilityRole="button"
      accessibilityLabel={signedIn ? `Cuenta de ${label}` : 'Iniciar sesión'}
      hitSlop={8}
      className="h-11 flex-row items-center rounded-md px-2 active:bg-muted"
    >
      <CircleUserRound size={24} color={FOREGROUND} strokeWidth={1.75} />
      <Text className="ml-1.5 text-sm font-medium text-foreground" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}
