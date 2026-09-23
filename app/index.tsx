import { CatalogScreen } from '@/features/catalog'

/**
 * Route: composition only. Translates navigation into a feature component
 * and nothing else (rule 2 in CLAUDE.md).
 */
export default function HomeRoute() {
  return <CatalogScreen />
}
