import type { RouteProgress } from './navigation'
import { routeErrorMessage, type RouteErrorCode } from './route'

/** What the navigation panel shows. Pure: decided from the trip's state. */
export type NavigationView =
  | { kind: 'loading' }
  /** No route to draw at all; the panel offers to try again. */
  | { kind: 'error'; message: string }
  | {
      kind: 'following'
      remainingM: number
      remainingS: number
      /** A newer route is being fetched; the previous one is still drawn. */
      rerouting: boolean
      /** The last reroute failed; the previous route is still followed. */
      failure: string | null
    }
  | { kind: 'arrived' }

export type NavigationState = {
  arrived: boolean
  /** The last good route of this trip, if any — kept across a failed reroute. */
  route: { distanceM: number; durationS: number } | undefined
  progress: Pick<RouteProgress, 'remainingM' | 'remainingS'> | null
  rerouting: boolean
  /** The latest request failed, with the function's code when known. */
  failure: { code: RouteErrorCode | undefined } | null
}

/**
 * Arrival wins over everything: it is measured against the shop, not the
 * route. A failed request only becomes an error screen when there is no
 * earlier route to keep following.
 */
export function navigationView(state: NavigationState): NavigationView {
  if (state.arrived) return { kind: 'arrived' }

  if (state.route === undefined) {
    return state.failure
      ? { kind: 'error', message: routeErrorMessage(state.failure.code) }
      : { kind: 'loading' }
  }

  return {
    kind: 'following',
    remainingM: state.progress?.remainingM ?? state.route.distanceM,
    remainingS: state.progress?.remainingS ?? state.route.durationS,
    rerouting: state.rerouting,
    failure: state.failure ? routeErrorMessage(state.failure.code) : null,
  }
}
