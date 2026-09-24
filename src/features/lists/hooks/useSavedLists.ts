import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { syncReminders } from '@/features/reminders'

import { listKeys } from '../api/keys'
import { listRepository } from '../api/list-repository'
import type { SaveListItemPayload } from '../model/saved-list'

export function useSavedLists() {
  return useQuery({
    queryKey: listKeys.summaries(),
    queryFn: ({ signal }) => listRepository.summaries(signal),
  })
}

export function useSavedList(id: string) {
  return useQuery({
    queryKey: listKeys.detail(id),
    queryFn: ({ signal }) => listRepository.byId(id, signal),
    enabled: id.length > 0,
  })
}

export function useSavedListTotals(id: string) {
  return useQuery({
    queryKey: listKeys.totals(id),
    queryFn: ({ signal }) => listRepository.totals(id, signal),
    enabled: id.length > 0,
  })
}

/**
 * Saving needs the server — the list, its prices and its totals live there —
 * so it runs now or fails now (`networkMode: 'always'`). The draft stays
 * untouched on failure; nothing the user built is lost.
 *
 * A saved list changes what its reminder says (item count, total), hence the
 * resync.
 */
export function useSaveList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { listId: string | null; name: string; items: SaveListItemPayload[] }) =>
      listRepository.save(input),
    networkMode: 'always',
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listKeys.all })
      void syncReminders()
    },
  })
}

/** The list's reminder goes with it (cascade), so its notifications must too. */
export function useDeleteList() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => listRepository.remove(id),
    networkMode: 'always',
    retry: false,
    // The detail query is NOT removed here: the detail screen is still mounted
    // while this runs, and removing its query makes it refetch a list that no
    // longer exists — a flash of "No pudimos cargar esta lista" before the
    // navigation. It is garbage-collected once the screen unmounts.
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: listKeys.summaries() })
      void syncReminders()
    },
  })
}
