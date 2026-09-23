import { z } from 'zod'

/**
 * Environment validation. Fails at startup with a clear message instead of
 * surfacing `undefined` halfway through a flow (rule 5 in CLAUDE.md).
 *
 * Everything here is EXPO_PUBLIC_*, which means it ends up inside the app
 * bundle and is readable by anyone. That is fine for these two: the anon key's
 * power is bounded by RLS policies, not by secrecy (08-security.md).
 */
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

const parsed = envSchema.safeParse({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
})

if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ')
  throw new Error(
    `Configuración de entorno inválida: ${missing}. Copia .env.example a .env y complétalo.`,
  )
}

export const env = {
  supabaseUrl: parsed.data.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey: parsed.data.EXPO_PUBLIC_SUPABASE_ANON_KEY,
} as const
