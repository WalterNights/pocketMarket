import { branchSchema, distanceLabel, type Branch } from './branch'
import { boundsFor, branchesToGeoJSON, pointFeature } from './map-style'

describe('distanceLabel', () => {
  it('metros redondeados a decenas cerca', () => {
    expect(distanceLabel(843)).toBe('840 m')
    expect(distanceLabel(994)).toBe('990 m')
    expect(distanceLabel(999)).toBe('1,0 km')
  })

  it('nunca dice 0 m: la ubicación del teléfono no es tan precisa', () => {
    expect(distanceLabel(0)).toBe('10 m')
    expect(distanceLabel(3)).toBe('10 m')
  })

  it('un decimal con coma entre 1 y 10 km', () => {
    expect(distanceLabel(1000)).toBe('1,0 km')
    expect(distanceLabel(1234)).toBe('1,2 km')
    expect(distanceLabel(9949)).toBe('9,9 km')
  })

  it('kilómetros enteros desde 10 km', () => {
    expect(distanceLabel(10400)).toBe('10 km')
    expect(distanceLabel(24600)).toBe('25 km')
  })
})

describe('boundsFor', () => {
  const origin = { latitude: 4.6766, longitude: -74.0482 }

  it('sin sucursales, unos 2 km alrededor del usuario', () => {
    const [west, south, east, north] = boundsFor(origin, [])
    expect(north - south).toBeCloseTo(0.02)
    expect(east - west).toBeCloseTo(0.02)
    expect((north + south) / 2).toBeCloseTo(origin.latitude)
  })

  it('encuadra al usuario y a todas las sucursales, oeste-sur-este-norte', () => {
    expect(
      boundsFor(origin, [
        { latitude: 4.6, longitude: -74.1 },
        { latitude: 4.7, longitude: -74.0 },
      ]),
    ).toEqual([-74.1, 4.6, -74.0, 4.7])
  })
})

describe('GeoJSON para el mapa', () => {
  const branch: Branch = {
    id: '11111111-1111-4111-8111-111111111111',
    storeSlug: 'ara',
    storeName: 'Ara',
    hasPrices: false,
    name: 'Ara Chico Cra 15',
    address: null,
    city: 'Bogotá',
    latitude: 4.68,
    longitude: -74.05,
    distanceM: 597,
  }

  it('cada sucursal es un punto [lng, lat] con su cadena y si está seleccionada', () => {
    const geojson = branchesToGeoJSON([branch], branch.id)
    expect(geojson.features[0]?.geometry.coordinates).toEqual([-74.05, 4.68])
    expect(geojson.features[0]?.properties).toEqual({
      id: branch.id,
      chain: 'Ara',
      selected: true,
    })
    expect(branchesToGeoJSON([branch], null).features[0]?.properties.selected).toBe(false)
  })

  it('la posición del usuario es un único punto', () => {
    expect(pointFeature({ latitude: 4.6, longitude: -74.1 }).features).toHaveLength(1)
  })
})

describe('branchSchema', () => {
  const valid = {
    id: '11111111-1111-4111-8111-111111111111',
    storeSlug: 'd1',
    storeName: 'D1',
    hasPrices: false,
    name: 'D1 Chicó',
    address: null,
    city: 'Bogotá',
    latitude: 4.6766,
    longitude: -74.0482,
    distanceM: 180,
  }

  it('acepta una sucursal sin dirección', () => {
    expect(branchSchema.parse(valid)).toEqual(valid)
  })

  it('rechaza coordenadas imposibles y distancias con decimales', () => {
    expect(branchSchema.safeParse({ ...valid, latitude: 120 }).success).toBe(false)
    expect(branchSchema.safeParse({ ...valid, distanceM: 12.5 }).success).toBe(false)
  })
})
