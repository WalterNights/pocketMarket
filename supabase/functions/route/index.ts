// Route between the user and a shop, for the map (ADR-0007).
//
// A proxy, so the OpenRouteService key never ships in the app: anything in
// the bundle is public (08-security.md, "Claves de API de terceros"). It also
// validates every request BEFORE spending the free daily quota (~2,000).
//
// POST { from: {lat,lng}, to: {lat,lng}, mode: 'foot' | 'car' }
//   → 200 { distanceM, durationS, coordinates: [[lng, lat], ...] }
//   → 400 invalid request · 404 no route · 503 quota, timeout or upstream down
//
// Logs carry only HTTP statuses and ORS's numeric error code: the request and
// ORS's messages can contain the user's coordinates, which are never logged.

const ORS_URL = 'https://api.openrouteservice.org/v2/directions'
const PROFILES = { foot: 'foot-walking', car: 'driving-car' } as const

/** Shops are searched within 25 km; nobody needs a route across the country. */
const MAX_STRAIGHT_LINE_M = 30_000
/** ORS normally answers in under a second; past this it is down, not slow. */
const UPSTREAM_TIMEOUT_MS = 10_000

type Point = { lat: number; lng: number }

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Same bounding box as store_branch's CHECK constraint. */
function inColombia(p: Point): boolean {
  return p.lat >= -4.3 && p.lat <= 13.6 && p.lng >= -82.0 && p.lng <= -66.8
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readPoint(value: unknown): Point | null {
  if (!isRecord(value)) return null
  const { lat, lng } = value
  if (typeof lat !== 'number' || typeof lng !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

/** Great-circle distance in metres; only a sanity cap, not the route length. */
function haversineM(a: Point, b: Point): number {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** [lng, lat] pairs of finite numbers, dropping any extra dimension. */
function readLine(value: unknown): [number, number][] | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const line: [number, number][] = []
  for (const point of value) {
    if (!Array.isArray(point)) return null
    const [lng, lat] = point
    if (typeof lng !== 'number' || typeof lat !== 'number') return null
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
    line.push([lng, lat])
  }
  return line
}

/**
 * ORS's numeric error code (e.g. 2009 "route not found"), and nothing else:
 * its message can quote the request's coordinates.
 */
async function orsErrorCode(response: Response): Promise<number | undefined> {
  try {
    const body: unknown = await response.json()
    const error = isRecord(body) ? body.error : undefined
    return isRecord(error) && typeof error.code === 'number' ? error.code : undefined
  } catch {
    return undefined // not JSON: the status alone is logged
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method' })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'invalid' })
  }
  if (!isRecord(body)) return json(400, { error: 'invalid' })

  const from = readPoint(body.from)
  const to = readPoint(body.to)
  const mode = body.mode
  if (from === null || to === null || (mode !== 'foot' && mode !== 'car')) {
    return json(400, { error: 'invalid' })
  }
  if (!inColombia(from) || !inColombia(to) || haversineM(from, to) > MAX_STRAIGHT_LINE_M) {
    return json(400, { error: 'out_of_range' })
  }

  // Checked after validation: a malformed request is the caller's problem
  // whether or not the provider is configured.
  const key = Deno.env.get('ORS_API_KEY')
  if (!key) {
    console.error('ORS_API_KEY is not set')
    return json(503, { error: 'unavailable' })
  }

  let upstream: Response
  try {
    upstream = await fetch(`${ORS_URL}/${PROFILES[mode]}/geojson`, {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      // ORS takes [longitude, latitude].
      body: JSON.stringify({
        coordinates: [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ],
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (cause) {
    const reason =
      cause instanceof DOMException && cause.name === 'TimeoutError' ? 'timeout' : 'network'
    console.error(`ORS unreachable (${reason})`)
    return json(503, { error: 'unavailable' })
  }

  if (upstream.status === 429) {
    console.error('ORS quota exhausted (429)')
    return json(503, { error: 'quota' })
  }
  if (upstream.status === 401 || upstream.status === 403) {
    // The key is wrong, revoked, or not yet enabled for Directions. A
    // configuration problem on our side, not something the user can fix.
    console.error(`ORS refused the key: ${upstream.status} code=${await orsErrorCode(upstream)}`)
    return json(503, { error: 'unavailable' })
  }
  if (!upstream.ok) {
    // 404 / 2009-style errors: no route between the points (an island, a closed area).
    console.warn(`ORS ${upstream.status} code=${await orsErrorCode(upstream)}`)
    return json(upstream.status === 404 ? 404 : 503, {
      error: upstream.status === 404 ? 'no_route' : 'upstream',
    })
  }

  let route: unknown
  try {
    route = await upstream.json()
  } catch {
    console.error('ORS answered 200 without JSON')
    return json(503, { error: 'upstream' })
  }

  const feature = isRecord(route) && Array.isArray(route.features) ? route.features[0] : undefined
  const geometry = isRecord(feature) ? feature.geometry : undefined
  const properties = isRecord(feature) ? feature.properties : undefined
  const summary = isRecord(properties) ? properties.summary : undefined
  const coordinates = isRecord(geometry) ? readLine(geometry.coordinates) : null
  const distance = isRecord(summary) ? summary.distance : undefined
  const duration = isRecord(summary) ? summary.duration : undefined

  if (coordinates === null || typeof distance !== 'number' || !Number.isFinite(distance)) {
    console.error('Unexpected ORS response shape')
    return json(503, { error: 'upstream' })
  }

  return json(200, {
    distanceM: Math.round(distance),
    durationS: typeof duration === 'number' && Number.isFinite(duration) ? Math.round(duration) : 0,
    coordinates,
  })
})
