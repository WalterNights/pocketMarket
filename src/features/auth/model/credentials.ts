import { z } from 'zod'

/**
 * Form schemas. The client check is a courtesy that saves a round trip; the
 * rule itself lives in Supabase (`minimum_password_length` in config.toml), so
 * both have to move together (ADR-0005).
 */
export const MIN_PASSWORD_LENGTH = 8

/**
 * bcrypt, which Supabase Auth hashes with, reads only the first 72 bytes of a
 * password: anything past that would be silently ignored, so it is refused.
 */
export const MAX_PASSWORD_LENGTH = 72

/** A greeting, not a biography: long enough for any real name. */
export const MAX_DISPLAY_NAME_LENGTH = 60

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Escribe tu correo')
  .pipe(z.email('Ese correo no parece válido'))

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Escribe tu contraseña'),
})

export const signUpSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Escribe tu nombre')
    .max(MAX_DISPLAY_NAME_LENGTH, `Máximo ${MAX_DISPLAY_NAME_LENGTH} caracteres`),
  email,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `Mínimo ${MIN_PASSWORD_LENGTH} caracteres`)
    .max(MAX_PASSWORD_LENGTH, `Máximo ${MAX_PASSWORD_LENGTH} caracteres`),
})

/** What the form holds while typing, before trimming and lowercasing. */
export type SignInForm = z.input<typeof signInSchema>
export type SignUpForm = z.input<typeof signUpSchema>

/** What reaches the repository, already cleaned. */
export type SignInCredentials = z.output<typeof signInSchema>
export type SignUpCredentials = z.output<typeof signUpSchema>

/**
 * Supabase error codes, in the user's words.
 *
 * "Correo o contraseña incorrectos" is deliberately the same message whether
 * the account exists or not: telling them apart would let anyone check which
 * emails are registered.
 */
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  user_already_exists: 'Ya hay una cuenta con ese correo. Inicia sesión.',
  email_exists: 'Ya hay una cuenta con ese correo. Inicia sesión.',
  weak_password: `La contraseña es muy débil. Usa al menos ${MIN_PASSWORD_LENGTH} caracteres.`,
  email_address_invalid: 'Ese correo no parece válido.',
  email_not_confirmed: 'Confirma tu correo antes de entrar. Revisa tu bandeja.',
  over_request_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a probar.',
  over_email_send_rate_limit: 'Demasiados intentos. Espera un momento y vuelve a probar.',
  signup_disabled: 'El registro no está disponible ahora mismo.',
  network: 'Sin conexión. Revisa tu internet y vuelve a intentarlo.',
}

export function authErrorMessage(code: string | undefined): string {
  return (code !== undefined && MESSAGES[code]) || 'Algo salió mal. Vuelve a intentarlo.'
}

/**
 * Where to go after signing in. It arrives as a route param, which is
 * untrusted input: only an internal path is accepted. `//evil.com` is a
 * protocol-relative URL, not a path, and so is anything with a scheme.
 */
const internalPath = z
  .string()
  .regex(/^\/(?!\/)[^:\s\\]*$/)
  .refine((path) => !path.startsWith('/sign-'), 'no volver al login')

export function safeRedirect(value: unknown, fallback = '/'): string {
  const candidate = Array.isArray(value) ? value[0] : value
  const parsed = internalPath.safeParse(candidate)
  return parsed.success ? parsed.data : fallback
}
