import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

import { env } from '@/shared/config/env'
import type { Database } from '@/shared/types/database.types'
import { createChunkedStorage } from '@/shared/utils/chunked-storage'

/**
 * Session tokens go in the Keychain / Keystore, never in plain storage where a
 * rooted device or a backup could read them (08-security.md).
 *
 * The session (2.2 KB) does not fit in one SecureStore value (~2 KB), so it is
 * split across several — all of them still in SecureStore (ADR-0005).
 */
const secureStorage = createChunkedStorage({
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
})

/**
 * Single Supabase client. Nothing outside `features/*_/api/` may import this
 * module — enforced by ESLint, see eslint.config.js.
 *
 * This app is mobile only, so there is no web storage fallback and no URL
 * session detection.
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
