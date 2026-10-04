import { useCallback, useEffect, useRef, useState } from 'react'

import { location, type LocationPermission } from '@/shared/lib/location'

import { CITY_CENTRES, type Coordinates } from '../model/branch'

export type MapOrigin =
  { kind: 'device'; coords: Coordinates } | { kind: 'city'; code: string; coords: Coordinates }

type OriginState = {
  permission: LocationPermission | 'checking'
  origin: MapOrigin | null
  locating: boolean
  /** The phone could not produce a position (location services off, timeout). */
  locateFailed: boolean
}

/**
 * Where to search from. Lives with the map screen and dies with it: the
 * position is never stored (plan 0001, "Proceso matado").
 *
 * If permission was already granted, the position is read on open — no prompt
 * is shown for something the user already allowed. Otherwise nothing happens
 * until they tap "Usar mi ubicación", and choosing a city is always available.
 */
export function useMapOrigin() {
  const [state, setState] = useState<OriginState>({
    permission: 'checking',
    origin: null,
    locating: false,
    locateFailed: false,
  })

  // Every locate and every city choice takes a new id; a reading that comes
  // back after a newer choice is stale and is dropped.
  const requestId = useRef(0)

  /** Resolves true only if this reading became the origin. */
  const locate = useCallback(async (): Promise<boolean> => {
    const id = ++requestId.current
    setState((s) => ({ ...s, locating: true, locateFailed: false }))
    try {
      const coords = await location.current()
      if (id !== requestId.current) return false
      setState((s) => ({ ...s, locating: false, origin: { kind: 'device', coords } }))
      return true
    } catch (cause) {
      console.warn('Could not read the device position', cause)
      if (id !== requestId.current) return false
      setState((s) => ({ ...s, locating: false, locateFailed: true }))
      return false
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const startedAt = requestId.current

    void location.permission().then((permission) => {
      if (cancelled) return
      setState((s) => ({ ...s, permission }))
      // Not if the user already chose something while the check ran.
      if (permission === 'granted' && requestId.current === startedAt) void locate()
    })

    return () => {
      cancelled = true
    }
  }, [locate])

  /**
   * The user's own tap: the only place the OS prompt may appear. Resolves
   * true when the device position is now the origin; false on denial,
   * failure, or when a city was chosen meanwhile.
   */
  const locateMe = useCallback(async (): Promise<boolean> => {
    const permission = await location.request()
    setState((s) => ({ ...s, permission }))
    return permission === 'granted' ? locate() : false
  }, [locate])

  const chooseCity = useCallback((code: string) => {
    const city = CITY_CENTRES[code]
    if (city === undefined) return
    requestId.current += 1
    setState((s) => ({
      ...s,
      locating: false,
      locateFailed: false,
      origin: {
        kind: 'city',
        code,
        coords: { latitude: city.latitude, longitude: city.longitude },
      },
    }))
  }, [])

  return {
    ...state,
    locateMe,
    chooseCity,
    openSettings: location.openSettings,
  }
}
