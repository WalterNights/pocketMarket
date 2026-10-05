import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { location } from '@/shared/lib/location'

import { useOriginStore } from '../store/origin-store'

export type { MapOrigin } from '../model/origin'

/**
 * Where the map searches from. The origin itself lives in the shared origin
 * store, so the map and the home list agree (plan 0003); the position is never
 * stored, only a chosen city code.
 *
 * If permission was already granted, the position is read on open — no prompt
 * is shown for something the user already allowed. Otherwise nothing happens
 * until they tap "Usar mi ubicación", and choosing a city is always available.
 */
export function useMapOrigin() {
  const state = useOriginStore(
    useShallow((s) => ({
      permission: s.permission,
      origin: s.origin,
      locating: s.locating,
      locateFailed: s.locateFailed,
      locateMe: s.locateMe,
      chooseCity: s.chooseCity,
    })),
  )
  const activate = useOriginStore((s) => s.activate)

  useEffect(() => {
    void activate()
  }, [activate])

  return { ...state, openSettings: location.openSettings }
}
