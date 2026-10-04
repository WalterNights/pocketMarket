import { ZodError, type z } from 'zod'

import { isClientErrorCode } from '@/shared/utils/error-classification'

/**
 * Typed error so callers never have to unpack Supabase's `{ data, error }`.
 *
 * Keeps the PostgREST / Postgres `code` instead of throwing it away: it is what
 * tells a transient failure (no network) from one that will fail the same way
 * on every attempt, and the query client's retry policy reads `isClientError`.
 */
export class RepositoryError extends Error {
  /** PostgREST/Postgres code; `'network'` when the request never got an answer. */
  readonly code: string | undefined

  constructor(
    readonly operation: string,
    override readonly cause: unknown,
  ) {
    super(`Repository operation failed: ${operation}`)
    this.name = 'RepositoryError'
    this.code = codeOf(cause)
  }

  /** True when retrying cannot help: not found, denied, or an invalid response. */
  get isClientError(): boolean {
    return this.cause instanceof ZodError || isClientErrorCode(this.code)
  }
}

function codeOf(cause: unknown): string | undefined {
  if (typeof cause !== 'object' || cause === null || !('code' in cause)) return undefined
  if (typeof cause.code !== 'string') return undefined
  // PostgREST reports a request that never reached the server with an empty code.
  return cause.code === '' ? 'network' : cause.code
}

/**
 * Validates a response at the boundary. A failure becomes a RepositoryError
 * carrying the ZodError as its cause, so it is typed like every other
 * repository failure and never retried: the same payload fails the same way.
 */
export function parseResponse<T>(schema: z.ZodType<T>, input: unknown, operation: string): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new RepositoryError(operation, result.error)
  return result.data
}
