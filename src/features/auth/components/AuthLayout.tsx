import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type AuthLayoutProps = {
  title: string
  subtitle: string
  children: ReactNode
}

/**
 * Shared frame for sign-in and sign-up: keyboard-aware, scrollable at 200%
 * font size, and dismissing the keyboard does not swallow a tap on a button.
 */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const insets = useSafeAreaInsets()

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        className="px-4"
      >
        <View className="pb-6 pt-4">
          <Text className="text-2xl font-semibold text-foreground">{title}</Text>
          <Text className="mt-1 text-sm text-muted-foreground">{subtitle}</Text>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

type SubmitButtonProps = {
  label: string
  busy: boolean
  onPress: () => void
}

export function SubmitButton({ label, busy, onPress }: SubmitButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: busy, busy }}
      className={`mt-2 h-12 flex-row items-center justify-center rounded-md bg-primary ${
        busy ? 'opacity-60' : 'active:opacity-80'
      }`}
    >
      {busy ? <ActivityIndicator color="#FAF8F3" /> : null}
      <Text className={`text-base font-medium text-primary-foreground ${busy ? 'ml-2' : ''}`}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Server-side failure, shown above the button where the eye already is. */
export function FormError({ message }: { message: string | null }) {
  if (message === null) return null

  return (
    <View className="mb-4 rounded-md border border-destructive bg-card p-3">
      <Text className="text-sm text-destructive" accessibilityLiveRegion="assertive">
        {message}
      </Text>
    </View>
  )
}
