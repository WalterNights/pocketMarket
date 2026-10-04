import { z } from 'zod'

import { supabase } from '@/shared/lib/supabase'

import type { Coordinates } from '../model/branch'
import {
  routeErrorCodeSchema,
  routeSchema,
  type Route,
  type RouteErrorCode,
  type TravelMode,
} from '../model/route'

/** Carries the function's error code; the UI words it with routeErrorMessage. */
export class RouteError extends Error {
  constructor(
    readonly code: RouteErrorCode | undefined,
    override readonly cause: unknown,
  ) {
    super(`route failed: ${code ?? 'unknown'}`)
    this.name = 'RouteError'
  }
}

/**
 * Longer than the function's own 10 s budget for the provider, so a slow
 * provider is reported by the function (503) rather than cut off here.
 */
const REQUEST_TIMEOUT_MS = 15_000

const errorBodySchema = z.object({ error: routeErrorCodeSchema })

// Duck-typed, not `instanceof Response`: in React Native the Response class
// supabase-js builds with is not always the global one, and the check fails.
const responseLikeSchema = z.object({
  json: z.custom<() => Promise<unknown>>((value) => typeof value === 'function'),
})

/**
 * The function's error code, when there is one. supabase-js puts the raw
 * Response in `context` for HTTP errors; it is read as untrusted JSON.
 */
async function errorCode(error: {
  name?: string
  context?: unknown
}): Promise<RouteErrorCode | undefined> {
  if (error.name === 'FunctionsFetchError') return 'network'
  if (error.name !== 'FunctionsHttpError') return undefined

  const response = responseLikeSchema.safeParse(error.context)
  if (!response.success) return undefined

  try {
    // Called on the original object: Response#json needs its own `this`.
    const body: unknown = await response.data.json.call(error.context)
    const parsed = errorBodySchema.safeParse(body)
    return parsed.success ? parsed.data.error : undefined
  } catch (cause) {
    // Not JSON: the function did not answer with its own error shape.
    console.warn('Route function answered an error without a JSON body', cause)
    return undefined
  }
}

export const routeRepository = {
  /**
   * Route from the user to a shop, through the `route` Edge Function — the
   * routing provider's key lives there, never in the app (ADR-0007).
   * `signal` cancels the request when the query is no longer wanted.
   */
  async between(
    from: Coordinates,
    to: Coordinates,
    mode: TravelMode,
    signal?: AbortSignal,
  ): Promise<Route> {
    const { data, error } = await supabase.functions.invoke('route', {
      body: {
        from: { lat: from.latitude, lng: from.longitude },
        to: { lat: to.latitude, lng: to.longitude },
        mode,
      },
      signal,
      timeout: REQUEST_TIMEOUT_MS,
    })
    if (error) throw new RouteError(await errorCode(error), error)

    return routeSchema.parse(data)
  },
}
