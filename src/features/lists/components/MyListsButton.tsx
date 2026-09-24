import { useRouter } from 'expo-router'
import ListChecks from 'lucide-react-native/icons/list-checks'
import { Pressable } from 'react-native'

const FOREGROUND = '#1F1D1B'

/** Header entry to "Mis listas". Signed out, the private guard asks for a session first. */
export function MyListsButton() {
  const router = useRouter()

  return (
    <Pressable
      onPress={() => router.push('/lists')}
      accessibilityRole="button"
      accessibilityLabel="Mis listas"
      hitSlop={8}
      className="h-11 w-11 items-center justify-center rounded-md active:bg-muted"
    >
      <ListChecks size={24} color={FOREGROUND} strokeWidth={1.75} />
    </Pressable>
  )
}
