import { useEffect, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import type { Coordinates } from '../model/branch'
import { originLabel } from '../model/origin'
import { useOriginStore } from '../store/origin-store'

export type ShoppingOrigin = {
  /** Null = no origin: the list shows every chain. */
  origin: {
    coords: Coordinates
    /** "Cerca de ti", "Cerca de Bogotá". */
    label: string
    kind: 'device' | 'city'
  } | null
  /** Opens the origin sheet (render `OriginPickerSheet` next to the list). */
  openPicker: () => void
  /** Back to every chain: forgets the chosen city. */
  clear: () => void
}

/**
 * The origin for the home store list: coordinates and a label, nothing else.
 *
 * Never asks for location permission (plan 0003, "Permisos"). On open it uses
 * the device only if permission was already granted, otherwise the remembered
 * city, otherwise nothing.
 */
export function useShoppingOrigin(): ShoppingOrigin {
  const { origin, openPicker, clear, activate } = useOriginStore(
    useShallow((s) => ({
      origin: s.origin,
      openPicker: s.openPicker,
      clear: s.clear,
      activate: s.activate,
    })),
  )

  useEffect(() => {
    void activate()
  }, [activate])

  return useMemo(
    () => ({
      origin: origin
        ? { coords: origin.coords, label: originLabel(origin), kind: origin.kind }
        : null,
      openPicker,
      clear,
    }),
    [origin, openPicker, clear],
  )
}
