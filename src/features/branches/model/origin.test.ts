import {
  cityOrigin,
  migrateOrigin,
  originLabel,
  shouldLocateOnActivate,
  type ActivationContext,
  type MapOrigin,
} from './origin'

describe('shouldLocateOnActivate', () => {
  const DEVICE: MapOrigin = { kind: 'device', coords: { latitude: 4.7, longitude: -74.05 } }
  const CITY: MapOrigin = {
    kind: 'city',
    code: 'BOG',
    coords: { latitude: 4.711, longitude: -74.0721 },
  }

  const context = (patch: Partial<ActivationContext>): ActivationContext => ({
    permissionGranted: true,
    atLaunch: false,
    showingAll: false,
    choseMeanwhile: false,
    origin: null,
    ...patch,
  })

  it('sin permiso nunca ubica: sería pedirlo', () => {
    expect(shouldLocateOnActivate(context({ permissionGranted: false, atLaunch: true }))).toBe(
      false,
    )
  })

  it('al arrancar, con permiso, el teléfono gana a la ciudad recordada', () => {
    expect(shouldLocateOnActivate(context({ atLaunch: true, origin: CITY }))).toBe(true)
    expect(shouldLocateOnActivate(context({ atLaunch: true }))).toBe(true)
  })

  it('después del arranque respeta la ciudad elegida en la sesión', () => {
    expect(shouldLocateOnActivate(context({ origin: CITY }))).toBe(false)
  })

  it('después del arranque refresca una posición del teléfono', () => {
    expect(shouldLocateOnActivate(context({ origin: DEVICE }))).toBe(true)
  })

  it('tras "Ver todas" no vuelve a ubicar al abrir el mapa', () => {
    expect(shouldLocateOnActivate(context({ showingAll: true }))).toBe(false)
  })

  it('"Ver todas" pulsado antes de que termine el arranque también se respeta', () => {
    expect(shouldLocateOnActivate(context({ showingAll: true, atLaunch: true }))).toBe(false)
  })

  it('una elección hecha mientras se consultaba el permiso manda', () => {
    expect(shouldLocateOnActivate(context({ atLaunch: true, choseMeanwhile: true }))).toBe(false)
  })
})

describe('migrateOrigin', () => {
  it('conserva un código de ciudad conocido', () => {
    expect(migrateOrigin({ cityCode: 'MDE' })).toEqual({ cityCode: 'MDE' })
  })

  it('una ciudad que ya no existe se olvida, no rompe el arranque', () => {
    expect(migrateOrigin({ cityCode: 'XYZ' })).toEqual({ cityCode: null })
  })

  it('lo ilegible se convierte en "sin ciudad"', () => {
    expect(migrateOrigin(null)).toEqual({ cityCode: null })
    expect(migrateOrigin('BOG')).toEqual({ cityCode: null })
    expect(migrateOrigin({ city: 'BOG' })).toEqual({ cityCode: null })
    expect(migrateOrigin({ cityCode: 42 })).toEqual({ cityCode: null })
  })

  it('nunca resucita una posición guardada por error', () => {
    expect(migrateOrigin({ cityCode: null, coords: { latitude: 4.7, longitude: -74 } })).toEqual({
      cityCode: null,
    })
  })
})

describe('cityOrigin', () => {
  it('da el centro de la ciudad', () => {
    expect(cityOrigin('BOG')).toEqual({
      kind: 'city',
      code: 'BOG',
      coords: { latitude: 4.711, longitude: -74.0721 },
    })
  })

  it('sin código o con uno desconocido no hay origen', () => {
    expect(cityOrigin(null)).toBeNull()
    expect(cityOrigin('XYZ')).toBeNull()
  })
})

describe('originLabel', () => {
  it('la ubicación del teléfono', () => {
    expect(originLabel({ kind: 'device', coords: { latitude: 4.7, longitude: -74 } })).toBe(
      'Cerca de ti',
    )
  })

  it('una ciudad, por su nombre', () => {
    const medellin = cityOrigin('MDE')
    expect(medellin && originLabel(medellin)).toBe('Cerca de Medellín')
  })
})
