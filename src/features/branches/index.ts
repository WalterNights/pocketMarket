/**
 * Public API of the branches feature: where each chain's shops are, and where
 * the user is searching from.
 *
 * Depends on no other feature. The chain's name and whether it has prices come
 * resolved from the `nearest_branches` query, so this feature never imports
 * `catalog` (rule 1, plan 0001). The home list gets the origin through the
 * route, which composes `useShoppingOrigin` into `catalog` (plan 0003).
 */
export { MapButton } from './components/MapButton'
export { OriginPickerSheet } from './components/OriginPickerSheet'
export { StoreMapScreen } from './components/StoreMapScreen'
export { useShoppingOrigin } from './hooks/useShoppingOrigin'
export type { ShoppingOrigin } from './hooks/useShoppingOrigin'
