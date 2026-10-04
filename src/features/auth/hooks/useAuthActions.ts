import { useMutation } from '@tanstack/react-query'

import { authRepository } from '../api/auth-repository'
import type { SignInCredentials, SignUpCredentials } from '../model/credentials'

/**
 * Auth goes to the network or fails: `networkMode: 'always'` overrides the
 * app-wide 'offlineFirst', which would otherwise park a sign-in as paused
 * while offline and leave the button spinning with no explanation.
 */

export function useSignIn() {
  return useMutation({
    mutationFn: (credentials: SignInCredentials) => authRepository.signIn(credentials),
    networkMode: 'always',
    retry: false,
  })
}

export function useSignUp() {
  return useMutation({
    mutationFn: (credentials: SignUpCredentials) => authRepository.signUp(credentials),
    networkMode: 'always',
    retry: false,
  })
}

/**
 * The cache is not cleared here: Supabase emits SIGNED_OUT even when the
 * server call fails (the local session is dropped regardless), and
 * `useSessionListener` clears on that event — the same path an expired or
 * revoked session takes (08-security.md, "Logout borra todo").
 */
export function useSignOut() {
  return useMutation({
    mutationFn: () => authRepository.signOut(),
    networkMode: 'always',
    retry: false,
    // The account screen has already navigated away, so nothing on screen can
    // show this; it is logged instead of lost. Local sign-out rarely fails.
    onError: (cause) => console.warn('Sign-out failed', cause),
  })
}
