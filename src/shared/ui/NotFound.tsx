import { useRouter } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

type NotFoundProps = {
  /** "Esta tienda no existe", "Este producto no existe"… */
  title: string
  message?: string
}

const DEFAULT_MESSAGE = 'Puede que el enlace esté incompleto o ya no sea válido.'

/**
 * What a route renders when its params do not parse — a malformed deep link
 * or notification. A blank screen there is a dead end; this always offers a
 * way back (05-navigation.md). With no history to go back to (the app was
 * opened straight on the link) it goes home instead.
 */
export function NotFound({ title, message = DEFAULT_MESSAGE }: NotFoundProps) {
  const router = useRouter()

  const goBack = () => {
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }

  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <Text className="text-center text-base text-foreground" accessibilityRole="header">
        {title}
      </Text>
      <Text className="mt-1 text-center text-sm text-muted-foreground">{message}</Text>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        className="mt-4 h-11 justify-center rounded-md bg-primary px-5 active:opacity-80"
      >
        <Text className="text-base font-medium text-primary-foreground">Volver</Text>
      </Pressable>
    </View>
  )
}
