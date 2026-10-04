import { z } from 'zod'

/**
 * What every Node runner shares: who we are to the source, how politely we
 * ask, where the database is, and how the command line is read.
 *
 * Arguments are validated with Zod like any other frontier (rule 5): a typo
 * such as `--max cien` must stop the run, not turn into NaN and silently
 * mean "no limit".
 */

/** Identifies us and gives the source a way to get in touch. */
export const USER_AGENT =
  'PocketMarket/0.1 (proyecto personal de comparacion de precios; sm9349168@gmail.com)'

/** One request at a time with a pause. Never lower this to "go faster". */
export const DELAY_MS = 1200

/** Value after `--name`, or undefined when the option is absent. */
export function arg(name: string, argv: readonly string[] = process.argv): string | undefined {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}

export function flag(name: string, argv: readonly string[] = process.argv): boolean {
  return argv.includes(`--${name}`)
}

/** Optional positive integer, e.g. `--max 100`. */
export const positiveIntArg = z.coerce.number().int().positive().optional()

/** Parses `raw` with `schema`, turning Zod's issues into one readable error. */
export function parseArgs<T extends z.ZodType>(schema: T, raw: unknown): z.infer<T> {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return parsed.data

  const detail = parsed.error.issues
    .map((issue) => `--${issue.path.join('.')}: ${issue.message}`)
    .join('; ')
  throw new Error(`Argumentos invalidos: ${detail}`, { cause: parsed.error })
}

/** service_role bypasses RLS: GitHub secrets or local env only, never the app (rule 13). */
export function supabaseEnv(): { supabaseUrl: string; serviceRoleKey: string } {
  // Read through a local: babel-preset-expo (used by Jest) rewrites any literal
  // `process.env.EXPO_PUBLIC_*` into an import of Expo's virtual env module,
  // which does not load outside the app.
  const env = process.env
  const supabaseUrl = env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl === undefined || serviceRoleKey === undefined) {
    throw new Error('Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  }
  return { supabaseUrl, serviceRoleKey }
}
