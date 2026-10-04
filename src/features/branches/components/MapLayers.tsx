import {
  GeoJSONSource,
  Layer,
  type CircleLayerSpecification,
  type LineLayerSpecification,
  type PressEventWithFeatures,
  type SymbolLayerSpecification,
} from '@maplibre/maplibre-react-native'
import type { FeatureCollection, LineString, Point } from 'geojson'
import { memo, useMemo } from 'react'
import type { NativeSyntheticEvent } from 'react-native'

import type { Coordinates } from '../model/branch'
import { LABEL_FONT, pointFeature, type BranchFeatureProperties } from '../model/map-style'

/**
 * The map's three sources, each memoized on its own data: a GPS fix
 * re-renders the user dot, not the route line nor thirty shops. Paint and
 * layout are module constants so the native side never sees a "new" style.
 */

// Map paint is native style JSON, not NativeWind: these mirror the tokens
// (--foreground, --background) because a style expression cannot read CSS vars.
const INK = '#1F1D1B'
const PAPER = '#FAF8F3'

const ROUTE_LAYOUT: LineLayerSpecification['layout'] = {
  'line-join': 'round',
  'line-cap': 'round',
}
const ROUTE_CASING_PAINT: LineLayerSpecification['paint'] = {
  'line-color': PAPER,
  'line-width': 9,
}
// Solid in both modes: at this width a dashed line breaks into dots that read
// as something else.
const ROUTE_LINE_PAINT: LineLayerSpecification['paint'] = { 'line-color': INK, 'line-width': 5 }

const ME_HALO_PAINT: CircleLayerSpecification['paint'] = {
  'circle-radius': 14,
  'circle-color': INK,
  'circle-opacity': 0.12,
}
const ME_DOT_PAINT: CircleLayerSpecification['paint'] = {
  'circle-radius': 6,
  'circle-color': INK,
  'circle-stroke-color': PAPER,
  'circle-stroke-width': 2,
}

// Paper dot with an ink ring; inverted when selected. No brand colours:
// colour is kept for information (visual direction).
const BRANCH_DOT_PAINT: CircleLayerSpecification['paint'] = {
  'circle-radius': ['case', ['get', 'selected'], 9, 7],
  'circle-color': ['case', ['get', 'selected'], INK, PAPER],
  'circle-stroke-color': INK,
  'circle-stroke-width': 2,
}
const BRANCH_LABEL_LAYOUT: SymbolLayerSpecification['layout'] = {
  'text-field': ['get', 'chain'],
  'text-font': LABEL_FONT,
  'text-size': 11,
  'text-anchor': 'top',
  'text-offset': [0, 0.9],
}
const BRANCH_LABEL_PAINT: SymbolLayerSpecification['paint'] = {
  'text-color': INK,
  'text-halo-color': PAPER,
  'text-halo-width': 1.5,
}

/** Declared first in the map so it draws under the user dot and the shops. */
export const RouteLayers = memo(function RouteLayers({
  shape,
}: {
  shape: FeatureCollection<LineString>
}) {
  return (
    <GeoJSONSource id="route" data={shape}>
      <Layer id="route-casing" type="line" layout={ROUTE_LAYOUT} paint={ROUTE_CASING_PAINT} />
      <Layer id="route-line" type="line" layout={ROUTE_LAYOUT} paint={ROUTE_LINE_PAINT} />
    </GeoJSONSource>
  )
})

/**
 * Drawn by us from our own readings: MapLibre's UserLocation would run its
 * own continuous GPS (ADR-0007). Takes plain numbers so an identical reading
 * does not rebuild the feature.
 */
export const UserDotLayers = memo(function UserDotLayers({ latitude, longitude }: Coordinates) {
  const shape = useMemo(() => pointFeature({ latitude, longitude }), [latitude, longitude])
  return (
    <GeoJSONSource id="me" data={shape}>
      <Layer id="me-halo" type="circle" paint={ME_HALO_PAINT} />
      <Layer id="me-dot" type="circle" paint={ME_DOT_PAINT} />
    </GeoJSONSource>
  )
})

/**
 * The shops. No `hitbox`: the native default is already 44 × 44 pt around
 * the touch, the minimum tap area (ui-styling.md), for a 7 pt dot.
 */
export const BranchLayers = memo(function BranchLayers({
  shape,
  onPress,
}: {
  shape: FeatureCollection<Point, BranchFeatureProperties>
  onPress: (event: NativeSyntheticEvent<PressEventWithFeatures>) => void
}) {
  return (
    <GeoJSONSource id="branches" data={shape} onPress={onPress}>
      <Layer id="branch-dot" type="circle" paint={BRANCH_DOT_PAINT} />
      <Layer
        id="branch-label"
        type="symbol"
        layout={BRANCH_LABEL_LAYOUT}
        paint={BRANCH_LABEL_PAINT}
      />
    </GeoJSONSource>
  )
})
