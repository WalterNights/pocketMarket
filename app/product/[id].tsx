import { Stack, useLocalSearchParams } from 'expo-router'

import { productIdParamSchema } from '@/features/catalog'
import { AddToListSheet } from '@/features/lists'

/**
 * Route: translates navigation params into feature props.
 *
 * Presented as a form sheet rather than a centred dialog — that is what a
 * phone user expects, and the router keeps the stack coherent so the native
 * dismiss gesture and the Android back button both do the right thing
 * (05-navigation.md).
 */
export default function ProductRoute() {
  const parsed = productIdParamSchema.safeParse(useLocalSearchParams())

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          title: '',
          headerShown: false,
          sheetAllowedDetents: [0.65, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 20,
          contentStyle: { backgroundColor: '#FAF8F3' },
        }}
      />
      {parsed.success ? <AddToListSheet productId={parsed.data.id} /> : null}
    </>
  )
}
