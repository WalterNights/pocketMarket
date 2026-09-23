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

      {/*
        The mark above already carries the label, so this text is decoration
        for the eye. Both props are needed: accessibilityElementsHidden is iOS
        only and without the Android one the message is announced twice.
      */}
      <Text
        className="mt-8 text-sm text-muted-foreground"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {message}
      </Text>
    </View>
  )
}
