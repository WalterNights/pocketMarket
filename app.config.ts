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
      backgroundColor: '#FAF8F3',
    },
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FAF8F3',
        dark: { backgroundColor: '#141311' },
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  // Fingerprint policy: changing a native dependency changes the runtime version,
  // so an OTA update can never reach a binary that lacks the native module.
  // That mismatch is the most expensive failure in this stack (10-release.md).
  runtimeVersion: {
    policy: 'fingerprint',
  },
}

export default config
