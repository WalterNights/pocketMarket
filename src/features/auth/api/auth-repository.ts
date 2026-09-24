import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

import { supabase } from '@/shared/lib/supabase'

import type { SignInCredentials, SignUpCredentials } from '../model/credentials'

/**
 * Carries Supabase's error code, never its message: the message is English,
 * technical, and sometimes says more than the user should hear. The UI turns
 * the code into Spanish with `authErrorMessage`.
 */
export class AuthFailure extends Error {
  readonly code: string | undefined

  constructor(code: string | undefined, options?: { cause?: unknown }) {
    super(`auth failed: ${code ?? 'unknown'}`, options)
    this.name = 'AuthFailure'
    this.code = code
  }
}

function toFailure(error: { code?: string; name?: string; status?: number }): AuthFailure {
  // No HTTP status at all means the request never reached the server.
  const code =
    error.name === 'AuthRetryableFetchError' || error.status === 0 ? 'network' : error.code
  return new AuthFailure(code, { cause: error })
}

export type SignUpResult = {
  /** True when the project requires email confirmation (production, ADR-0005). */
  needsConfirmation: boolean
}

export const authRepository = {
  async signIn({ email, password }: SignInCredentials): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw toFailure(error)
  },

  async signUp({ displayName, email, password }: SignUpCredentials): Promise<SignUpResult> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // Read by the handle_new_user trigger to fill profile.display_name.
      options: { data: { display_name: displayName } },
    })
    if (error) throw toFailure(error)

    return { needsConfirmation: data.session === null }
  },

  async signOut(): Promise<void> {
    // 'local': forget this device only. A failure here must not leave the
    // user stuck signed in, so the local session is dropped regardless.
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw toFailure(error)
  },

  /**
   * Fires once immediately with INITIAL_SESSION (the restored session or
   * null), then on every change. That first call is what ends `loading`.
   */
  onChange(listener: (event: AuthChangeEvent, session: Session | null) => void): () => void {
    const { data } = supabase.auth.onAuthStateChange(listener)
    return () => data.subscription.unsubscribe()
  },

  /**
   * Token refresh only while the app is in the foreground. A timer running in
   * the background is battery spent on a token nobody is using
   * (08-security.md).
   */
  setAutoRefresh(active: boolean): void {
    if (active) void supabase.auth.startAutoRefresh()
    else void supabase.auth.stopAutoRefresh()
  },
}
