import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

type ErrorStateProps = {
  /** What failed, in the user's words: "No se pudieron cargar las tiendas". */
  title: string
  /** What to do about it. Defaults to the connection hint. */
  message?: string
  onRetry: () => void
  /** Optional line icon above the title, same one the empty state uses. */
  icon?: ReactNode
}

const DEFAULT_MESSAGE = 'Revisa tu conexión e inténtalo de nuevo.'

/**
 * Error state for any view backed by remote data: actionable, with a retry,
 * never a dead end (ui-styling.md, "Estados de UI").
 */
export function ErrorState({ title, message = DEFAULT_MESSAGE, onRetry, icon }: ErrorStateProps) {
  return (
    <View
      className="flex-1 items-center justify-center bg-background px-8"
      accessibilityRole="alert"
    >
      {icon ? <View className="mb-3">{icon}</View> : null}
      <Text className="text-center text-base text-foreground">{title}</Text>
      <Text className="mt-1 text-center text-sm text-muted-foreground">{message}</Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Reintentar"
        accessibilityHint={title}
        className="mt-4 h-11 justify-center rounded-md bg-primary px-5 active:opacity-80"
      >
        <Text className="text-base font-medium text-primary-foreground">Reintentar</Text>
      </Pressable>
    </View>
  )
}
