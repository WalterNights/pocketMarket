import { View } from 'react-native'

import { StoreListScreen } from '@/features/catalog'
import { DraftListBar } from '@/features/lists'

/** Route: composition only (rule 2 in CLAUDE.md). */
export default function HomeRoute() {
  return (
    <View className="flex-1 bg-background">
      <StoreListScreen />
      <DraftListBar />
    </View>
  )
}
