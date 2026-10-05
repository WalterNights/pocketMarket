import X from 'lucide-react-native/icons/x'
import { useCallback } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useShallow } from 'zustand/react/shallow'

import { location } from '@/shared/lib/location'

import { useOriginStore } from '../store/origin-store'
import { OriginPicker } from './OriginPicker'

const FOREGROUND = '#1F1D1B'

/**
 * The map's origin picker, in a sheet over the home store list (plan 0003).
 * Same choices and same shared origin as the map: picking here also moves the
 * map, and the other way round. Open it with `useShoppingOrigin().openPicker`.
 *
 * In place rather than a jump to the map: the user is choosing which shops the
 * list shows, and the map would load MapLibre and leave the list behind.
 */
export function OriginPickerSheet() {
  const insets = useSafeAreaInsets()
  const state = useOriginStore(
    useShallow((s) => ({
      pickerOpen: s.pickerOpen,
      permission: s.permission,
      origin: s.origin,
      locating: s.locating,
      locateFailed: s.locateFailed,
      locateMe: s.locateMe,
      chooseCity: s.chooseCity,
      clear: s.clear,
      closePicker: s.closePicker,
    })),
  )
  const { locateMe: requestDeviceOrigin, chooseCity: chooseCityOrigin, clear, closePicker } = state

  // Closes only once the device position is really the origin; on denial or
  // failure it stays open with its explanation, as on the map.
  const locateMe = useCallback(async () => {
    if (await requestDeviceOrigin()) closePicker()
  }, [requestDeviceOrigin, closePicker])

  const chooseCity = useCallback(
    (code: string) => {
      chooseCityOrigin(code)
      closePicker()
    },
    [chooseCityOrigin, closePicker],
  )

  const showAll = useCallback(() => {
    clear()
    closePicker()
  }, [clear, closePicker])

  return (
    <Modal
      visible={state.pickerOpen}
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={closePicker}
    >
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
          <Text className="flex-1 text-xl font-semibold text-foreground" accessibilityRole="header">
            ¿Desde dónde buscamos?
          </Text>
          <Pressable
            onPress={closePicker}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            className="h-11 w-11 items-center justify-center rounded-md active:bg-muted"
          >
            <X size={22} color={FOREGROUND} strokeWidth={1.75} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          <Text className="px-4 text-base text-foreground">
            Te mostramos las cadenas que tienen una tienda cerca.
          </Text>
          <OriginPicker
            permission={state.permission}
            locating={state.locating}
            locateFailed={state.locateFailed}
            selectedCity={state.origin?.kind === 'city' ? state.origin.code : null}
            onLocateMe={() => void locateMe()}
            onChooseCity={chooseCity}
            onOpenSettings={() => void location.openSettings()}
          />

          {state.origin ? (
            <Pressable
              onPress={showAll}
              accessibilityRole="button"
              hitSlop={8}
              className="mx-4 h-11 justify-center self-start"
            >
              <Text className="text-sm font-medium text-foreground underline">
                Ver todas las tiendas
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}
