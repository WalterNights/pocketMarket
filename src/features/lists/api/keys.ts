/**
 * Query key factory (03-patterns.md). Saving or deleting a list invalidates
 * `listKeys.all`: the summary, the detail and the per-store totals all move.
 */
export const listKeys = {
  all: ['lists'] as const,
  summaries: () => [...listKeys.all, 'summaries'] as const,
  detail: (id: string) => [...listKeys.all, 'detail', id] as const,
  totals: (id: string) => [...listKeys.all, 'totals', id] as const,
}
