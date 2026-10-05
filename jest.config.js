/**
 * Two projects, matching the testing pyramid in docs/architecture/09-testing.md.
 *
 * `model` holds the bulk of the tests: pure functions with no React and no
 * network. Running them in a plain node environment keeps them fast, which is
 * what makes a large unit suite bearable.
 *
 * `components` pays for the React Native runtime only where it is actually
 * needed — rendering.
 *
 * Note on transformIgnorePatterns: pnpm stores packages under
 * `node_modules/.pnpm/<name>@<version>/node_modules/<name>`, so the usual
 * pattern from the Expo docs never matches. `(?:\.pnpm/)?` handles both layouts.
 */

const RN_PACKAGES =
  '(?:\\.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|native-base|react-native-svg|nativewind|react-native-css-interop)'

/**
 * react-native-worklets is a dependency of Reanimated, not of this project, so
 * under pnpm it is not reachable by name from the root. Resolved from where
 * Reanimated lives, which works however Jest is launched.
 */
const WORKLETS_RESOLVER = require.resolve('react-native-worklets/jest/resolver', {
  paths: [require.resolve('react-native-reanimated/package.json')],
})

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'model',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/model/**/*.test.ts', '<rootDir>/src/shared/utils/**/*.test.ts'],
      transform: {
        '^.+\\.(ts|tsx|js|jsx)$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
    {
      displayName: 'ingestion',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/ingestion/**/*.test.ts'],
      transform: {
        '^.+\.(ts|js)$': ['babel-jest', { presets: ['babel-preset-expo'] }],
      },
    },
    {
      displayName: 'components',
      preset: 'jest-expo',
      // Reanimated's worklets load a native module from their `.native` files;
      // the library's own resolver skips those under Jest.
      resolver: WORKLETS_RESOLVER,
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      testMatch: ['<rootDir>/src/**/components/**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^lucide-react-native/icons/.*$': '<rootDir>/test/mocks/lucide-icon.js',
      },
      transformIgnorePatterns: [`node_modules/(?!${RN_PACKAGES})`],
    },
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/shared/types/**'],
}
