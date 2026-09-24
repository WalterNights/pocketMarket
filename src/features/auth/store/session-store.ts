import { create } from 'zustand'

import type { SessionStatus, SessionUser } from '../model/session'

/**
 * Who is signed in, mirrored from Supabase's auth events.
 *
 * Not persisted on purpose: Supabase already persists the session itself (in
 * SecureStore), and a second copy here could only drift from it. This store
 * starts at `loading` on every launch and `useSessionListener` fills it.
 */
type SessionState = {
  status: SessionStatus
  user: SessionUser | null
  setSignedIn: (user: SessionUser) => void
  setSignedOut: () => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  status: 'loading',
  user: null,
  setSignedIn: (user) => set({ status: 'signed-in', user }),
  setSignedOut: () => set({ status: 'signed-out', user: null }),
}))

export const selectStatus = (state: SessionState): SessionStatus => state.status
export const selectUser = (state: SessionState): SessionUser | null => state.user
