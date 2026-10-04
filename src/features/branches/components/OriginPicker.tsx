import LocateFixed from 'lucide-react-native/icons/locate-fixed'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import type { LocationPermission } from '@/shared/lib/location'

import { CITY_CENTRES } from '../model/branch'

const ON_PRIMARY = '#FAF8F3'

type OriginPickerProps = {
  permission: LocationPermission | 'checking'
  locating: boolean
  locateFailed: boolean
  selectedCity: string | null
  onLocateMe: () => void
  onChooseCity: (code: string) => void
  onOpenSettings: () => void
}

/**
 * Where to search from: the phone's position, or a city. The explanation comes
 * BEFORE the OS prompt, and choosing a city never needs any permission — the
 * map works for someone who will not share their location (plan 0001).
 */
export function OriginPicker({
  permission,
  locating,
  locateFailed,
  selectedCity,
  onLocateMe,
  onChooseCity,
  onOpenSettings,
}: OriginPickerProps) {
  const denied = permission === 'denied'

  return (
    <View className="px-4 py-3">
      {denied ? (
        <View className="mb-3">
          <Text className="text-sm text-muted-foreground">
            No tenemos permiso para ver tu ubicación. Elige una ciudad, o actívalo en Ajustes.
          </Text>
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            hitSlop={8}
            className="h-11 justify-center self-start"
          >
            <Text className="text-sm font-medium text-foreground underline">Abrir Ajustes</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable
            onPress={onLocateMe}
            disabled={locating || permission === 'checking'}
            accessibilityRole="button"
            accessibilityState={{ busy: locating }}
            className="h-12 flex-row items-center justify-center rounded-md bg-primary active:opacity-80"
          >
            {locating ? (
              <ActivityIndicator color={ON_PRIMARY} />
            ) : (
              <LocateFixed size={20} color={ON_PRIMARY} strokeWidth={1.75} />
            )}
            <Text className="ml-2 text-base font-medium text-primary-foreground">
              {locating ? 'Buscando tu ubicación…' : 'Usar mi ubicación'}
            </Text>
          </Pressable>
          <Text className="mb-3 mt-1.5 text-xs text-muted-foreground">
            Solo para encontrar las tiendas cercanas. No la guardamos.
          </Text>
        </>
      )}

      {locateFailed ? (
        <Text className="mb-3 text-sm text-destructive" accessibilityLiveRegion="polite">
          No pudimos ubicarte. Revisa que la ubicación del teléfono esté encendida, o elige una
          ciudad.
        </Text>
      ) : null}

      <Text className="mb-2 text-sm font-medium text-foreground">O elige una ciudad</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {Object.entries(CITY_CENTRES).map(([code, city]) => {
          const selected = selectedCity === code
          return (
            <Pressable
              key={code}
              onPress={() => onChooseCity(code)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              className={`h-11 justify-center rounded-md border px-3 ${
                selected ? 'border-primary bg-primary' : 'border-border bg-card active:bg-muted'
              }`}
            >
              <Text
                className={`text-sm ${
                  selected ? 'font-semibold text-primary-foreground' : 'text-foreground'
                }`}
              >
                {city.name}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}
