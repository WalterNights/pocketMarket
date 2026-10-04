import {
  ARRIVAL_RADIUS_M,
  hasArrived,
  haversineM,
  MIN_REROUTE_INTERVAL_MS,
  prepareRoute,
  progressAlong,
  shouldReroute,
} from './navigation'

// A route going straight north along a meridian in Bogotá: 0.009° of
// latitude is ~1 km, so the arithmetic is easy to check.
const START: [number, number] = [-74.05, 4.67]
const MIDDLE: [number, number] = [-74.05, 4.6745]
const END: [number, number] = [-74.05, 4.679]
const ROUTE = prepareRoute({
  coordinates: [START, MIDDLE, END],
  distanceM: 1000,
  durationS: 720, // 12 min for 1 km on foot
})

const at = (lat: number, lng = -74.05) => ({ latitude: lat, longitude: lng })

describe('haversineM', () => {
  it('0,009° de latitud son ~1 km', () => {
    expect(haversineM(at(4.67), at(4.679))).toBeGreaterThan(995)
    expect(haversineM(at(4.67), at(4.679))).toBeLessThan(1005)
  })
})

describe('prepareRoute', () => {
  it('lo que falta desde cada vértice se calcula una vez, de atrás hacia delante', () => {
    expect(ROUTE.tail).toHaveLength(3)
    expect(ROUTE.tail[2]).toBe(0)
    expect(ROUTE.tail[1]).toBeGreaterThan(495)
    expect(ROUTE.tail[1]).toBeLessThan(505)
    expect(ROUTE.tail[0]).toBeGreaterThan(995)
  })
})

describe('progressAlong', () => {
  it('al salir falta toda la ruta y todo el tiempo', () => {
    const p = progressAlong(at(4.67), ROUTE)
    expect(p.remainingM).toBeGreaterThan(990)
    expect(p.remainingS).toBeGreaterThan(710)
    expect(p.offRouteM).toBe(0)
    expect(p.segment).toBe(0)
  })

  it('a mitad de camino falta la mitad, al mismo ritmo que dio el servicio', () => {
    const p = progressAlong(at(4.676), ROUTE)
    expect(p.remainingM).toBeGreaterThan(325)
    expect(p.remainingM).toBeLessThan(345)
    expect(p.segment).toBe(1)
  })

  it('a unos metros de la línea sigue en la ruta; lejos, se sale', () => {
    // 0.0002° of longitude is ~22 m at this latitude.
    expect(progressAlong(at(4.672, -74.0498), ROUTE).offRouteM).toBeLessThan(30)
    // 0.001° is ~110 m.
    expect(progressAlong(at(4.672, -74.049), ROUTE).offRouteM).toBeGreaterThan(100)
  })

  it('en una ruta de ida y vuelta por la misma calle no salta al regreso', () => {
    // North 1 km, then back south 500 m along the same street.
    const outAndBack = prepareRoute({
      coordinates: [START, END, MIDDLE],
      distanceM: 1500,
      durationS: 1080,
    })
    // On the way out, at 300 m: still ~1.2 km to go, not the ~200 m of the
    // return leg that passes through the same point.
    const goingOut = progressAlong(at(4.6727), outAndBack)
    expect(goingOut.segment).toBe(0)
    expect(goingOut.remainingM).toBeGreaterThan(1150)

    // Coming back, having passed the turn: the earlier leg is not searched.
    const comingBack = progressAlong(at(4.677), outAndBack, 1)
    expect(comingBack.segment).toBe(1)
    expect(comingBack.remainingM).toBeLessThan(300)
  })

  it('si se aleja del tramo actual, busca en toda la ruta (pudo dar la vuelta)', () => {
    // Matched to the second segment, but now back near the start.
    const p = progressAlong(at(4.6705), ROUTE, 1)
    expect(p.segment).toBe(0)
    expect(p.offRouteM).toBe(0)
  })
})

describe('hasArrived', () => {
  const shop = at(4.679)

  it(`a menos de ${ARRIVAL_RADIUS_M} m de la tienda, llegó`, () => {
    expect(hasArrived(at(4.6789), shop)).toBe(true)
  })

  it('lejos de la tienda no ha llegado, haya ruta o no', () => {
    expect(hasArrived(at(4.6745), shop)).toBe(false)
  })
})

describe('shouldReroute', () => {
  const now = 1_000_000

  it('un solo punto fuera es ruido del GPS, no un desvío', () => {
    expect(shouldReroute([10, 12, 80], 0, now)).toBe(false)
  })

  it('tres lecturas seguidas fuera piden ruta nueva', () => {
    expect(shouldReroute([10, 70, 80, 95], 0, now)).toBe(true)
  })

  it('nunca más de una vez cada 30 s, aunque siga fuera', () => {
    expect(shouldReroute([70, 80, 95], now - MIN_REROUTE_INTERVAL_MS + 1000, now)).toBe(false)
  })
})
