import type { MMKV } from 'react-native-mmkv'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

import { location, type LocationPermission } from '@/shared/lib/location'

import {
  cityOrigin,
  migrateOrigin,
  ORIGIN_STORAGE_VERSION,
  shouldLocateOnActivate,
  type MapOrigin,
  type PersistedOrigin,
} from '../model/origin'

/**
 * Where to search for shops from, shared by the map and the home store list
 * (plan 0003). Survives leaving the map; only the chosen city code survives a
 * restart (MMKV). The device position lives in memory and is re-read on open,
 * and only if permission was already granted — this store never prompts.
 *
 * "Ver todas" is a choice too, and it has to hold with permission granted:
 * `showingAll` stops `activate()` from locating again behind the user's back.
 * One store serves both screens, so the map does not get an origin of its own
 * after "Ver todas": it opens on its picker (it already does whenever the
 * origin is null), and what the user picks there is an explicit choice that
 * moves the home list as well. A map that located silently would flip the list
 * back, which is exactly what the flag prevents.
 *
 * The flag is in memory only. A fresh launch starts as before: the device
 * position if permission is granted, otherwise every chain (`clear()` also
 * forgot the city).
 */
type OriginState = PersistedOrigin & {
  permission: LocationPermission | 'checking'
  origin: MapOrigin | null
  locating: boolean
  /** The phone could not produce a position (location services off, timeout). */
  locateFailed: boolean
  /**
   * The user asked for every chain in this session. Set by `clear()`, reset by
   * `chooseCity()` and `locateMe()`. Never persisted.
   */
  showingAll: boolean
  /** The home list's origin sheet is showing. */
  pickerOpen: boolean

  /**
   * Called when a screen that uses the origin opens. Reads the device position
   * if permission is already granted. At launch it wins over a remembered city;
   * later it refreshes a device origin but never overrides a city the user
   * chose in this session, nor "Ver todas" (`shouldLocateOnActivate`).
   */
  activate: () => Promise<void>
  /** The user's own tap: the only place the OS prompt may appear. */
  locateMe: () => Promise<boolean>
  chooseCity: (code: string) => void
  /**
   * Back to "all chains": forgets the city, drops the position, and keeps it
   * that way until the user picks an origin again or the app restarts.
   */
  clear: () => void
  openPicker: () => void
  closePicker: () => void
}

const STORAGE_ID = 'branches.origin'

/**
 * MMKV behind zustand's StateStorage, required lazily: the native module is
 * missing in Expo Go and in builds older than this feature, and a throwing
 * import in the home screen's chain takes the whole app down (EXPO-003,
 * EXPO-004). Without it the city simply is not remembered.
 */
function mmkvStorage(): StateStorage {
  let mmkv: MMKV | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose: the import throws when the native module is not in the binary (see above)
    const module: typeof import('react-native-mmkv') = require('react-native-mmkv')
    mmkv = module.createMMKV({ id: STORAGE_ID })
  } catch (cause) {
    console.warn('MMKV is not available; the chosen city will not be remembered', cause)
  }

  return {
    getItem: (name) => mmkv?.getString(name) ?? null,
    setItem: (name, value) => mmkv?.set(name, value),
    removeItem: (name) => {
      mmkv?.remove(name)
    },
  }
}

// Every locate, city choice and clear takes a new id; a reading that comes back
// after a newer choice is stale and is dropped.
let requestId = 0
// The first activate() of the process is the launch: there the device wins
// over a remembered city.
let launched = false

export const useOriginStore = create<OriginState>()(
  persist(
    (set, get) => {
      /** Resolves true only if this reading became the origin. */
      const locate = async (): Promise<boolean> => {
        const id = ++requestId
        set({ locating: true, locateFailed: false })
        try {
          const coords = await location.current()
          if (id !== requestId) return false
          set({ locating: false, origin: { kind: 'device', coords } })
          return true
        } catch (cause) {
          console.warn('Could not read the device position', cause)
          if (id !== requestId) return false
          set({ locating: false, locateFailed: true })
          return false
        }
      }

      return {
        cityCode: null,
        permission: 'checking',
        origin: null,
        locating: false,
        locateFailed: false,
        showingAll: false,
        pickerOpen: false,

        activate: async () => {
          const atLaunch = !launched
          launched = true
          const startedAt = requestId

          const permission = await location.permission()
          set({ permission })
          const { origin, showingAll } = get()
          const shouldLocate = shouldLocateOnActivate({
            permissionGranted: permission === 'granted',
            atLaunch,
            showingAll,
            choseMeanwhile: requestId !== startedAt,
            origin,
          })
          if (shouldLocate) await locate()
        },

        locateMe: async () => {
          // The tap itself ends "Ver todas", even if the reading then fails.
          set({ showingAll: false })
          const permission = await location.request()
          set({ permission })
          return permission === 'granted' ? locate() : false
        },

        chooseCity: (code) => {
          const origin = cityOrigin(code)
          if (origin === null) return
          requestId += 1
          set({
            origin,
            cityCode: code,
            locating: false,
            locateFailed: false,
            showingAll: false,
          })
        },

        clear: () => {
          requestId += 1
          set({
            origin: null,
            cityCode: null,
            locating: false,
            locateFailed: false,
            showingAll: true,
          })
        },

        openPicker: () => set({ pickerOpen: true }),
        closePicker: () => set({ pickerOpen: false }),
      }
    },
    {
      name: 'origin',
      storage: createJSONStorage(mmkvStorage),
      version: ORIGIN_STORAGE_VERSION,
      // Only the city code. Never the position (plan 0003, 08-security).
      partialize: (state): PersistedOrigin => ({ cityCode: state.cityCode }),
      migrate: (persisted) => migrateOrigin(persisted),
      // A remembered city is the starting origin until the device answers.
      merge: (persisted, current) => {
        const { cityCode } = migrateOrigin(persisted)
        return { ...current, cityCode, origin: current.origin ?? cityOrigin(cityCode) }
      },
    },
  ),
)
