// ESLint flat config. Enforces the dependency rule from docs/architecture/01-overview.md
// at lint time, not just in review.
const expoConfig = require('eslint-config-expo/flat')

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      'dist/**',
      'ios/**',
      'android/**',
      'src/shared/types/database.types.ts', // generated
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Rule 1: app/ -> features/ -> shared/. Never upward, never between features.
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '../../features/*'],
              message:
                'shared/ no puede importar de features/. Regla de dependencia (01-overview.md).',
            },
          ],
        },
      ],
    },
  },
  {
    // model/ is pure: no React, no network, no platform.
    files: ['src/features/*/model/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: 'model/ es puro: sin React (01-overview.md).' },
            { name: 'react-native', message: 'model/ es puro: sin React Native.' },
            { name: '@/shared/lib/supabase', message: 'model/ es puro: sin red.' },
          ],
        },
      ],
    },
  },
  {
    // Only repositories talk to Supabase.
    files: ['src/**/*.{ts,tsx}', 'app/**/*.tsx'],
    ignores: ['src/features/*/api/**', 'src/shared/lib/supabase.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/shared/lib/supabase',
              message: 'Acceso a Supabase solo desde features/*/api/ (regla 4 de CLAUDE.md).',
            },
          ],
        },
      ],
    },
  },
]
