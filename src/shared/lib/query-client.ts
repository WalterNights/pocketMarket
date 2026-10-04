import { QueryClient } from '@tanstack/react-query'

import { isNonRetryableError } from '@/shared/utils/error-classification'

const ONE_MINUTE = 60_000
const ONE_DAY = 24 * 60 * ONE_MINUTE
const MAX_QUERY_RETRIES = 3
const MAX_MUTATION_RETRIES = 2

/**
 * Deliberately different from a web setup (see 04-state-and-data.md):
 *
 * - High staleTime: on mobile every refetch costs battery and the user's data plan.
 * - Long gcTime: keeps results in memory across screens for the whole session.
 *   Nothing survives a restart yet — the MMKV persister is NOT wired, so the
 *   cache is in-memory only and a cold start without network shows nothing.
 * - networkMode 'offlineFirst': without it, queries with no connection sit in
 *   `pending` forever instead of serving what is cached.
 * - refetchOnWindowFocus off: the correct concept on mobile is foreground/background.
 *   AppState feeds focusManager from `shared/lib/query-lifecycle.ts`, mounted
 *   once in `app/_layout.tsx`.
 * - Retry only what can change: an error that classifies itself as a client
 *   error (not found, denied by RLS, invalid response) fails the same way on
 *   every attempt, so it surfaces at once instead of after three backoffs.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: ONE_MINUTE,
      gcTime: ONE_DAY,
      retry: (failureCount, error) =>
        !isNonRetryableError(error) && failureCount < MAX_QUERY_RETRIES,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: (failureCount, error) =>
        !isNonRetryableError(error) && failureCount < MAX_MUTATION_RETRIES,
    },
  },
})
