import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Pressable, Text, type TextInput } from 'react-native'

import { AuthFailure } from '../api/auth-repository'
import { useSignIn } from '../hooks/useAuthActions'
import {
  authErrorMessage,
  signInSchema,
  type SignInCredentials,
  type SignInForm,
} from '../model/credentials'
import { AuthLayout, FormError, SubmitButton } from './AuthLayout'
import { FormField } from './FormField'

type SignInScreenProps = {
  /** Already validated by the route (safeRedirect). */
  redirectTo: string
}

/**
 * Does not navigate on success. The (auth) layout watches the session and
 * redirects once it turns signed-in, so there is exactly one place that
 * decides where a signed-in user goes.
 */
export function SignInScreen({ redirectTo }: SignInScreenProps) {
  const router = useRouter()
  const signIn = useSignIn()
  const passwordRef = useRef<TextInput>(null)

  const { control, handleSubmit, formState } = useForm<SignInForm, unknown, SignInCredentials>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const submit = handleSubmit((credentials) => signIn.mutate(credentials))

  const serverError = signIn.isError
    ? authErrorMessage(signIn.error instanceof AuthFailure ? signIn.error.code : undefined)
    : null

  return (
    <AuthLayout title="Inicia sesión" subtitle="Para guardar tus listas y recibir recordatorios.">
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <FormField
            label="Correo"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.email?.message}
            placeholder="tu@correo.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
        )}
      />

      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <FormField
            ref={passwordRef}
            label="Contraseña"
            secret
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.password?.message}
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        )}
      />

      <FormError message={serverError} />
      <SubmitButton label="Entrar" busy={signIn.isPending} onPress={submit} />

      <Pressable
        onPress={() => router.replace({ pathname: '/sign-up', params: { redirectTo } })}
        accessibilityRole="link"
        className="mt-4 h-12 items-center justify-center"
      >
        <Text className="text-sm text-muted-foreground">
          ¿No tienes cuenta? <Text className="font-medium text-foreground">Regístrate</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  )
}
