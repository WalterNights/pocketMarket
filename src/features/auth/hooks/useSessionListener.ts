import { useEffect } from 'react'
import { AppState } from 'react-native'

import { authRepository } from '../api/auth-repository'
import { toSessionUser } from '../model/session'
import { useSessionStore } from '../store/session-store'

type SessionListenerOptions = {
  /**
   * Runs once each time a signed-in user stops being the current user: sign-out
   * from the button, a revoked or expired refresh token, an unreadable session,
   * or a different account taking its place. The root layout clears the query
   * cache here, so the next person on this phone never sees the previous one's
   * lists (08-security.md, "Logout borra todo"). Must be stable across renders.
   */
  onSignedOut: () => void
}

/**
 * Keeps the session store in step with Supabase for the life of the app.
 * Mounted once, in the root layout.
 *
 * Nothing inside the auth callback awaits another Supabase call: the SDK holds
 * a lock while it runs, and awaiting there deadlocks the client.
 */
export function useSessionListener({ onSignedOut }: SessionListenerOptions): void {
  useEffect(() => {
    const { setSignedIn, setSignedOut } = useSessionStore.getState()

    // One place for every way a session can end. Reading the previous state
    // here, not in each caller, is what makes the cleanup impossible to miss.
    const endSession = () => {
      const wasSignedIn = useSessionStore.getState().status === 'signed-in'
      setSignedOut()
      if (wasSignedIn) onSignedOut()
    }

    const unsubscribe = authRepository.onChange((_event, session) => {
      if (session === null) {
        endSession()
        return
      }

      try {
        const user = toSessionUser(session.user)
        const previous = useSessionStore.getState().user
        // Another account replaced this one without a SIGNED_OUT in between:
        // the cache still belongs to the previous user.
        if (previous !== null && previous.id !== user.id) onSignedOut()
        setSignedIn(user)
      } catch (cause) {
        // A user object we cannot read is treated as no session: better to
        // ask for sign-in again than to run with an identity we do not trust.
        console.warn('Session has an unexpected shape; treating it as signed out', cause)
        endSession()
        // Also drop it from SecureStore, or it is restored — and rejected —
        // on every launch. Deferred because this callback runs inside the
        // SDK's auth lock and signOut needs that same lock (see above).
        setTimeout(() => {
          authRepository.signOut().catch((signOutCause: unknown) => {
            console.warn('Could not drop the unreadable session', signOutCause)
          })
        }, 0)
      }
    })

    authRepository.setAutoRefresh(AppState.currentState === 'active')
    const appState = AppState.addEventListener('change', (state) =>
      authRepository.setAutoRefresh(state === 'active'),
    )

    return () => {
      unsubscribe()
      appState.remove()
    }
  }, [onSignedOut])
}
