import * as SplashScreen from 'expo-splash-screen'
import { useEffect, useState } from 'react'

/**
 * Holds the native splash until the app has something real to show.
 *
 * `expo-splash-screen` was installed and configured but never controlled, so
 * the splash hid on the very first frame — before any provider had mounted.
 * The result was the cream splash blinking straight into an empty screen.
 *
 * Everything the app must have before its first screen belongs here: today
 * that is the provider tree, and it is where session restore and the
 * persisted query cache will plug in (04-state-and-data.md). Both read from
 * storage asynchronously, and without a gate the user sees a flash of the
 * logged-out app on every cold start.
 */

// Module scope on purpose: this has to run before the first render, and a
// rejection is harmless — it only means the splash was already gone.
void SplashScreen.preventAutoHideAsync().catch(() => undefined)

export function useAppBoot(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function boot(): Promise<void> {
      // Nothing else to await yet. Awaiting the ones that come later goes
      // here, so the splash covers them instead of the user watching them.
      if (cancelled) return

      setReady(true)

      try {
        await SplashScreen.hideAsync()
      } catch (cause) {
        // Not swallowed: if this fails the splash stays up and the app is
        // stuck behind an image with no way out, which looks like a freeze.
        console.warn('No se pudo ocultar el splash nativo', cause)
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
