import { View } from 'react-native'

import { AccountButton } from '@/features/auth'
import { StoreListScreen } from '@/features/catalog'
import { DraftListBar, MyListsButton } from '@/features/lists'

/** Route: composition only (rule 2 in CLAUDE.md). */
export default function HomeRoute() {
  return (
    <View className="flex-1 bg-background">
      <StoreListScreen
        headerAction={
          <View className="flex-row items-center">
            <MyListsButton />
            <AccountButton />
          </View>
        }
      />
      <DraftListBar />
    </View>
  )
}
