/**
 * Public API of the branches feature: where each chain's shops are.
 *
 * Depends on no other feature. The chain's name and whether it has prices come
 * resolved from the `nearest_branches` query, so this feature never imports
 * `catalog` (rule 1, plan 0001).
 */
export { MapButton } from './components/MapButton'
export { StoreMapScreen } from './components/StoreMapScreen'
