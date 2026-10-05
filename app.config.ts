import type { ExpoConfig } from 'expo/config'

/**
 * Expo configuration. With CNG the native projects are generated from this file,
 * so `ios/` and `android/` are never edited by hand (ADR-0001).
 */
const config: ExpoConfig = {
  name: 'Pocket Market',
  slug: 'pocket-market',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'pocketmarket',
  userInterfaceStyle: 'automatic',
  // The Pocket Market mark. icon, adaptive-icon and both splash images are
  // generated from assets/Poket_Market_logo_001.png; changing any of them needs
  // a new build, not an OTA update.
  icon: './assets/icon.png',
  // No newArchEnabled flag: the New Architecture is mandatory from SDK 55 on,
  // so the option no longer exists.

  // Warm off-white, matching --background. Prevents a white flash on cold start
  // in dark mode (docs/design/00-visual-direction.md).
  backgroundColor: '#FAF8F3',

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.walternights.pocketmarket',
  },

  android: {
    package: 'com.walternights.pocketmarket',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FAF8F3',
    },
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    // Local notifications only: no push, no APNs/FCM credentials
    // (docs/domain/03-reminders.md).
    'expo-notifications',
    [
      'expo-location',
      {
        // Shown by iOS when asking. It must describe the real use (08-security.md).
        locationWhenInUsePermission:
          'Pocket Market usa tu ubicación solo para mostrarte las tiendas cercanas. No la guarda.',
        // "Which shop is near me" needs a point, never a track.
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    // Map engine for the shops map. Keyless: tiles come from OpenFreeMap
    // (ADR-0006). The location permission text lives in expo-location above.
    '@maplibre/maplibre-react-native',
    [
      'expo-splash-screen',
      {
        // The image is required on Android: without it the generated theme
        // points at a drawable that is never created and resource linking
        // fails (BUILD-001). The dark variant is a light glyph, or it would
        // vanish on the dark background.
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#FAF8F3',
        dark: { image: './assets/splash-icon-dark.png', backgroundColor: '#141311' },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  // Links this project to its EAS project, @walternights/pocket-market on expo.dev.
  // Not a secret: it identifies the project, it does not grant access to it.
  extra: {
    eas: {
      projectId: '01f3c639-bbe5-4c4c-98ef-a0cd2b3d20e0',
    },
  },

  // Fingerprint policy: changing a native dependency changes the runtime version,
  // so an OTA update can never reach a binary that lacks the native module.
  // That mismatch is the most expensive failure in this stack (10-release.md).
  runtimeVersion: {
    policy: 'fingerprint',
  },
}

export default config
