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
      displayName: 'components',
      preset: 'jest-expo',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      testMatch: ['<rootDir>/src/**/components/**/*.test.tsx'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transformIgnorePatterns: [`node_modules/(?!${RN_PACKAGES})`],
    },
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/shared/types/**'],
}
