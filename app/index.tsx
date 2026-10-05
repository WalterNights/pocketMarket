import { View } from 'react-native'

import { AccountButton } from '@/features/auth'
import { MapButton, OriginPickerSheet, useShoppingOrigin } from '@/features/branches'
import { StoreListScreen } from '@/features/catalog'
import { DraftListBar, MyListsButton } from '@/features/lists'

/**
 * Route: composition only (rule 2 in CLAUDE.md). The origin belongs to
 * `branches` and reaches `catalog` as a prop, so neither feature imports the
 * other (rule 1, plan 0003).
 */
export default function HomeRoute() {
  const shopping = useShoppingOrigin()

  return (
    <View className="flex-1 bg-background">
      <StoreListScreen
        origin={shopping.origin}
        onChangeOrigin={shopping.openPicker}
        onShowAll={shopping.clear}
        headerAction={
          <View className="flex-row items-center">
            <MapButton />
            <MyListsButton />
            <AccountButton />
          </View>
        }
      />
      <DraftListBar />
      <OriginPickerSheet />
    </View>
  )
}
