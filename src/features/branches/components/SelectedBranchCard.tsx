import Car from 'lucide-react-native/icons/car'
import Footprints from 'lucide-react-native/icons/footprints'
import X from 'lucide-react-native/icons/x'
import { Pressable, Text, View } from 'react-native'

import { distanceLabel, type Branch } from '../model/branch'
import { MODE_LABELS, TRAVEL_MODES, type TravelMode } from '../model/route'

const MUTED = '#78726B'
const FOREGROUND = '#1F1D1B'
const ON_PRIMARY = '#FAF8F3'

const MODE_ICONS = { foot: Footprints, car: Car } as const

type SelectedBranchCardProps = {
  branch: Branch
  /** False when searching from a chosen city: a route needs the user's own position. */
  canRoute: boolean
  /** The mode suggested by distance; drawn as the primary button. */
  suggestedMode: TravelMode
  onStart: (mode: TravelMode) => void
  onClose: () => void
}

/**
 * The shop tapped on the map. Choosing how to go starts the route on our own
 * map (ADR-0007) — nothing is requested from the routing service before that,
 * so browsing shops costs no quota.
 *
 * Floating over the map, it separates by border, not by shadow (visual direction).
 */
export function SelectedBranchCard({
  branch,
  canRoute,
  suggestedMode,
  onStart,
  onClose,
}: SelectedBranchCardProps) {
  return (
    <View className="absolute bottom-3 left-3 right-3 rounded-lg border border-border bg-card p-4">
      <View className="flex-row items-start">
        <View className="flex-1 pr-2">
          <Text className="text-base font-semibold text-foreground" numberOfLines={2}>
            {branch.name}
          </Text>
          <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={1}>
            {branch.storeName} · a {distanceLabel(branch.distanceM)}
            {branch.address ? ` · ${branch.address}` : ''}
          </Text>
          {branch.hasPrices ? null : (
            <Text className="mt-0.5 text-xs text-muted-foreground">Precios próximamente</Text>
          )}
        </View>

        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          hitSlop={8}
          className="h-11 w-11 items-center justify-center rounded-md active:bg-muted"
        >
          <X size={20} color={MUTED} strokeWidth={1.75} />
        </Pressable>
      </View>

      {canRoute ? (
        <View className="mt-3 flex-row gap-2">
          {TRAVEL_MODES.map((mode) => {
            const primary = mode === suggestedMode
            const Icon = MODE_ICONS[mode]
            return (
              <Pressable
                key={mode}
                onPress={() => onStart(mode)}
                accessibilityRole="button"
                accessibilityLabel={`Ir ${MODE_LABELS[mode].toLowerCase()} a ${branch.name}`}
                className={`h-12 flex-1 flex-row items-center justify-center rounded-md ${
                  primary
                    ? 'bg-primary active:opacity-80'
                    : 'border border-border bg-background active:bg-muted'
                }`}
              >
                <Icon size={18} color={primary ? ON_PRIMARY : FOREGROUND} strokeWidth={1.75} />
                {/* One line always: a label split as "A / pie" reads as two
                    words. It shrinks before it wraps. */}
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  className={`ml-2 shrink text-sm font-medium ${
                    primary ? 'text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  Ir {MODE_LABELS[mode].toLowerCase()}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : (
        <Text className="mt-3 text-sm text-muted-foreground">
          Para trazar la ruta, busca desde tu ubicación.
        </Text>
      )}
    </View>
  )
}
