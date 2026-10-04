import { sleep, type FetchContext } from './types'

/**
 * JSON over HTTP, politely. Retries 429, 5xx, network errors and timeouts with
 * exponential backoff, and gives up on THAT request only: one bad page is not
 * a bad source, and a bad source is not a bad run (ING-003).
 *
 * Every request given up on is reported through `ctx.onRequestDropped`, so the
 * run knows it has holes and can refuse to retire what it did not see.
 */

const DEFAULT_ATTEMPTS = 3

/**
 * Per-request ceiling, body included. Without it a source that accepts the
 * connection and never answers hangs the run until the CI job is killed —
 * and a killed job publishes nothing.
 */
export const REQUEST_TIMEOUT_MS = 30_000

export type PoliteContext = Pick<
  FetchContext,
  'userAgent' | 'delayMs' | 'signal' | 'onRequestDropped'
>

export type FetchOptions = {
  method?: 'GET' | 'POST'
  body?: string
  /** Total attempts, first one included. */
  attempts?: number
  /**
   * Statuses that mean "there is no more data here", not a failure — VTEX
   * answers 400 past its pagination ceiling (ING-005). Not retried, not
   * reported as dropped.
   */
  endStatuses?: readonly number[]
}

export type FetchResult =
  { kind: 'ok'; body: unknown } | { kind: 'end' } | { kind: 'dropped'; reason: string }

/** DOMException (timeouts, aborts) is not always an Error subclass across realms. */
function describe(cause: unknown): string {
  if (typeof cause === 'object' && cause !== null && 'message' in cause) {
    const name = 'name' in cause ? String(cause.name) : 'Error'
    return `${name}: ${String(cause.message)}`
  }
  return String(cause)
}

/** The caller's signal (if any) plus a per-request timeout. */
function requestSignal(outer: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  return outer === undefined ? timeout : AbortSignal.any([outer, timeout])
}

export async function fetchJsonResult(
  url: string,
  ctx: PoliteContext,
  options: FetchOptions = {},
): Promise<FetchResult> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS
  let lastProblem = 'sin intentos'
  let made = 0

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    made = attempt
    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        body: options.body,
        headers: {
          'User-Agent': ctx.userAgent,
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        signal: requestSignal(ctx.signal),
      })

      if (options.endStatuses?.includes(response.status) === true) return { kind: 'end' }

      // ok covers 206 too: paginated VTEX responses come back Partial Content.
      if (response.ok) return { kind: 'ok', body: await response.json() }

      lastProblem = `HTTP ${response.status}`
      const retryable = response.status === 429 || response.status >= 500
      if (!retryable) break
    } catch (cause) {
      // The caller cancelled the whole run: that is not ours to retry.
      if (ctx.signal?.aborted === true) throw cause
      // Network error, timeout, or a body that died halfway: all transient
      // until proven otherwise, so they get the same backoff as a 5xx.
      lastProblem = describe(cause)
    }

    // Backing off is also the polite thing to do: a 500 under load means the
    // source is struggling, and hammering it makes that worse.
    if (attempt < attempts) await sleep(ctx.delayMs * 2 ** attempt)
  }

  const reason = `${lastProblem} tras ${made} intento(s)`
  console.warn(`  peticion descartada (${reason}): ${url}`)
  ctx.onRequestDropped?.(url, reason)
  return { kind: 'dropped', reason }
}

/**
 * Convenience over fetchJsonResult for sources with no "end" status. Returns
 * null when the request was dropped (already reported to the context).
 */
export async function fetchJson(
  url: string,
  ctx: PoliteContext,
  init: { method?: 'GET' | 'POST'; body?: string } = {},
): Promise<unknown> {
  const result = await fetchJsonResult(url, ctx, init)
  return result.kind === 'ok' ? result.body : null
}
