import { Text, View } from 'react-native'

import { PocketLoader } from './PocketLoader'

/**
 * Full-screen loading state, for when there is nothing yet to draw a skeleton
 * of: cold start, session check, a route resolving its data.
 *
 * Everywhere a list is loading we use a skeleton shaped like the content
 * instead (docs/architecture/06-design-system.md) — a centred spinner over a
 * screen we could already outline just throws away information the user could
 * be reading. This is the case where we genuinely have nothing.
 */

type LoadingScreenProps = {
  /** Said out loud by the screen reader and shown under the mark. */
  message?: string
}

export function LoadingScreen({ message = 'Cargando' }: LoadingScreenProps) {
  return (
    <View className="flex-1 items-center justify-center bg-background px-8">
      <PocketLoader label={message} />

      <Text className="mt-8 text-sm text-muted-foreground" accessibilityElementsHidden>
        {message}
      </Text>
    </View>
  )
}
