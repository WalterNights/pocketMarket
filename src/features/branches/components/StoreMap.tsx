import {
  Camera,
  Map,
  type CameraRef,
  type PressEventWithFeatures,
  type ViewStateChangeEvent,
} from '@maplibre/maplibre-react-native'
import LocateFixed from 'lucide-react-native/icons/locate-fixed'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View, type NativeSyntheticEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useLiveNavigation } from '../hooks/useLiveNavigation'
import { useMapOrigin } from '../hooks/useMapOrigin'
import { useNearestBranches } from '../hooks/useNearestBranches'
import { useRoute, type RouteRequest } from '../hooks/useRoute'
import { CITY_CENTRES, type Branch, type Coordinates } from '../model/branch'
import { boundsFor, branchesToGeoJSON, MAP_STYLE_URL } from '../model/map-style'
import { navigationView } from '../model/navigation-view'
import { defaultMode, routeBounds, routeToGeoJSON, type TravelMode } from '../model/route'
import { BranchList } from './BranchList'
import { BranchLayers, RouteLayers, UserDotLayers } from './MapLayers'
import { NavigationPanel } from './NavigationPanel'
import { OriginPicker } from './OriginPicker'
import { SelectedBranchCard } from './SelectedBranchCard'

const FOREGROUND = '#1F1D1B'

const MAP_VIEW_STYLE = { flex: 1 } as const
const FRAME_PADDING = { top: 48, right: 48, bottom: 48, left: 48 }
const ROUTE_SIDE_PADDING = 48
/**
 * Room kept free above the safe area for the navigation panel (≈ 160 pt
 * tall, plus its gap), so a framed route is not drawn behind it.
 */
const NAV_PANEL_CLEARANCE = 200
const FOCUS_ZOOM = 15
/** Street level while following someone who is walking or driving. */
const FOLLOW_ZOOM = 16.5
const ANIMATION_MS = 400

/**
 * Nearest shops of every chain on a map, with the same shops as a list below.
 * Only our chains are drawn: the base style has no businesses at all
 * (ADR-0006). Choosing how to go to a shop turns the screen into a full-screen
 * map that follows the user to it (ADR-0007).
 */
export function StoreMap() {
  const insets = useSafeAreaInsets()
  const origin = useMapOrigin()
  const { locateMe: requestDeviceOrigin, chooseCity: chooseCityOrigin, openSettings } = origin
  const nearest = useNearestBranches(origin.origin?.coords ?? null)
  const cameraRef = useRef<CameraRef>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [changingOrigin, setChangingOrigin] = useState(false)
  const [trip, setTrip] = useState<RouteRequest | null>(null)
  // The trip whose camera the user took over by panning; null = following.
  const [pausedTrip, setPausedTrip] = useState<string | null>(null)

  const branches = useMemo(() => nearest.data ?? [], [nearest.data])
  // Derived, not stored: if a new search drops the selected shop, the card goes too.
  const selected = useMemo(
    () => branches.find((branch) => branch.id === selectedId) ?? null,
    [branches, selectedId],
  )
  const highlightedId = trip?.branch.id ?? selectedId
  const branchShapes = useMemo(
    () => branchesToGeoJSON(branches, highlightedId),
    [branches, highlightedId],
  )

  // The routing service is asked only once a trip starts, never for browsing.
  const tripRoute = useRoute(trip)
  const routeShape = useMemo(
    () => (tripRoute.route ? routeToGeoJSON(tripRoute.route.coordinates) : null),
    [tripRoute.route],
  )

  const reroute = useCallback(
    (from: Coordinates) => setTrip((current) => (current ? { ...current, from } : current)),
    [],
  )
  const tripKey = trip?.key ?? null
  const live = useLiveNavigation(tripKey, trip?.branch ?? null, tripRoute.route, reroute)

  // Frame the user and every shop found when the origin or the result changes —
  // not while navigating, where the camera follows the user instead.
  const navigating = trip !== null
  useEffect(() => {
    if (origin.origin === null || navigating) return
    cameraRef.current?.fitBounds(boundsFor(origin.origin.coords, branches), {
      padding: FRAME_PADDING,
      duration: ANIMATION_MS,
    })
  }, [origin.origin, branches, navigating])

  // Read by the camera once, on mount; memoized so a GPS fix does not hand
  // it a new object.
  const originCoords = origin.origin?.coords ?? null
  const initialViewState = useMemo(
    () =>
      originCoords ? { bounds: boundsFor(originCoords, []), padding: FRAME_PADDING } : undefined,
    [originCoords],
  )

  const routePadding = useMemo(
    () => ({
      top: ROUTE_SIDE_PADDING,
      right: ROUTE_SIDE_PADDING,
      bottom: insets.bottom + NAV_PANEL_CLEARANCE,
      left: ROUTE_SIDE_PADDING,
    }),
    [insets.bottom],
  )

  // A trip's first route is shown whole ONCE. Reroutes do not reframe: the
  // camera is following the user by then, and yanking it out would fight that.
  const framedTrip = useRef<string | null>(null)
  useEffect(() => {
    if (tripKey === null || !tripRoute.route || framedTrip.current === tripKey) return
    framedTrip.current = tripKey
    cameraRef.current?.fitBounds(routeBounds(tripRoute.route.coordinates), {
      padding: routePadding,
      duration: ANIMATION_MS,
    })
  }, [tripKey, tripRoute.route, routePadding])

  // Following: keep the user in the centre at street level, until they pan.
  const following = tripKey !== null && pausedTrip !== tripKey
  useEffect(() => {
    if (!following || !live.position) return
    cameraRef.current?.easeTo({
      center: [live.position.longitude, live.position.latitude],
      zoom: FOLLOW_ZOOM,
      duration: ANIMATION_MS,
    })
  }, [following, live.position])

  const onRegionWillChange = useCallback(
    (event: NativeSyntheticEvent<ViewStateChangeEvent>) => {
      if (tripKey !== null && event.nativeEvent.userInteraction) setPausedTrip(tripKey)
    },
    [tripKey],
  )
  const recenter = useCallback(() => setPausedTrip(null), [])

  const select = useCallback((branch: Branch) => {
    setSelectedId(branch.id)
    cameraRef.current?.flyTo({
      center: [branch.longitude, branch.latitude],
      zoom: FOCUS_ZOOM,
      duration: ANIMATION_MS,
    })
  }, [])

  const onBranchPress = useCallback(
    (event: NativeSyntheticEvent<PressEventWithFeatures>) => {
      if (navigating) return // the destination is fixed while navigating
      const id = event.nativeEvent.features[0]?.properties?.id
      const branch = branches.find((b) => b.id === id)
      if (branch) select(branch)
    },
    [navigating, branches, select],
  )

  // The picker closes only once the device position is really the origin;
  // on denial or failure it stays open with its explanation.
  const locateMe = useCallback(async () => {
    if (await requestDeviceOrigin()) setChangingOrigin(false)
  }, [requestDeviceOrigin])

  const chooseCity = useCallback(
    (code: string) => {
      chooseCityOrigin(code)
      setChangingOrigin(false)
    },
    [chooseCityOrigin],
  )

  if (origin.origin === null || changingOrigin) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <Text className="px-4 pt-4 text-base text-foreground">
          Te mostramos las tiendas más cercanas de las cadenas que conocemos.
        </Text>
        <OriginPicker
          permission={origin.permission}
          locating={origin.locating}
          locateFailed={origin.locateFailed}
          selectedCity={origin.origin?.kind === 'city' ? origin.origin.code : null}
          onLocateMe={() => void locateMe()}
          onChooseCity={chooseCity}
          onOpenSettings={() => void openSettings()}
        />
      </ScrollView>
    )
  }

  const here = origin.origin
  const originLabel =
    here.kind === 'device'
      ? 'Cerca de ti'
      : `Cerca del centro de ${CITY_CENTRES[here.code]?.name ?? 'la ciudad'}`

  const startTrip = (mode: TravelMode) => {
    if (selected === null || here.kind !== 'device') return
    setTrip({ key: `${selected.id}:${Date.now()}`, branch: selected, mode, from: here.coords })
  }

  const endTrip = () => setTrip(null)
  const closeAfterArrival = () => {
    setTrip(null)
    setSelectedId(null)
  }

  // While navigating the dot is the live position; otherwise the one reading.
  const userDot = live.position ?? (here.kind === 'device' ? here.coords : null)

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <Map
          style={MAP_VIEW_STYLE}
          mapStyle={MAP_STYLE_URL}
          // Required by the tiles' licence: © OpenMapTiles, © OpenStreetMap.
          attribution
          logo={false}
          compass={false}
          onRegionWillChange={onRegionWillChange}
          accessibilityLabel={`Mapa con ${branches.length} tiendas cercanas`}
        >
          <Camera ref={cameraRef} initialViewState={initialViewState} />

          {trip && routeShape ? <RouteLayers shape={routeShape} /> : null}
          {userDot ? (
            <UserDotLayers latitude={userDot.latitude} longitude={userDot.longitude} />
          ) : null}
          <BranchLayers shape={branchShapes} onPress={onBranchPress} />
        </Map>

        {trip && !following && live.position ? (
          <Pressable
            onPress={recenter}
            accessibilityRole="button"
            accessibilityLabel="Centrar el mapa en tu ubicación"
            className="absolute right-3 top-3 h-11 flex-row items-center rounded-md border border-border bg-card px-3 active:bg-muted"
          >
            <LocateFixed size={20} color={FOREGROUND} strokeWidth={1.75} />
            <Text className="ml-2 text-sm font-medium text-foreground">Centrar</Text>
          </Pressable>
        ) : null}

        {trip ? (
          <NavigationPanel
            shopName={trip.branch.name}
            mode={trip.mode}
            view={navigationView({
              arrived: live.arrived,
              route: tripRoute.route,
              progress: live.progress,
              rerouting: tripRoute.rerouting,
              failure: tripRoute.failure,
            })}
            bottomInset={insets.bottom}
            onCancel={live.arrived ? closeAfterArrival : endTrip}
            onRetry={() => void tripRoute.retry()}
          />
        ) : selected ? (
          // Not full-screen here: the origin bar and the list sit below the
          // map, so the bottom safe area is theirs, not the card's.
          <SelectedBranchCard
            branch={selected}
            canRoute={here.kind === 'device'}
            suggestedMode={defaultMode(selected.distanceM)}
            onStart={startTrip}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </View>

      {/* Hidden while navigating: the map takes the whole screen. */}
      {navigating ? null : (
        <>
          <View className="flex-row items-center justify-between border-y border-border bg-card px-4 py-2">
            <Text className="text-sm font-medium text-foreground">{originLabel}</Text>
            <Pressable
              onPress={() => setChangingOrigin(true)}
              accessibilityRole="button"
              accessibilityLabel="Cambiar desde dónde buscar"
              hitSlop={8}
              className="h-11 justify-center"
            >
              <Text className="text-sm text-foreground underline">Cambiar</Text>
            </Pressable>
          </View>

          <View className="flex-1">
            <BranchList
              branches={nearest.data}
              isPending={nearest.isPending}
              isError={nearest.isError}
              onRetry={() => void nearest.refetch()}
              selectedId={selectedId}
              onSelect={select}
              bottomInset={insets.bottom}
            />
          </View>
        </>
      )}
    </View>
  )
}
