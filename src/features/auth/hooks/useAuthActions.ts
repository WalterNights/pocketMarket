import { useMutation, useQueryClient } from '@tanstack/react-query'

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
 * Signing out forgets everything cached for this user. Without `clear()` the
 * next person to sign in on this phone would see the previous one's lists
 * until each query happened to refetch (08-security.md, "Logout borra todo").
 */
export function useSignOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => authRepository.signOut(),
    networkMode: 'always',
    retry: false,
    // The account screen has already navigated away, so nothing on screen can
    // show this; it is logged instead of lost. Local sign-out rarely fails.
    onError: (cause) => console.warn('Sign-out failed', cause),
    onSettled: () => queryClient.clear(),
  })
}
