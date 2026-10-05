import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { z } from 'zod'

import { isInColombia } from './branch-types'
import { normalise } from './classify'
import { fetchJson, type PoliteContext } from './http'
import { sleep } from './types'

/**
 * Geocoding of Colombian street addresses with Nominatim, for sources that
 * publish an address but no coordinates (Ísimo).
 *
 * Data © OpenStreetMap contributors, available under the Open Database
 * License (ODbL 1.0, https://www.openstreetmap.org/copyright). Coordinates
 * obtained here are derived from OSM and must keep that attribution.
 *
 * Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/):
 * at most 1 request per second, no parallel requests, an identifying
 * User-Agent, and cache results. All four are enforced here: requests are
 * sequential and spaced, the caller's User-Agent carries a contact, and every
 * answer goes to an on-disk cache so a monthly rerun only asks for new
 * addresses.
 *
 * Why a Colombian address is hard: "Cra 80 # 50-87" means "on Carrera 80, 87 m
 * from its corner with Calle 50". OSM rarely has house numbers in that format,
 * and a bare street match is useless in a big city (Carrera 80 crosses all of
 * Medellín). So the confident answers, in order:
 *
 *   1. address — a house or building on the right street in the right town
 *      whose house number names the same cross street ("50-87");
 *   2. intersection — the street and its cross street (Carrera 80 × Calle 50)
 *      both found in that town, crossing at a single place;
 *   3. street — only a very short street: every piece of it fits in 300 m, and
 *      the answer was not cut at the result limit.
 *
 * A municipality is not one town. It has a seat and, around it, villages with
 * their own "Calle 4" and "Carrera 6", 10 km away. So rules 2 and 3 also ask
 * WHICH settlement the street is in (see "settlements" below), and refuse when
 * the same street name turns up elsewhere and nothing says which one is meant.
 *
 * Anything else is skipped. A shop missing from the map is better than a shop
 * drawn on the wrong block.
 */

// ---------------------------------------------------------------- parsing

export type StreetType = 'calle' | 'carrera' | 'diagonal' | 'transversal' | 'avenida'

export type Street = {
  type: StreetType
  /** Compact number token: "34c", "6bis", "19". */
  number: string
  suffix: 'sur' | 'este' | null
}

export type ParsedAddress = {
  street: Street
  /** The cross street the number refers to; null when unreadable. */
  cross: Street | null
  /** Metres from the corner, as written ("87"); null when absent. */
  plate: string | null
}

/** Order matters: "avenida carrera" before "avenida", "ak" before nothing. */
const STREET_TYPES: readonly [RegExp, StreetType][] = [
  [/^(?:avenida|avda|av)\s+(?:carrera|kra|cra|kr|cr)\s+/, 'carrera'],
  [/^(?:avenida|avda|av)\s+(?:calle|cll|cl)\s+/, 'calle'],
  [/^ak\s+/, 'carrera'],
  [/^ac\s+/, 'calle'],
  [/^(?:calle|clle|cll|cl|call|cale)\s+/, 'calle'],
  [/^(?:carrera|carr|kra|cra|crr|kr|cr)\s+/, 'carrera'],
  [/^(?:diagonal|diag|dg)\s+/, 'diagonal'],
  [/^(?:transversal|transv|trans|trv|tv|tr)\s+/, 'transversal'],
  [/^(?:avenida|avda|av)\s+/, 'avenida'],
]

// A single letter only when no other letter follows: "8 sur" is not "8s".
// "n" before a digit is "número" ("Cra 3 N 79-30"), not a letter of the number.
// No trailing whitespace inside: an optional suffix after it must still see it.
const LETTER = String.raw`((?!n\s*\d)[a-z](?![a-z]))`
const NUMBER = String.raw`(\d+)(?:\s*${LETTER})?(?:\s*(bis))?(?:\s*${LETTER})?`
const STREET_RE = new RegExp(String.raw`^${NUMBER}(?:\s+(sur|este))?`)
// The last group is a quadrant written after the plate: "# 52G 38 SUR".
const CROSS_RE = new RegExp(
  String.raw`^(?:#|numero|num|no|n)?\s*${NUMBER}(?:\s+(sur|este))?(?:(?:\s*-\s*|\s+)(\d+)(?:\s+(sur|este)\b)?)?`,
)

/** Lowercase, no accents, no punctuation that only gets in the way. */
function clean(raw: string): string {
  return normalise(raw)
    .replace(/[–—]/g, '-')
    .replace(/[°º"“”'.,]/g, ' ')
    .replace(/#/g, ' # ')
    .replace(/\s+/g, ' ')
    .trim()
}

function compactNumber(m: RegExpExecArray, offset: number): string {
  return [m[offset], m[offset + 1], m[offset + 2], m[offset + 3]].filter(Boolean).join('')
}

/**
 * PURE. "Cra. 80 # 50-87" → Carrera 80, cross 50, plate 87. Returns null when
 * the text does not start with a street ("Urbanización Modelia Mz 61").
 */
export function parseColombianAddress(raw: string): ParsedAddress | null {
  let text = clean(raw)
  const found = STREET_TYPES.find(([re]) => re.test(text))
  if (found === undefined) return null
  const [typeRe, type] = found
  text = text.replace(typeRe, '')

  const street = STREET_RE.exec(text)
  if (street === null) return null
  const parsedStreet: Street = {
    type,
    number: compactNumber(street, 1),
    suffix: (street[5] as Street['suffix'] | undefined) ?? null,
  }

  const cross = CROSS_RE.exec(text.slice(street[0].length).trim())
  const crossType = crossTypeOf(type)
  if (cross === null || crossType === null) {
    return { street: parsedStreet, cross: null, plate: null }
  }

  const parsedCross: Street = {
    type: crossType,
    number: compactNumber(cross, 1),
    suffix: (cross[5] as Street['suffix'] | undefined) ?? null,
  }
  // "Carrera 33 # 52G-38 Sur": the quadrant after the plate belongs to the
  // street that can carry it — calles run Sur, carreras run Este. Read as
  // plain Calle 52G, this address is another street, kilometres north.
  const trailing = cross[7] as Street['suffix'] | undefined
  if (trailing !== undefined && parsedStreet.suffix === null && parsedCross.suffix === null) {
    const carriesIt = trailing === 'sur' ? ['calle', 'diagonal'] : ['carrera', 'transversal']
    const owner = carriesIt.includes(parsedStreet.type) ? parsedStreet : parsedCross
    if (carriesIt.includes(owner.type)) owner.suffix = trailing
  }
  return { street: parsedStreet, cross: parsedCross, plate: cross[6] ?? null }
}

/** Calles cross carreras and vice versa. A bare "Avenida" says neither. */
function crossTypeOf(type: StreetType): StreetType | null {
  if (type === 'calle' || type === 'diagonal') return 'carrera'
  if (type === 'carrera' || type === 'transversal') return 'calle'
  return null
}

/** "34c" → "34C", "6bis" → "6 Bis". For queries; matching uses the compact form. */
export function streetLabel(street: Street): string {
  const type = street.type.charAt(0).toUpperCase() + street.type.slice(1)
  const number = street.number.toUpperCase().replace(/BIS/, ' Bis ')
  const suffix = street.suffix === null ? '' : ` ${street.suffix === 'sur' ? 'Sur' : 'Este'}`
  return `${type} ${number.replace(/\s+/g, ' ').trim()}${suffix}`
}

// ------------------------------------------------------------- queries

/**
 * Colombia's departments, normalised. Anything else in a "department" field is
 * noise. Bogotá is deliberately NOT here: it is a city that is its own district,
 * and listing it made every Bogotá shop read as "a department in the town
 * field" and get skipped — 69 of Ísimo's 310.
 */
const DEPARTMENTS = new Set([
  'amazonas',
  'antioquia',
  'arauca',
  'atlantico',
  'bolivar',
  'boyaca',
  'caldas',
  'caqueta',
  'casanare',
  'cauca',
  'cesar',
  'choco',
  'cordoba',
  'cundinamarca',
  'guainia',
  'guaviare',
  'huila',
  'la guajira',
  'magdalena',
  'meta',
  'narino',
  'norte de santander',
  'putumayo',
  'quindio',
  'risaralda',
  'san andres',
  'santander',
  'sucre',
  'tolima',
  'valle del cauca',
  'vaupes',
  'vichada',
])

/** "BOGOTÁ D.C." / "Perímetro Urbano Medellín" / "Bogotá ciudad" → "bogota" / "medellin". */
export function placeKey(value: string): string {
  return clean(value)
    .replace(/\b(?:perimetro urbano|ciudad|distrito capital|d c|dc|de indias|centro)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isDepartment(value: string): boolean {
  return DEPARTMENTS.has(placeKey(value))
}

export type GeocodeTarget = {
  address: ParsedAddress
  municipality: string
  /** Null when the source's department is missing or not a department. */
  department: string | null
  /**
   * Free text that may name the village the shop is in: its title, its raw
   * address ("Ísimo Santa Marta Bonda"). Without a village named there, the
   * shop is taken to be in the municipality's seat.
   */
  hints?: readonly string[]
}

/**
 * Nominatim misses "Carrera 80, Medellín" and finds "Carrera 80, Medellin"
 * (verified 2026-10-04, also for Bogotá): place names go without accents.
 */
function placeSuffix(target: GeocodeTarget): string {
  const town = normalise(target.municipality).replace(/\b\w/g, (c) => c.toUpperCase())
  const department =
    target.department === null
      ? ''
      : `, ${normalise(target.department).replace(/\b\w/g, (c) => c.toUpperCase())}`
  return `${town}${department}`
}

/** "Carrera 80 50-87, Medellin, Antioquia": finds a building, or else the street's pieces. */
export function addressQuery(target: GeocodeTarget): string {
  const { street, cross, plate } = target.address
  const number =
    cross === null
      ? ''
      : ` ${streetLabel(cross).replace(/^\S+\s+/, '')}${plate === null ? '' : `-${plate}`}`
  return `${streetLabel(street)}${number}, ${placeSuffix(target)}`
}

/** "Calle 50, Medellin, Antioquia": the cross street's pieces. Null without one. */
export function crossQuery(target: GeocodeTarget): string | null {
  const { cross } = target.address
  return cross === null ? null : `${streetLabel(cross)}, ${placeSuffix(target)}`
}

// ------------------------------------------------------- Nominatim hits

/** Only the fields the acceptance rule reads; the cache keeps just these. */
export const nominatimHitSchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
  place_rank: z.number(),
  category: z.string(),
  type: z.string(),
  name: z.string().nullish(),
  address: z.record(z.string(), z.string()).default({}),
  boundingbox: z.tuple([
    z.coerce.number(),
    z.coerce.number(),
    z.coerce.number(),
    z.coerce.number(),
  ]),
})

export type NominatimHit = z.infer<typeof nominatimHitSchema>

/**
 * Only the fields that name a municipality. `suburb`, `hamlet` and
 * `city_district` name barrios and veredas: reading them put the town of
 * Bello inside Medellín's barrio "Bello Horizonte".
 */
const PLACE_FIELDS = ['city', 'town', 'village', 'municipality', 'county'] as const

function wordIn(needle: string, haystack: string): boolean {
  if (needle === '' || haystack === '') return false
  return new RegExp(`(?:^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`).test(
    haystack,
  )
}

/** OSM's long name for the one department our list abbreviates. */
const SAN_ANDRES_STATE = /^archipielago de san andres\b/

/** A department as a comparable key, from the source or from OSM's `state`. */
function departmentKey(value: string): string {
  const key = placeKey(value)
  return SAN_ANDRES_STATE.test(key) ? 'san andres' : key
}

/**
 * PURE. Is the hit in the shop's town (and department, when known)? Both must
 * be EQUAL once normalised, not contained: "Bello" is not "Bello Horizonte",
 * "San Luis" is not "San Luis de Gaceno", and the department "Santander" is
 * not "Norte de Santander", nor "Cauca" "Valle del Cauca".
 */
export function inMunicipality(hit: NominatimHit, target: GeocodeTarget): boolean {
  const town = placeKey(target.municipality)
  if (town === '') return false
  const townOk = PLACE_FIELDS.some((field) => {
    const value = hit.address[field]
    return value !== undefined && placeKey(value) === town
  })
  if (!townOk) return false
  if (target.department === null) return true
  return departmentKey(hit.address.state ?? '') === departmentKey(target.department)
}

/** "Calle 34 C" / "Avenida Calle 34c" → "calle 34c": letters glued to their number. */
function compactRoad(road: string): string {
  return clean(road)
    .replace(/(\d)\s+([a-z])(?![a-z])/g, '$1$2')
    .replace(/(\d[a-z]?)\s*bis\b/g, '$1bis')
    .replace(/(bis)\s+([a-z])(?![a-z])/g, '$1$2')
}

/**
 * PURE. Does the road's name say it is this street? "Carrera 80", "Avenida
 * Carrera 80" and Medellín's "Avenida 80" all match Carrera 80; "Carrera 80A"
 * and "Carrera 80 Sur" do not (they are other streets, often km away).
 */
export function isStreet(roadName: string, street: Street): boolean {
  const road = compactRoad(roadName)
  const n = street.number
  const typed = new RegExp(`(?:^|\\s)${street.type}\\s+${n}(?:\\s|$)`)
  const avenue = new RegExp(`(?:^|\\s)avenida\\s+${n}(?:\\s|$)`)
  if (!typed.test(road) && !avenue.test(road)) return false
  return (
    /\bsur\b/.test(road) === (street.suffix === 'sur') &&
    /\beste\b/.test(road) === (street.suffix === 'este')
  )
}

/** How well a hit's house number agrees with the address we are looking for. */
export type HouseNumberMatch = 'exact' | 'cross' | null

/**
 * PURE. A Colombian house number is "<cross street>-<metres from the corner>".
 * "50-87", "# 50 - 87" and "50 87" all say cross 50, plate 87. `exact` when
 * both agree with the address, `cross` when only the cross street does (same
 * block, another door), null otherwise — also for a lone number, which may be
 * a cross street or a plate.
 */
export function matchHouseNumber(
  houseNumber: string | undefined,
  cross: Street | null,
  plate: string | null,
): HouseNumberMatch {
  if (houseNumber === undefined || cross === null) return null
  const text = compactRoad(houseNumber)
  const tokens = text.match(/\d+(?:bis)?[a-z]?(?![a-z])/g) ?? []
  if (tokens.length < 2 || tokens[0] !== cross.number) return null
  if (
    /\bsur\b/.test(text) !== (cross.suffix === 'sur') ||
    /\beste\b/.test(text) !== (cross.suffix === 'este')
  ) {
    return null
  }
  return plate !== null && Number(tokens[1]) === Number(plate) ? 'exact' : 'cross'
}

function roadName(hit: NominatimHit): string | null {
  if (hit.category === 'highway') return hit.name ?? hit.address.road ?? null
  return hit.address.road ?? null
}

type Box = { south: number; north: number; west: number; east: number }

const boxOf = (hit: NominatimHit): Box => ({
  south: hit.boundingbox[0],
  north: hit.boundingbox[1],
  west: hit.boundingbox[2],
  east: hit.boundingbox[3],
})

const M_PER_DEG = 111_320
const cosLat = (box: Box) => Math.cos(((box.north + box.south) / 2) * (Math.PI / 180))

/** Diagonal of a box, in metres (equirectangular: fine at street scale). */
function diagonalM(box: Box): number {
  const latM = (box.north - box.south) * M_PER_DEG
  const lngM = (box.east - box.west) * M_PER_DEG * cosLat(box)
  return Math.hypot(latM, lngM)
}

/** Metres between two boxes; 0 when they touch or overlap. */
function gapM(a: Box, b: Box): number {
  const latM = Math.max(0, a.south - b.north, b.south - a.north) * M_PER_DEG
  const lngM = Math.max(0, a.west - b.east, b.west - a.east) * M_PER_DEG * cosLat(a)
  return Math.hypot(latM, lngM)
}

/** The box that holds them all. Never called with an empty list. */
const unionOf = (boxes: readonly Box[]): Box => ({
  south: Math.min(...boxes.map((b) => b.south)),
  north: Math.max(...boxes.map((b) => b.north)),
  west: Math.min(...boxes.map((b) => b.west)),
  east: Math.max(...boxes.map((b) => b.east)),
})

const centre = (box: Box) => ({
  latitude: (box.south + box.north) / 2,
  longitude: (box.west + box.east) / 2,
})

/** ~25 m: two road pieces that meet at a corner have boxes that touch, not overlap. */
const TOUCH_DEG = 0.00025
/** Above this, the corner is too vague to be "the" corner. */
export const MAX_INTERSECTION_M = 400
/** Two candidate corners further apart than this: the town repeats the street. */
export const MAX_AMBIGUITY_M = 500
/**
 * A street whose every piece fits in this is short enough to stand for the
 * shop: its centre is at most ~150 m from any door on it.
 */
export const MAX_STREET_SPAN_M = 300
/**
 * Pieces of a street closer than this to one another are the same street
 * going on. Further than this from every piece that reaches the corner, a
 * piece is the same NAME somewhere else: another village, or another barrio
 * numbered on its own.
 */
export const MAX_SAME_STREET_GAP_M = 1000
/**
 * Rule 3 only. A cross street that exists in the municipality but no closer
 * than this to the short street says the address is somewhere else.
 */
export const MAX_CROSS_DISTANCE_M = 150
/**
 * Results asked per query (Nominatim's maximum): enough pieces of a long
 * street to find the corner. An answer this long may have been cut, so it
 * does not prove we saw every piece of the street.
 */
export const NOMINATIM_LIMIT = 40

// ---------------------------------------------------------- settlements

/**
 * The fields that name a place smaller than the municipality. A piece of
 * "Calle 4" in the village of San Andrés carries `village: "San Andrés"` next
 * to `town: "Tello"`; a piece in Tello itself usually carries neither.
 *
 * The field ALONE proves nothing: Nominatim fills it with the nearest place
 * node, and the whole seat of Anzoátegui reads `hamlet: "La Camelia"`. It only
 * means something when it DIFFERS between the pieces of one answer — then the
 * street name exists in more than one settlement.
 */
const SETTLEMENT_FIELDS = ['village', 'hamlet'] as const

/**
 * "Perímetro Urbano Santa Marta", "Casco urbano de Chía": the hit is inside
 * the seat's own outline, whatever hamlet node happens to be nearest. (A bare
 * `city: "Cartagena de Indias"` is the whole municipality and says nothing.)
 */
const URBAN_OUTLINE = /^(?:perimetro|casco) urbano\b/

/** Lowercase words and digits only: for finding a place name inside free text. */
function words(value: string): string {
  return clean(value)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The villages or hamlets a hit says it is in; none for the seat. A "village"
 * named like the municipality IS the seat (Prado), a name that is only filler
 * ("Centro") names nothing, and the seat's outline overrides both.
 */
function settlementsOf(hit: NominatimHit, target: GeocodeTarget): string[] {
  if (URBAN_OUTLINE.test(clean(hit.address.city ?? ''))) return []
  const town = placeKey(target.municipality)
  return SETTLEMENT_FIELDS.flatMap((field) => {
    const value = hit.address[field]
    if (value === undefined) return []
    const key = placeKey(value)
    return key === '' || key === town ? [] : [words(value)]
  })
}

type Scope =
  | {
      ok: true
      /** The pieces of the street in the settlement the shop is taken to be in. */
      pieces: NominatimHit[]
      /** The shop's own text names that settlement. */
      named: boolean
      /** Every piece carries the same hamlet, and nothing says it is noise. */
      unconfirmedHamlet: boolean
    }
  | { ok: false; reason: string }

/**
 * PURE. Which pieces of the street are in the shop's settlement?
 *
 *   1. The shop names a village of this municipality ("Ísimo Santa Marta
 *      Bonda"): only the pieces in that village. None there → not found.
 *   2. The pieces (of the street and of its cross street) are spread over
 *      different settlements: only the ones in the seat. A shop that does not
 *      name a village is not assumed to be in one — "Ísimo Tello" was drawn in
 *      San Andrés, 13 km from Tello, because only there OSM names Carrera 6.
 *      The seat is the pieces with no village on them, plus the ones next to
 *      those: inside a town a few blocks read `hamlet: "San Pedro"` (Chía)
 *      only because that place node is the nearest one.
 *   3. Every piece says the same (nothing, or the same hamlet): the field
 *      tells nothing apart, so all of them.
 */
function settlementScope(
  target: GeocodeTarget,
  known: readonly NominatimHit[],
  streetPieces: readonly NominatimHit[],
  crossPieces: readonly NominatimHit[],
): Scope {
  const hints = (target.hints ?? []).map(words)
  const named = new Set(
    known
      .flatMap((hit) => settlementsOf(hit, target))
      .filter((name) => hints.some((hint) => wordIn(name, hint))),
  )
  if (named.size > 0) {
    const pieces = streetPieces.filter((hit) =>
      settlementsOf(hit, target).some((name) => named.has(name)),
    )
    return pieces.length === 0
      ? { ok: false, reason: 'calle no encontrada en el poblado que nombra la tienda' }
      : { ok: true, pieces, named: true, unconfirmedHamlet: false }
  }

  const both = [...streetPieces, ...crossPieces]
  const untagged = both.filter((hit) => settlementsOf(hit, target).length === 0).map(boxOf)
  const distinct = new Set(both.map((hit) => settlementsOf(hit, target).join('|')))
  if (distinct.size <= 1) {
    const unconfirmedHamlet = untagged.length === 0
    return { ok: true, pieces: [...streetPieces], named: false, unconfirmedHamlet }
  }

  const seat = streetPieces.filter((hit) => {
    const box = boxOf(hit)
    return untagged.some((other) => gapM(other, box) <= MAX_SAME_STREET_GAP_M)
  })
  return seat.length === 0
    ? { ok: false, reason: 'la calle solo aparece en un poblado que la tienda no nombra' }
    : { ok: true, pieces: seat, named: false, unconfirmedHamlet: false }
}

/**
 * PURE. Is every piece the street going on from `seeds`? Pieces are chained
 * while the gap to one already reached is at most MAX_SAME_STREET_GAP_M.
 */
function isOneStreet(seeds: ReadonlySet<NominatimHit>, pieces: readonly NominatimHit[]): boolean {
  const reached = new Set(seeds)
  let pending = pieces.filter((hit) => !reached.has(hit))
  for (let grew = true; grew && pending.length > 0;) {
    grew = false
    const next: NominatimHit[] = []
    for (const hit of pending) {
      const box = boxOf(hit)
      const near = [...reached].some((r) => gapM(boxOf(r), box) <= MAX_SAME_STREET_GAP_M)
      if (near) {
        reached.add(hit)
        grew = true
      } else {
        next.push(hit)
      }
    }
    pending = next
  }
  return pending.length === 0
}

// ------------------------------------------------------ acceptance rule

export type GeocodePrecision = 'address' | 'intersection' | 'street'

export type GeocodeResult =
  | { ok: true; latitude: number; longitude: number; precision: GeocodePrecision }
  | { ok: false; reason: string }

const TOO_LONG = 'solo la calle, demasiado larga para ubicar'

/**
 * PURE — the acceptance rule. Takes what Nominatim answered to
 * addressQuery() and crossQuery() and decides whether any of it is a
 * confident location for the shop. Tested against saved responses.
 *
 * `addressTruncated`: the address answer was cut at the result limit, so it
 * may not hold every piece of the street. The geocoder knows it from the raw
 * answer; by default it is read off the number of hits.
 */
export function resolveLocation(
  target: GeocodeTarget,
  addressHits: readonly NominatimHit[],
  crossHits: readonly NominatimHit[],
  addressTruncated: boolean = addressHits.length >= NOMINATIM_LIMIT,
): GeocodeResult {
  const local = (hit: NominatimHit) => isInColombia(hit.lat, hit.lon) && inMunicipality(hit, target)
  const { street, cross } = target.address

  // 1. A house or building on our street, numbered from our cross street. A
  // bus stop or a shop elsewhere on Carrera 80 is on the right street and
  // kilometres from Calle 50: without the house number it proves nothing.
  const numbered = addressHits.flatMap((hit) => {
    const road = hit.address.road
    if (hit.place_rank < 30 || !local(hit) || road === undefined || !isStreet(road, street)) {
      return []
    }
    const match = matchHouseNumber(hit.address.house_number, cross, target.address.plate)
    return match === null ? [] : [{ hit, match }]
  })
  const building = (numbered.find((n) => n.match === 'exact') ?? numbered[0])?.hit
  if (building !== undefined) {
    return { ok: true, latitude: building.lat, longitude: building.lon, precision: 'address' }
  }

  const pieces = (hits: readonly NominatimHit[], s: Street) =>
    hits.filter((hit) => {
      const name = roadName(hit)
      return hit.category === 'highway' && name !== null && local(hit) && isStreet(name, s)
    })

  const everyStreetPiece = pieces(addressHits, street)
  if (everyStreetPiece.length === 0) {
    const anyLocal = addressHits.some(local)
    return {
      ok: false,
      reason:
        addressHits.length === 0
          ? 'sin resultado'
          : anyLocal
            ? 'calle no encontrada'
            : 'otro municipio',
    }
  }
  const crossPieces = cross === null ? [] : pieces(crossHits, cross)

  // The street may exist in the seat and in a village: keep one settlement.
  const scope = settlementScope(
    target,
    [...addressHits, ...crossHits].filter(local),
    everyStreetPiece,
    crossPieces,
  )
  if (!scope.ok) return scope

  // 2. The corner with the cross street.
  const corners: Box[] = []
  const atCorner = new Set<NominatimHit>()
  for (const a of scope.pieces) {
    for (const b of crossPieces) {
      const boxA = boxOf(a)
      const boxB = boxOf(b)
      const box: Box = {
        south: Math.max(boxA.south, boxB.south) - TOUCH_DEG,
        north: Math.min(boxA.north, boxB.north) + TOUCH_DEG,
        west: Math.max(boxA.west, boxB.west) - TOUCH_DEG,
        east: Math.min(boxA.east, boxB.east) + TOUCH_DEG,
      }
      if (box.south <= box.north && box.west <= box.east && diagonalM(box) <= MAX_INTERSECTION_M) {
        corners.push(box)
        atCorner.add(a)
      }
    }
  }
  if (corners.length > 0) {
    const all = unionOf(corners)
    if (diagonalM(all) > MAX_AMBIGUITY_M) return { ok: false, reason: 'esquina ambigua' }

    // One corner is not enough when the street's NAME also exists far from
    // it: that other place may have the same cross street, unnamed in OSM,
    // and nothing says which of the two the address means. A city is the
    // exception — one numbering grid, where a long street comes back in
    // loose fragments (and cut at the limit) and still meets its cross street
    // only once; its villages were told apart above.
    const town = placeKey(target.municipality)
    const isCity = everyStreetPiece.some(
      (hit) => hit.address.city !== undefined && placeKey(hit.address.city) === town,
    )
    if ((scope.named || !isCity) && !isOneStreet(atCorner, scope.pieces)) {
      return { ok: false, reason: 'la calle se repite en otro lugar del municipio' }
    }
    return { ok: true, ...centre(all), precision: 'intersection' }
  }

  // 3. A very short street — the weakest evidence: one name and nothing that
  // confirms it, so every doubt refuses.
  // The answer may have been cut: there may be pieces we never saw, and the
  // span would be a guess.
  if (addressTruncated) return { ok: false, reason: TOO_LONG }
  // Every piece in the municipality counts, also the ones in another
  // settlement: unless the shop names its village, the street must be one.
  const lone = scope.named ? scope.pieces : everyStreetPiece
  const span = unionOf(lone.map(boxOf))
  if (diagonalM(span) > MAX_STREET_SPAN_M) return { ok: false, reason: TOO_LONG }
  // A hamlet the shop does not name. Here the field cannot be waved away as
  // noise, because nothing else places the street: "Ísimo Saladoblanco" sat
  // in La Cabaña, 10 km from Saladoblanco.
  if (scope.unconfirmedHamlet) {
    return { ok: false, reason: 'calle corta en un poblado que la tienda no nombra' }
  }
  // The cross street exists, and not here: the address is where it is.
  if (
    crossPieces.length > 0 &&
    crossPieces.every((hit) => gapM(span, boxOf(hit)) > MAX_CROSS_DISTANCE_M)
  ) {
    return { ok: false, reason: 'el cruce existe, pero lejos de la calle' }
  }
  return { ok: true, ...centre(span), precision: 'street' }
}

// ------------------------------------------------------------- network

export const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
/** Policy: absolute maximum 1 request/s. A margin on top. */
export const NOMINATIM_INTERVAL_MS = 1100
/** OSM improves; an old answer (or old silence) is asked again after this. */
const CACHE_TTL_MS = 180 * 24 * 60 * 60 * 1000

/**
 * `truncated` was added later: an entry without it is read by its length (see
 * isTruncated), so a cache written before the flag stays valid.
 */
const cacheSchema = z.record(
  z.string(),
  z.object({
    at: z.string(),
    hits: z.array(nominatimHitSchema),
    truncated: z.boolean().optional(),
  }),
)

type CacheEntry = z.infer<typeof cacheSchema>[string]

/**
 * The two request shapes. The shape is part of the cache key: an answer
 * obtained with other parameters is not an answer to this request.
 *
 * - `every` (`dedupe=0`): every piece of the street. By default Nominatim
 *   folds same-named ways into one hit, so a street "that fits in 300 m" could
 *   be one piece of a longer one. This is the request always made.
 * - `folded` (Nominatim's default): one hit per distinct place. Only asked
 *   when `every` came back cut at the limit — a long city street, where 40
 *   unfolded pieces cover a few barrios and the folded answer covers the
 *   whole street (measured 2026-10-04: for Carrera 80 in Medellín the 40
 *   unfolded pieces held only 6 of the 18 folded ones).
 */
type RequestShape = 'every' | 'folded'

/** `folded` keeps the key of the runs before `dedupe=0`: it is that same request. */
const cacheKey = (shape: RequestShape, limit: number, query: string): string =>
  shape === 'every' ? `${limit}|dedupe=0|${query}` : `${limit}|${query}`

/**
 * Was the answer cut at the limit? Known from the RAW answer: 40 results of
 * which one was unreadable leave 39 hits, which look complete and are not.
 * Entries cached before the flag existed only have the hits to go by.
 */
const isTruncated = (entry: CacheEntry, limit: number): boolean =>
  entry.truncated ?? entry.hits.length >= limit

const hitKey = (hit: NominatimHit): string =>
  `${hit.lat}|${hit.lon}|${hit.category}|${hit.name ?? ''}|${hit.boundingbox.join(',')}`

export type GeocodeAnswer = {
  hits: NominatimHit[]
  /** Nominatim had more than it returned: `hits` is not every piece of the street. */
  truncated: boolean
}

export type Geocoder = {
  /**
   * Hits for a free-text query, from cache or Nominatim. Null when the request
   * was dropped.
   */
  search(query: string): Promise<GeocodeAnswer | null>
  /** Writes the cache to disk. Call once at the end (and it is safe to call more). */
  flush(): Promise<void>
  readonly stats: { cached: number; requested: number }
}

export async function createNominatimGeocoder(options: {
  ctx: PoliteContext
  cachePath: string
  /** Results per query. Defaults to NOMINATIM_LIMIT, which the 'street' rule assumes. */
  limit?: number
}): Promise<Geocoder> {
  const limit = options.limit ?? NOMINATIM_LIMIT
  let cache: Record<string, CacheEntry> = {}
  let text: string | null = null
  try {
    text = await readFile(options.cachePath, 'utf8')
  } catch {
    // No cache yet: start empty.
  }
  if (text !== null) {
    // The file is input like any other: a truncated write or a hand edit must
    // not feed the acceptance rule. It is only a cache, so it is thrown away.
    let json: unknown = null
    try {
      json = JSON.parse(text)
    } catch {
      // Falls through to the shape check below.
    }
    const parsed = cacheSchema.safeParse(json)
    if (parsed.success) cache = parsed.data
    else console.warn(`  cache de geocodificacion ilegible, se descarta: ${options.cachePath}`)
  }

  let lastRequestAt = 0
  let dirty = false
  const stats = { cached: 0, requested: 0 }
  // Same politeness for retries: back off from at least the policy interval.
  const ctx: PoliteContext = {
    ...options.ctx,
    delayMs: Math.max(options.ctx.delayMs, NOMINATIM_INTERVAL_MS),
  }

  /** One request shape for one query, from cache or the network. */
  async function ask(query: string, shape: RequestShape): Promise<GeocodeAnswer | null> {
    const key = cacheKey(shape, limit, query)
    const entry = cache[key]
    if (entry !== undefined && Date.now() - Date.parse(entry.at) < CACHE_TTL_MS) {
      stats.cached += 1
      return { hits: entry.hits, truncated: isTruncated(entry, limit) }
    }

    const wait = lastRequestAt + NOMINATIM_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait)
    const params = new URLSearchParams({
      format: 'jsonv2',
      countrycodes: 'co',
      addressdetails: '1',
      limit: String(limit),
      ...(shape === 'every' ? { dedupe: '0' } : {}),
      q: query,
    })
    const body = await fetchJson(`${NOMINATIM_URL}?${params}`, ctx)
    lastRequestAt = Date.now()
    stats.requested += 1
    if (body === null) return null

    const parsed = z.array(z.unknown()).safeParse(body)
    if (!parsed.success) {
      ctx.onRequestDropped?.(query, 'respuesta de Nominatim sin lista')
      return null
    }
    // A hit we cannot read is dropped alone; the rest still count.
    const hits = parsed.data.flatMap((raw) => {
      const hit = nominatimHitSchema.safeParse(raw)
      return hit.success ? [hit.data] : []
    })
    const truncated = parsed.data.length >= limit
    cache[key] = { at: new Date().toISOString(), hits, truncated }
    dirty = true
    return { hits, truncated }
  }

  return {
    stats,

    async search(query) {
      const every = await ask(query, 'every')
      if (every === null || !every.truncated) return every

      // Cut at the limit: add the folded view, which reaches further along a
      // long street. The union is still not the whole street, and says so.
      const folded = await ask(query, 'folded')
      if (folded === null) return every
      const seen = new Set(every.hits.map(hitKey))
      return {
        hits: [...every.hits, ...folded.hits.filter((hit) => !seen.has(hitKey(hit)))],
        truncated: true,
      }
    },

    async flush() {
      if (!dirty) return
      await mkdir(options.cachePath.replace(/[\\/][^\\/]*$/, ''), { recursive: true })
      await writeFile(options.cachePath, JSON.stringify(cache))
      dirty = false
    },
  }
}
