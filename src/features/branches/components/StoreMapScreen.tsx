import { lazy, Suspense, type ComponentType } from 'react'
import { TurboModuleRegistry } from 'react-native'

import { NotFound } from '@/shared/ui/NotFound'

/**
 * Native module MapLibre needs first. If the installed binary lacks it (Expo
 * Go, or a build made before the map existed), requiring MapLibre throws at
 * import time (EXPO-004).
 */
const MAPLIBRE_NATIVE_MODULE = 'MLRNCameraModule'

/**
 * The map implementation, required lazily the first time this screen renders,
 * never at import time. A static import put MapLibre in the evaluation chain of
 * the home screen (via the feature's index) and a binary without it took the
 * whole app down; now only opening the map can fail, and it fails gracefully.
 */
function loadStoreMap(): ComponentType {
  if (TurboModuleRegistry.get(MAPLIBRE_NATIVE_MODULE) === null) {
    console.warn(`${MAPLIBRE_NATIVE_MODULE} is not in this binary; the map is unavailable`)
    return MapUnavailable
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy on purpose: a static import throws when MapLibre is not in the binary (see above)
    const module: typeof import('./StoreMap') = require('./StoreMap')
    return module.StoreMap
  } catch (cause) {
    console.warn('The map could not be loaded', cause)
    return MapUnavailable
  }
}

/** React.lazy runs the loader once, on first render, and caches the result. */
const LazyStoreMap = lazy(async () => ({ default: loadStoreMap() }))

function MapUnavailable() {
  return (
    <NotFound
      title="El mapa no está disponible"
      message="Esta versión de la app no incluye el mapa. Instala la versión más reciente para verlo."
    />
  )
}

/**
 * Nearest shops on a map (StoreMap), or a way back when this build of the app
 * cannot draw maps.
 */
export function StoreMapScreen() {
  return (
    <Suspense fallback={null}>
      <LazyStoreMap />
    </Suspense>
  )
}
