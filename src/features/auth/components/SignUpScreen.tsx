import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { useRef } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Pressable, Text, type TextInput } from 'react-native'

import { AuthFailure } from '../api/auth-repository'
import { useSignUp } from '../hooks/useAuthActions'
import {
  authErrorMessage,
  MIN_PASSWORD_LENGTH,
  signUpSchema,
  type SignUpCredentials,
  type SignUpForm,
} from '../model/credentials'
import { AuthLayout, FormError, SubmitButton } from './AuthLayout'
import { FormField } from './FormField'

type SignUpScreenProps = {
  redirectTo: string
}

export function SignUpScreen({ redirectTo }: SignUpScreenProps) {
  const router = useRouter()
  const signUp = useSignUp()
  const emailRef = useRef<TextInput>(null)
  const passwordRef = useRef<TextInput>(null)

  const { control, handleSubmit, formState } = useForm<SignUpForm, unknown, SignUpCredentials>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  })

  const submit = handleSubmit((credentials) => signUp.mutate(credentials))
  const goToSignIn = () => router.replace({ pathname: '/sign-in', params: { redirectTo } })

  // Only reachable where email confirmation is on (production, ADR-0005).
  // Locally the session arrives at once and the layout redirects.
  if (signUp.data?.needsConfirmation) {
    return (
      <AuthLayout title="Revisa tu correo" subtitle="Te enviamos un enlace para activar tu cuenta.">
        <Text className="text-base text-foreground">
          Cuando lo abras, vuelve aquí e inicia sesión.
        </Text>
        <SubmitButton label="Ir a iniciar sesión" busy={false} onPress={goToSignIn} />
      </AuthLayout>
    )
  }

  const serverError = signUp.isError
    ? authErrorMessage(signUp.error instanceof AuthFailure ? signUp.error.code : undefined)
    : null

  return (
    <AuthLayout title="Crea tu cuenta" subtitle="Tus listas quedan guardadas y a tu nombre.">
      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <FormField
            label="Nombre"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.displayName?.message}
            placeholder="Cómo te llamamos"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
        )}
      />

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <FormField
            ref={emailRef}
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
            placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
        )}
      />

      <FormError message={serverError} />
      <SubmitButton label="Crear cuenta" busy={signUp.isPending} onPress={submit} />

      <Pressable
        onPress={goToSignIn}
        accessibilityRole="link"
        className="mt-4 h-12 items-center justify-center"
      >
        <Text className="text-sm text-muted-foreground">
          ¿Ya tienes cuenta? <Text className="font-medium text-foreground">Inicia sesión</Text>
        </Text>
      </Pressable>
    </AuthLayout>
  )
}
