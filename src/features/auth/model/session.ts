import { z } from 'zod'

/**
 * The slice of the Supabase user the app actually uses. Parsed, not cast: the
 * user object is a network response (rule 5), and `user_metadata` is free-form
 * JSON the client itself wrote at sign-up.
 */
export const sessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().nullable(),
  displayName: z.string().nullable(),
})

export type SessionUser = z.infer<typeof sessionUserSchema>

/**
 * Three states, not two. Reading the session from SecureStore is async, and
 * without `loading` a signed-in user would flash the sign-in screen on every
 * cold start (05-navigation.md).
 */
export type SessionStatus = 'loading' | 'signed-in' | 'signed-out'

export function toSessionUser(raw: {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}): SessionUser {
  const name = raw.user_metadata?.display_name
  return sessionUserSchema.parse({
    id: raw.id,
    email: raw.email ?? null,
    displayName: typeof name === 'string' && name.trim() !== '' ? name.trim() : null,
  })
}

/** "Walter Nights" → "Walter". Falls back to the email's local part. */
export function greetingName(user: SessionUser): string {
  const first = user.displayName?.split(/\s+/)[0]
  if (first) return first
  return user.email?.split('@')[0] ?? 'tú'
}
