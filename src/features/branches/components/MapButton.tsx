import { useRouter } from 'expo-router'
import MapIcon from 'lucide-react-native/icons/map'
import { Pressable } from 'react-native'

const FOREGROUND = '#1F1D1B'

/** Header entry to the map of nearby shops. Public: no account needed. */
export function MapButton() {
  const router = useRouter()

  return (
    <Pressable
      onPress={() => router.push('/map')}
      accessibilityRole="button"
      accessibilityLabel="Tiendas cercanas en el mapa"
      hitSlop={8}
      className="h-11 w-11 items-center justify-center rounded-md active:bg-muted"
    >
      <MapIcon size={24} color={FOREGROUND} strokeWidth={1.75} />
    </Pressable>
  )
}
