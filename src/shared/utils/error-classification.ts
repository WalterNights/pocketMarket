/**
 * Which failures are worth retrying.
 *
 * A retry only helps when the failure is transient: no network, a timeout, the
 * database briefly unreachable. A request the server rejected for what it IS —
 * a row that does not exist, a permission RLS denies, a payload that breaks a
 * constraint, a response that fails validation — fails identically on every
 * attempt, and retrying it three times with backoff just keeps the user looking
 * at a skeleton for half a minute (rules/state-and-data.md: "No reintentar
 * errores 4xx de auth ni 404").
 */

/**
 * SQLSTATE classes that describe the request, not the moment it was made:
 * 22 data exception, 23 integrity violation, 28 invalid authorization,
 * 42 syntax error or access rule violation (42501 is RLS), P0 raised by a
 * function (P0001 raise, P0002 no data found).
 */
const CLIENT_SQLSTATE_CLASSES: readonly string[] = ['22', '23', '28', '42', 'P0']

/**
 * PostgREST's own codes. PGRST0xx are connection and pool errors (503/504):
 * transient. Every other group — request (1xx, including PGRST116 "no rows"
 * from `.single()`), schema cache (2xx) and JWT (3xx) — is about the request.
 */
const POSTGREST_PREFIX = 'PGRST'
const POSTGREST_TRANSIENT_GROUP = 'PGRST0'

/**
 * True when a PostgREST / Postgres error code means "this request will never
 * succeed as is". An empty or missing code is a request that never reached the
 * server — the most transient failure there is — so it is false.
 */
export function isClientErrorCode(code: string | undefined): boolean {
  if (code === undefined || code.length === 0) return false

  if (code.startsWith(POSTGREST_PREFIX)) return !code.startsWith(POSTGREST_TRANSIENT_GROUP)

  return CLIENT_SQLSTATE_CLASSES.some((sqlClass) => code.startsWith(sqlClass))
}

type ClientErrorFlagged = { isClientError: boolean }

/**
 * Structural check for errors that classify themselves (`RepositoryError`,
 * `ListError`). Structural on purpose: shared/ may not import the error classes
 * that live in features (01-overview.md).
 */
export function hasClientErrorFlag(error: unknown): error is ClientErrorFlagged {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isClientError' in error &&
    typeof error.isClientError === 'boolean'
  )
}

/** True when retrying `error` cannot change the outcome. */
export function isNonRetryableError(error: unknown): boolean {
  return hasClientErrorFlag(error) && error.isClientError
}
