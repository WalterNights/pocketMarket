import type { Feature, FeatureCollection, Point } from 'geojson'

import type { Branch, Coordinates } from './branch'

/**
 * The map: MapLibre with OpenFreeMap tiles — no API key, no account, no
 * billing (ADR-0006).
 *
 * "Positron" is chosen for what it LACKS: it has no `poi` source-layer at all,
 * so the base map shows streets, water and place names but no restaurants,
 * banks or other shops. Only our chains are drawn (plan 0001). Verified
 * against the live style on 2026-10-04.
 */
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'

/** A font the style's glyph server actually has; any other renders no text. */
export const LABEL_FONT = ['Noto Sans Bold']

export type BranchFeatureProperties = {
  id: string
  chain: string
  selected: boolean
}

/**
 * Branches as one GeoJSON layer. Drawn by the GPU as circles plus labels — far
 * cheaper than a React view per shop, and tap handling stays on the layer
 * (a per-marker press also fires the map's press on Android, maplibre #1618).
 */
export function branchesToGeoJSON(
  branches: readonly Branch[],
  selectedId: string | null,
): FeatureCollection<Point, BranchFeatureProperties> {
  return {
    type: 'FeatureCollection',
    features: branches.map((branch): Feature<Point, BranchFeatureProperties> => ({
      type: 'Feature',
      id: branch.id,
      // GeoJSON order: [longitude, latitude].
      geometry: { type: 'Point', coordinates: [branch.longitude, branch.latitude] },
      properties: { id: branch.id, chain: branch.storeName, selected: branch.id === selectedId },
    })),
  }
}

/** The user's one-shot position, drawn by us — no continuous location tracking. */
export function pointFeature(origin: Coordinates): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [origin.longitude, origin.latitude] },
        properties: {},
      },
    ],
  }
}

/** ~2 km across: the smallest view, so a lone shop is not shown at roof level. */
const MIN_SPAN_DEG = 0.02

/**
 * [west, south, east, north] framing the user and every shop shown. Padding is
 * applied by the camera in points, so the box itself is exact.
 */
export function boundsFor(
  origin: Coordinates,
  branches: readonly Pick<Branch, 'latitude' | 'longitude'>[],
): [west: number, south: number, east: number, north: number] {
  const lats = [origin.latitude, ...branches.map((b) => b.latitude)]
  const lngs = [origin.longitude, ...branches.map((b) => b.longitude)]

  const grow = (min: number, max: number): [number, number] => {
    const missing = Math.max(0, MIN_SPAN_DEG - (max - min)) / 2
    return [min - missing, max + missing]
  }

  const [south, north] = grow(Math.min(...lats), Math.max(...lats))
  const [west, east] = grow(Math.min(...lngs), Math.max(...lngs))
  return [west, south, east, north]
}
