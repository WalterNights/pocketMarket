import * as Location from 'expo-location'
import { Linking } from 'react-native'

/**
 * Adapter over expo-location: the only file that reads where the phone is
 * (rules/react-native.md, "Específico de móvil").
 *
 * Foreground only, never background location. "Which shop is near me" needs a
 * single point (`current`). Continuous tracking (`watch`) exists for ONE case:
 * the user pressed "Iniciar" to follow a route, and it stops on arrival, on
 * "Terminar", on leaving the map or when the app goes to the background
 * (ADR-0007). Nothing is stored — where someone has been is sensitive data
 * this app does not need.
 */

export type LocationPermission = 'granted' | 'denied' | 'undetermined'

export type DevicePosition = {
  latitude: number
  longitude: number
}

/** A position this recent is still "where I am" for choosing a shop. */
const LAST_KNOWN_MAX_AGE_MS = 5 * 60_000

function toPermission(response: Location.LocationPermissionResponse): LocationPermission {
  if (response.granted) return 'granted'
  // Not asked yet, or the OS still lets us ask: it is the user's call to make.
  return response.canAskAgain ? 'undetermined' : 'denied'
}

export const location = {
  async permission(): Promise<LocationPermission> {
    return toPermission(await Location.getForegroundPermissionsAsync())
  },

  /**
   * Asks the OS. Call only from the user's own tap on "use my location":
   * asked without context it is a near-certain no, and on iOS that no is final.
   */
  async request(): Promise<LocationPermission> {
    const current = await Location.getForegroundPermissionsAsync()
    if (current.granted || !current.canAskAgain) return toPermission(current)
    return toPermission(await Location.requestForegroundPermissionsAsync())
  },

  /**
   * Where the phone is now. A recent cached fix first — instant and free —
   * and a fresh reading only if there is none. Balanced accuracy, never High:
   * High switches the GPS on, and a hundred metres does not change which shop
   * is nearest.
   */
  async current(): Promise<DevicePosition> {
    const recent = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS })
    const fix =
      recent ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))

    return { latitude: fix.coords.latitude, longitude: fix.coords.longitude }
  },

  /**
   * Follows the phone while navigating. High accuracy on purpose: following a
   * walk needs the GPS, and it is on only while the user is navigating. A new
   * fix every 5 m or 2 s, whichever comes later. Returns the stop function.
   */
  async watch(onPosition: (position: DevicePosition) => void): Promise<() => void> {
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 2000 },
      (fix) => onPosition({ latitude: fix.coords.latitude, longitude: fix.coords.longitude }),
    )
    return () => subscription.remove()
  },

  openSettings(): Promise<void> {
    return Linking.openSettings()
  },
}
