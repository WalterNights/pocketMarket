/**
 * Public API of the auth feature.
 *
 * This is the one feature others may depend on (01-overview.md, "¿Y si dos
 * features necesitan lo mismo?", option 2): lists needs to know who owns them.
 * Auth itself depends on no feature.
 */
export { AccountButton } from './components/AccountButton'
export { AccountScreen } from './components/AccountScreen'
export { SignInScreen } from './components/SignInScreen'
export { SignUpScreen } from './components/SignUpScreen'
export { useSessionListener } from './hooks/useSessionListener'
export { useSignOut } from './hooks/useAuthActions'
export { safeRedirect } from './model/credentials'
export type { SessionStatus, SessionUser } from './model/session'
export { useSessionStore, selectStatus, selectUser } from './store/session-store'
