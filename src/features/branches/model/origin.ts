import { CITY_CENTRES, type Coordinates } from './branch'

/**
 * Where to search for shops from: the phone's position, or a city the user
 * chose. Shared by the map and the home store list (plan 0003). Pure: no
 * React, no storage, no location API (rule 3).
 */
export type MapOrigin =
  { kind: 'device'; coords: Coordinates } | { kind: 'city'; code: string; coords: Coordinates }

/**
 * The only part of the origin that survives a restart: the city code. The
 * position never does — where someone is is sensitive and the app does not
 * need it tomorrow (plan 0001, 08-security).
 */
export type PersistedOrigin = {
  cityCode: string | null
}

export const ORIGIN_STORAGE_VERSION = 1

/** A city origin, or null when the code is not one we know (renamed, removed). */
export function cityOrigin(code: string | null): MapOrigin | null {
  if (code === null) return null
  const city = CITY_CENTRES[code]
  if (city === undefined) return null
  return { kind: 'city', code, coords: { latitude: city.latitude, longitude: city.longitude } }
}

/** What `activate()` knows when it decides whether to read the position. */
export type ActivationContext = {
  /** Location permission is already granted. The store never prompts. */
  permissionGranted: boolean
  /** First activation of the process. */
  atLaunch: boolean
  /** The user asked for every chain ("Ver todas") in this session. */
  showingAll: boolean
  /** The user picked a city, located or cleared while permission was checked. */
  choseMeanwhile: boolean
  origin: MapOrigin | null
}

/**
 * Whether opening a screen that uses the origin should read the device
 * position on its own, without the user asking.
 *
 * - Never without permission: reading it would prompt.
 * - Never over a choice the user made: something they tapped while the check
 *   ran, a city chosen in this session, or "Ver todas". Without that last one
 *   the home list re-filtered by itself the next time the map opened.
 * - At launch the device wins over a *remembered* city: that one is a guess
 *   about today, not a choice made today.
 */
export function shouldLocateOnActivate(context: ActivationContext): boolean {
  if (!context.permissionGranted) return false
  if (context.choseMeanwhile) return false
  if (context.showingAll) return false
  if (!context.atLaunch && context.origin?.kind === 'city') return false
  return true
}

/** "Cerca de ti" / "Cerca de Bogotá": what the store list says it is showing. */
export function originLabel(origin: MapOrigin): string {
  if (origin.kind === 'device') return 'Cerca de ti'
  return `Cerca de ${CITY_CENTRES[origin.code]?.name ?? 'la ciudad elegida'}`
}

/**
 * Upgrades whatever an older version of the app stored. Anything unreadable
 * becomes "no city": the user picks again, which beats a crash at launch that
 * they could not get past (known-issues, Zustand).
 */
export function migrateOrigin(persisted: unknown): PersistedOrigin {
  if (typeof persisted !== 'object' || persisted === null || !('cityCode' in persisted)) {
    return { cityCode: null }
  }
  const { cityCode } = persisted
  return { cityCode: typeof cityCode === 'string' && cityCode in CITY_CENTRES ? cityCode : null }
}
