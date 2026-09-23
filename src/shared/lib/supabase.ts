import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

import { env } from '@/shared/config/env'
import type { Database } from '@/shared/types/database.types'

/**
 * Session tokens go in the Keychain / Keystore, never in plain storage where a
 * rooted device or a backup could read them (08-security.md).
 *
 * SecureStore has a practical size limit per entry, so this holds the session
 * token and nothing else.
 */
const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
}

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
