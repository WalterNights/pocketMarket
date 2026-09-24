import Eye from 'lucide-react-native/icons/eye'
import EyeOff from 'lucide-react-native/icons/eye-off'
import { forwardRef, useState } from 'react'
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native'

const MUTED = '#78726B'

type FormFieldProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string
  error?: string
  /** Password field: hidden text plus a show/hide toggle. */
  secret?: boolean
}

/**
 * Labelled text input with its error beneath it. The error is text, not only a
 * red border: colour is never the only carrier of a signal (ui-styling.md).
 *
 * Lives in `auth` because only auth uses it so far; it moves to shared/ui when
 * a third feature needs it.
 */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, secret = false, ...input },
  ref,
) {
  const [revealed, setRevealed] = useState(false)
  const hidden = secret && !revealed

  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-sm font-medium text-foreground">{label}</Text>

      <View
        className={`h-12 flex-row items-center rounded-md border bg-card ${
          error ? 'border-destructive' : 'border-input'
        }`}
      >
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholderTextColor={MUTED}
          secureTextEntry={hidden}
          className="h-full flex-1 px-3 text-base text-foreground"
          {...input}
        />

        {secret ? (
          <Pressable
            onPress={() => setRevealed((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="h-12 w-12 items-center justify-center"
          >
            {revealed ? (
              <EyeOff size={20} color={MUTED} strokeWidth={1.75} />
            ) : (
              <Eye size={20} color={MUTED} strokeWidth={1.75} />
            )}
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text className="mt-1 text-sm text-destructive" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  )
})
