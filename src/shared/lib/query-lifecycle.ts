import { focusManager } from '@tanstack/react-query'
import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

/**
 * Wires TanStack Query to the app lifecycle. Mount once, in the root layout
 * (04-state-and-data.md, "Sincronización con el ciclo de vida").
 *
 * On mobile "window focus" means "the app came back to the foreground": that
 * is when a query with `refetchOnWindowFocus: true` refetches — e.g. the
 * notification permission, which the user may have changed in Settings while
 * the app was in the background. The app-wide default keeps the flag off, so
 * only queries that opt in pay for it.
 *
 * `onlineManager` is not wired yet: it needs NetInfo, a native dependency that
 * is not installed. Until then TanStack's default (always online) applies.
 */
export function useQueryLifecycle(): void {
  useEffect(() => {
    focusManager.setEventListener((setFocused) => {
      const onChange = (state: AppStateStatus) => setFocused(state === 'active')
      const subscription = AppState.addEventListener('change', onChange)
      return () => subscription.remove()
    })
  }, [])
}
