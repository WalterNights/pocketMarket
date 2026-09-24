import { useEffect } from 'react'
import { AppState } from 'react-native'

import { authRepository } from '../api/auth-repository'
import { toSessionUser } from '../model/session'
import { useSessionStore } from '../store/session-store'

/**
 * Keeps the session store in step with Supabase for the life of the app.
 * Mounted once, in the root layout.
 *
 * Nothing inside the auth callback awaits another Supabase call: the SDK holds
 * a lock while it runs, and awaiting there deadlocks the client.
 */
export function useSessionListener(): void {
  useEffect(() => {
    const { setSignedIn, setSignedOut } = useSessionStore.getState()

    const unsubscribe = authRepository.onChange((_event, session) => {
      if (session === null) {
        setSignedOut()
        return
      }

      try {
        setSignedIn(toSessionUser(session.user))
      } catch (cause) {
        // A user object we cannot read is treated as no session: better to
        // ask for sign-in again than to run with an identity we do not trust.
        console.warn('Sesión con forma inesperada; se trata como cerrada', cause)
        setSignedOut()
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
  }, [])
}
