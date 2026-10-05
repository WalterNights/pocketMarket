import { distanceLabel, freshnessLabel, isBrowsable, roundOrigin, type Store } from './store'

const baseStore: Store = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'exito',
  name: 'Éxito',
  sourceType: 'api',
  isActive: true,
  productCount: 10,
  lastUpdatedAt: '2026-09-23T10:00:00.000Z',
  nearestM: null,
}

const storeWith = (patch: Partial<Store>): Store => ({ ...baseStore, ...patch })

describe('isBrowsable', () => {
  it('una tienda activa con productos se puede explorar', () => {
    expect(isBrowsable(baseStore)).toBe(true)
  })

  it('una tienda sin adaptador construido todavía no', () => {
    expect(isBrowsable(storeWith({ isActive: false, productCount: 0 }))).toBe(false)
  })

  it('activa pero sin productos tampoco', () => {
    expect(isBrowsable(storeWith({ productCount: 0 }))).toBe(false)
  })
})

describe('freshnessLabel', () => {
  const now = new Date('2026-09-23T12:00:00.000Z')

  it('menos de una hora', () => {
    expect(freshnessLabel('2026-09-23T11:30:00.000Z', now)).toBe('Precios de hace un momento')
  })

  it('horas', () => {
    expect(freshnessLabel('2026-09-23T06:00:00.000Z', now)).toBe('Precios de hace 6 h')
  })

  it('ayer', () => {
    expect(freshnessLabel('2026-09-22T10:00:00.000Z', now)).toBe('Precios de ayer')
  })

  it('varios días', () => {
    expect(freshnessLabel('2026-09-20T10:00:00.000Z', now)).toBe('Precios de hace 3 días')
  })

  it('sin datos lo dice, no finge frescura', () => {
    expect(freshnessLabel(null, now)).toBe('Sin datos todavía')
    expect(freshnessLabel('no-es-una-fecha', now)).toBe('Sin datos todavía')
  })
})

describe('distanceLabel', () => {
  it('metros redondeados a centenas: el origen va ajustado a ~110 m', () => {
    expect(distanceLabel(120)).toBe('100 m')
    expect(distanceLabel(843)).toBe('800 m')
    expect(distanceLabel(150)).toBe('200 m')
  })

  it('por debajo de 100 m no finge una cifra', () => {
    expect(distanceLabel(0)).toBe('menos de 100 m')
    expect(distanceLabel(99)).toBe('menos de 100 m')
    expect(distanceLabel(100)).toBe('100 m')
  })

  it('casi un kilómetro se dice en kilómetros', () => {
    expect(distanceLabel(949)).toBe('900 m')
    expect(distanceLabel(950)).toBe('1,0 km')
    expect(distanceLabel(999)).toBe('1,0 km')
  })

  it('kilómetros con coma decimal por debajo de 10', () => {
    expect(distanceLabel(1200)).toBe('1,2 km')
    expect(distanceLabel(1234)).toBe('1,2 km')
  })

  it('kilómetros enteros desde 10', () => {
    expect(distanceLabel(9960)).toBe('10 km')
    expect(distanceLabel(24600)).toBe('25 km')
  })
})

describe('roundOrigin', () => {
  it('ajusta a una rejilla de 0,001°', () => {
    expect(roundOrigin({ latitude: 4.67662, longitude: -74.04823 })).toEqual({
      latitude: 4.677,
      longitude: -74.048,
    })
  })

  it('unos metros de ruido del GPS dan el mismo origen', () => {
    const a = roundOrigin({ latitude: 4.67662, longitude: -74.04823 })
    const b = roundOrigin({ latitude: 4.67668, longitude: -74.04817 })
    expect(a).toEqual(b)
  })

  it('el punto ajustado queda a media celda del real como mucho (~55 m por eje)', () => {
    const real = { latitude: 4.67662, longitude: -74.04823 }
    const snapped = roundOrigin(real)
    expect(Math.abs(snapped.latitude - real.latitude)).toBeLessThanOrEqual(0.0005 + 1e-9)
    expect(Math.abs(snapped.longitude - real.longitude)).toBeLessThanOrEqual(0.0005 + 1e-9)
  })

  it('sin restos de coma flotante', () => {
    expect(roundOrigin({ latitude: 4.7111, longitude: -74.0721 })).toEqual({
      latitude: 4.711,
      longitude: -74.072,
    })
  })
})
