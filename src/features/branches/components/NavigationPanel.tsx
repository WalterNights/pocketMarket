import MapPinCheck from 'lucide-react-native/icons/map-pin-check'
import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { distanceLabel } from '../model/branch'
import type { NavigationView } from '../model/navigation-view'
import { durationLabel, MODE_PHRASES, type TravelMode } from '../model/route'

const MUTED = '#78726B'
const FOREGROUND = '#1F1D1B'

/** Gap between the panel and the bottom safe area. */
const PANEL_GAP = 12

type NavigationPanelProps = {
  shopName: string
  mode: TravelMode
  view: NavigationView
  /** Bottom safe area: the map is full-screen while navigating. */
  bottomInset: number
  onCancel: () => void
  onRetry: () => void
}

/**
 * The only chrome left while navigating: time and distance remaining, live,
 * and the way out. Everything else (origin bar, shop list, mode choice) is
 * hidden so the map takes the screen.
 */
export function NavigationPanel({
  shopName,
  mode,
  view,
  bottomInset,
  onCancel,
  onRetry,
}: NavigationPanelProps) {
  const bottom = bottomInset + PANEL_GAP

  if (view.kind === 'arrived') {
    return (
      <Panel bottom={bottom}>
        <View className="flex-row items-center">
          <MapPinCheck size={24} color={FOREGROUND} strokeWidth={1.75} />
          <View className="ml-3 flex-1">
            <Text className="text-lg font-semibold text-foreground">Llegaste</Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {shopName}
            </Text>
          </View>
        </View>
        <ActionButton label="Cerrar" onPress={onCancel} />
      </Panel>
    )
  }

  const canRetry = view.kind === 'error' || (view.kind === 'following' && view.failure !== null)

  return (
    <Panel bottom={bottom}>
      <View accessibilityLiveRegion="polite">
        {view.kind === 'loading' ? (
          <View className="flex-row items-center">
            <ActivityIndicator size="small" color={MUTED} />
            <Text className="ml-2 text-base text-muted-foreground">Calculando ruta…</Text>
          </View>
        ) : view.kind === 'error' ? (
          <Text className="text-base text-foreground">{view.message}</Text>
        ) : (
          <>
            <Text className="text-2xl font-semibold tabular-nums text-foreground">
              {durationLabel(view.remainingS)}
              <Text className="text-base font-normal text-muted-foreground">
                {'  '}
                {distanceLabel(view.remainingM)} {MODE_PHRASES[mode]}
              </Text>
            </Text>
            <Text className="mt-0.5 text-sm text-muted-foreground" numberOfLines={2}>
              {followingSubtitle(view, shopName)}
            </Text>
          </>
        )}
      </View>

      <View className="flex-row gap-2">
        {canRetry ? (
          <View className="flex-1">
            <ActionButton label="Reintentar" onPress={onRetry} />
          </View>
        ) : null}
        <View className="flex-1">
          <ActionButton label="Cancelar ruta" onPress={onCancel} />
        </View>
      </View>
    </Panel>
  )
}

function followingSubtitle(
  view: Extract<NavigationView, { kind: 'following' }>,
  shopName: string,
): string {
  if (view.rerouting) return 'Recalculando la ruta…'
  if (view.failure !== null) return `${view.failure} Seguimos con la ruta anterior.`
  return `Hacia ${shopName}`
}

function Panel({ bottom, children }: { bottom: number; children: ReactNode }) {
  return (
    <View
      className="absolute left-3 right-3 rounded-lg border border-border bg-card p-4"
      style={{ bottom }}
    >
      {children}
    </View>
  )
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="mt-3 h-12 items-center justify-center rounded-md border border-border bg-background active:bg-muted"
    >
      <Text className="text-base font-medium text-foreground">{label}</Text>
    </Pressable>
  )
}
