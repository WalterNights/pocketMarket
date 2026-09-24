import { useRouter } from 'expo-router'
import LogOut from 'lucide-react-native/icons/log-out'
import { Pressable, Text, View } from 'react-native'

import { useSignOut } from '../hooks/useAuthActions'
import { selectUser, useSessionStore } from '../store/session-store'

const DESTRUCTIVE = '#A33F3F'

/** Who is signed in, and the way out. Rendered behind the (private) guard. */
export function AccountScreen() {
  const router = useRouter()
  const user = useSessionStore(selectUser)
  const signOut = useSignOut()

  // Leave the private area first, then sign out. The other order bounces the
  // user through the sign-in screen: the private guard redirects the moment
  // the session ends, before this screen can navigate anywhere. replace, not
  // back, so no private screen stays in the stack (05-navigation.md).
  const leave = () => {
    router.replace('/')
    signOut.mutate()
  }

  return (
    <View className="flex-1 bg-background px-4 pt-4">
      <View className="rounded-lg border border-border bg-card p-4">
        <Text className="text-lg font-semibold text-foreground">
          {user?.displayName ?? 'Sin nombre'}
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground">{user?.email ?? ''}</Text>
      </View>

      <Pressable
        onPress={leave}
        disabled={signOut.isPending}
        accessibilityRole="button"
        accessibilityState={{ disabled: signOut.isPending, busy: signOut.isPending }}
        className="mt-6 h-12 flex-row items-center justify-center rounded-md border border-border bg-card active:bg-muted"
      >
        <LogOut size={20} color={DESTRUCTIVE} strokeWidth={1.75} />
        <Text className="ml-2 text-base font-medium text-destructive">
          {signOut.isPending ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Text>
      </Pressable>
    </View>
  )
}
