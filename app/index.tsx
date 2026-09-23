import { Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * Placeholder home screen. Exists to verify the toolchain end to end;
 * the catalogue slice replaces it next.
 */
export default function HomeRoute() {
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-background px-4" style={{ paddingTop: insets.top + 24 }}>
      <Text className="text-3xl font-semibold text-foreground">Pocket Market</Text>
      <Text className="mt-2 text-base text-muted-foreground">
        Planea tu mercado y sabe cuánto cuesta antes de ir.
      </Text>

      <View className="mt-8 rounded-lg border border-border bg-card p-4">
        <Text className="text-sm text-muted-foreground">Andamiaje listo</Text>
        <Text className="mt-1 text-base text-foreground">
          Expo · expo-router · NativeWind · TanStack Query · Supabase
        </Text>
      </View>
    </View>
  )
}
