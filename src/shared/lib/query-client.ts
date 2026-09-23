import { QueryClient } from '@tanstack/react-query'

const ONE_MINUTE = 60_000
const ONE_DAY = 24 * 60 * ONE_MINUTE

/**
 * Deliberately different from a web setup (see 04-state-and-data.md):
 *
 * - High staleTime: on mobile every refetch costs battery and the user's data plan.
 * - Long gcTime: the persisted cache is what lets the app open something offline.
 * - networkMode 'offlineFirst': without it, queries with no connection sit in
 *   `pending` forever instead of serving what is cached.
 * - refetchOnWindowFocus off: the correct concept on mobile is foreground/background,
 *   driven by AppState through focusManager, not window focus.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: ONE_MINUTE,
      gcTime: ONE_DAY,
      retry: (failureCount) => failureCount < 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 2,
    },
  },
})
