import { readFile, writeFile } from 'node:fs/promises'

import responses from '../adapters/__fixtures__/branches/nominatim-responses.json'
import settlements from '../adapters/__fixtures__/branches/nominatim-settlements.json'
import {
  addressQuery,
  createNominatimGeocoder,
  crossQuery,
  inMunicipality,
  isDepartment,
  isStreet,
  matchHouseNumber,
  MAX_SAME_STREET_GAP_M,
  MAX_STREET_SPAN_M,
  NOMINATIM_LIMIT,
  nominatimHitSchema,
  parseColombianAddress,
  placeKey,
  resolveLocation,
  streetLabel,
  type GeocodeTarget,
} from './geocode'

// Real Nominatim answers captured 2026-10-04, keyed by the query that
// produced them ("dedupe=0|..." when asked with that parameter).
// Data © OpenStreetMap contributors, ODbL 1.0.
const hits = (query: keyof typeof responses) =>
  (responses[query] as unknown[]).map((raw) => nominatimHitSchema.parse(raw))

// The cache file lives in memory here: no test reads or writes the real one.
// (jest.mock is hoisted: what the factory uses must be named mock*.)
const mockDisk = new Map<string, string>()
jest.mock('node:fs/promises', () => ({
  mkdir: () => Promise.resolve(undefined),
  readFile: (path: string) => {
    const content = mockDisk.get(path)
    return content === undefined
      ? Promise.reject(new Error(`ENOENT: ${path}`))
      : Promise.resolve(content)
  },
  writeFile: (path: string, data: string) => {
    mockDisk.set(path, data)
    return Promise.resolve()
  },
}))

// Answers of the run of 2026-10-04 as the geocoder's cache keeps them (only
// the fields the rule reads), all asked with dedupe=0 and none cut at the
// limit. Keyed by query. Data © OpenStreetMap contributors, ODbL 1.0.
const cached = (query: keyof typeof settlements) =>
  (settlements[query] as unknown[]).map((raw) => nominatimHitSchema.parse(raw))

function target(
  address: string,
  municipality: string,
  department: string | null,
  title?: string,
): GeocodeTarget {
  const parsed = parseColombianAddress(address)
  if (parsed === null) throw new Error(`no se pudo leer ${address}`)
  const hints = title === undefined ? [address] : [title, address]
  return { address: parsed, municipality, department, hints }
}

describe('parseColombianAddress', () => {
  const read = (raw: string) => {
    const p = parseColombianAddress(raw)
    return p === null
      ? null
      : [streetLabel(p.street), p.cross === null ? null : streetLabel(p.cross), p.plate]
  }

  it.each([
    ['Cra 80 # 50-87', ['Carrera 80', 'Calle 50', '87']],
    ['Cl 27A Sur #47-61', ['Calle 27A Sur', 'Carrera 47', '61']],
    ['CLL 34C 118 13', ['Calle 34C', 'Carrera 118', '13']],
    ['Calle 37 Sur Nº 40-48', ['Calle 37 Sur', 'Carrera 40', '48']],
    ['KR 34 # 16 A SUR - 241', ['Carrera 34', 'Calle 16A Sur', '241']],
    ['AK 19 # 137 - 36', ['Carrera 19', 'Calle 137', '36']],
    ['Diagonal 7 No 14B – 20', ['Diagonal 7', 'Carrera 14B', '20']],
    ['Carrera 14 N.145-22 SALADO IBAGUE', ['Carrera 14', 'Calle 145', '22']],
    ['CRA 3 N° 79 – 30 – Manzana N', ['Carrera 3', 'Calle 79', '30']],
    ['Carrera 6 Bis # 12-30', ['Carrera 6 Bis', 'Calle 12', '30']],
    ['Cl. 118 #19', ['Calle 118', 'Carrera 19', null]],
    // The quadrant after the plate belongs to the calle: Calle 52G is another
    // street, kilometres north of Calle 52G Sur.
    ['CARRERA 33 No. 52G 38 SUR', ['Carrera 33', 'Calle 52G Sur', '38']],
    ['CARRERA 87 C # 71 A 10 SUR', ['Carrera 87C', 'Calle 71A Sur', '10']],
    ['Calle 5 # 3-20 Sur', ['Calle 5 Sur', 'Carrera 3', '20']],
    ['Calle 10 # 5-51 Este', ['Calle 10', 'Carrera 5 Este', '51']],
    ['Calle 8 # 24 – 11 CENTRO', ['Calle 8', 'Carrera 24', '11']],
    ['AVENIDA 51N # 156-158', ['Avenida 51N', null, null]],
  ])('%s', (raw, expected) => {
    expect(read(raw)).toEqual(expected)
  })

  it('sin tipo de vía no hay dirección que geocodificar', () => {
    expect(parseColombianAddress('Urbanización Modelia Manzana 61 Casas 6, 7 y 8')).toBeNull()
    expect(parseColombianAddress('Mall Río del Este')).toBeNull()
  })

  it('arma las consultas sin tildes en el lugar: Nominatim no encuentra "Medellín" con tilde', () => {
    const t = target('Cra 80 # 50-87', 'MEDELLÍN', 'ANTIOQUIA')
    expect(addressQuery(t)).toBe('Carrera 80 50-87, Medellin, Antioquia')
    expect(crossQuery(t)).toBe('Calle 50, Medellin, Antioquia')
  })
})

describe('nombres de lugar y de vía', () => {
  it('placeKey iguala las variantes de un mismo municipio', () => {
    expect(placeKey('BOGOTA D.C')).toBe('bogota')
    expect(placeKey('Bogotá ciudad')).toBe('bogota')
    expect(placeKey('Perímetro Urbano Medellín')).toBe('medellin')
  })

  it('isDepartment distingue un departamento de un municipio', () => {
    expect(isDepartment('CUNDINAMARCA')).toBe(true)
    expect(isDepartment('Valle del Cauca')).toBe(true)
    expect(isDepartment('MADRID')).toBe(false)
  })

  it('Bogotá es una ciudad: tratarla como departamento descartaba todas sus tiendas', () => {
    expect(isDepartment('BOGOTÁ')).toBe(false)
    expect(isDepartment('BOGOTA D.C.')).toBe(false)
  })

  it('isStreet: "Avenida 80" es la Carrera 80, pero la 80A o la 80 Sur son otras', () => {
    const carrera80 = { type: 'carrera', number: '80', suffix: null } as const
    expect(isStreet('Carrera 80', carrera80)).toBe(true)
    expect(isStreet('Avenida 80', carrera80)).toBe(true)
    expect(isStreet('Avenida Carrera 80', carrera80)).toBe(true)
    expect(isStreet('Carrera 80A', carrera80)).toBe(false)
    expect(isStreet('Carrera 80 Sur', carrera80)).toBe(false)
    expect(isStreet('Calle 80', carrera80)).toBe(false)
    expect(isStreet('Calle 34 C', { type: 'calle', number: '34c', suffix: null })).toBe(true)
  })
})

describe('resolveLocation (regla de aceptación, respuestas reales)', () => {
  it('un edificio con la calle y el municipio correctos es precisión de dirección', () => {
    const t = target('Cl 27A Sur #47-61', 'Envigado', 'Antioquia')
    const query = 'Calle 27A Sur 47-61, Envigado, Antioquia'
    expect(resolveLocation(t, hits(query), [])).toEqual({
      ok: true,
      latitude: 6.1810803,
      longitude: -75.5868351,
      precision: 'address',
    })
  })

  // OSM tiene el supermercado de esa dirección en (6.26406, -75.59671): la
  // esquina calculada queda a ~120 m.
  it('en una ciudad grande, la esquina de la calle y su cruce ubica la tienda', () => {
    const t = target('Cra 80 # 50-87', 'Medellín', 'Antioquia')
    const result = resolveLocation(
      t,
      hits('Carrera 80 50-87, Medellin, Antioquia'),
      hits('Calle 50, Antioquia'),
    )
    expect(result).toMatchObject({ ok: true, precision: 'intersection' })
    if (result.ok) {
      expect(result.latitude).toBeCloseTo(6.264, 2)
      expect(result.longitude).toBeCloseTo(-75.597, 2)
    }
  })

  it('solo la calle, sin esquina, en una ciudad no basta', () => {
    const t = target('Cra 80 # 50-87', 'Medellín', 'Antioquia')
    expect(resolveLocation(t, hits('Carrera 80 50-87, Medellin, Antioquia'), [])).toEqual({
      ok: false,
      reason: 'solo la calle, demasiado larga para ubicar',
    })
  })

  it('un resultado de otro municipio se rechaza', () => {
    const t = target('Calle 8 # 24-11 CENTRO', 'IBAGUÉ', 'TOLIMA')
    expect(
      resolveLocation(t, hits('Calle 8, Melgar, Tolima'), hits('Carrera 24, Melgar, Tolima')),
    ).toEqual({ ok: false, reason: 'otro municipio' })
  })

  it('dos esquinas candidatas lejos entre sí: ambigua, se rechaza', () => {
    const t = target('Carrera 8 #7-76C', 'CHAPARRAL', 'TOLIMA')
    expect(
      resolveLocation(t, hits('Carrera 8, Chaparral, Tolima'), hits('Calle 7, Chaparral, Tolima')),
    ).toEqual({ ok: false, reason: 'esquina ambigua' })
  })

  it('sin respuesta no hay ubicación', () => {
    const t = target('Cra 80 # 50-87', 'Medellín', 'Antioquia')
    expect(resolveLocation(t, [], [])).toEqual({ ok: false, reason: 'sin resultado' })
  })
})

describe('regla 1: el número de casa tiene que nombrar el cruce', () => {
  const calle50 = { type: 'calle', number: '50', suffix: null } as const

  it('lee los formatos de OSM: "50-87", "# 50 - 87", "50 87"', () => {
    expect(matchHouseNumber('50-87', calle50, '87')).toBe('exact')
    expect(matchHouseNumber('# 50 - 87', calle50, '87')).toBe('exact')
    expect(matchHouseNumber('50 87', calle50, '87')).toBe('exact')
    expect(matchHouseNumber('50-12', calle50, '87')).toBe('cross')
    expect(matchHouseNumber('17C-13', { type: 'carrera', number: '17c', suffix: null }, '13')).toBe(
      'exact',
    )
  })

  it('otro cruce, un número suelto o ningún número no dicen nada', () => {
    expect(matchHouseNumber('22-54', calle50, '87')).toBeNull()
    expect(matchHouseNumber('50A-87', calle50, '87')).toBeNull()
    expect(matchHouseNumber('87', calle50, '87')).toBeNull()
    expect(matchHouseNumber('50', calle50, '87')).toBeNull()
    expect(matchHouseNumber(undefined, calle50, '87')).toBeNull()
    expect(matchHouseNumber('50-87', null, null)).toBeNull()
    // Calle 50 Sur is another street, kilometres from Calle 50.
    expect(matchHouseNumber('50 Sur - 87', calle50, '87')).toBeNull()
    expect(matchHouseNumber('50-87', { ...calle50, suffix: 'sur' }, '87')).toBeNull()
  })

  it('la tienda que OSM ya tiene, con su placa ("17C-13", "44 52"), es precisión de dirección', () => {
    expect(
      resolveLocation(
        target('Calle 48 # 17C-13', 'SOLEDAD', 'ATLÁNTICO'),
        hits('Calle 48 17C-13, Soledad, Atlantico'),
        [],
      ),
    ).toMatchObject({ ok: true, precision: 'address' })
    expect(
      resolveLocation(
        target('Calle 82 # 44-52', 'BARRANQUILLA', 'ATLÁNTICO'),
        hits('Calle 82 44-52, Barranquilla, Atlantico'),
        [],
      ),
    ).toMatchObject({ ok: true, precision: 'address' })
  })

  // The answer has a café at "Calle 42 # 22-54". It is on the right street and
  // 28 blocks from Carrera 50: it used to be accepted as the shop's address.
  it('un local en la misma calle pero en otro cruce NO es la dirección', () => {
    const t = target('Calle 42 # 50-10', 'BOGOTÁ D.C.', null)
    expect(resolveLocation(t, hits('Calle 42, Bogota'), [])).toEqual({
      ok: false,
      reason: 'solo la calle, demasiado larga para ubicar',
    })
  })

  it('el mismo local sí ubica una dirección de su misma cuadra', () => {
    const t = target('Calle 42 # 22-30', 'BOGOTÁ D.C.', null)
    expect(resolveLocation(t, hits('Calle 42, Bogota'), [])).toEqual({
      ok: true,
      latitude: 4.6325899,
      longitude: -74.0746713,
      precision: 'address',
    })
  })

  // Derived from the real café hit: two doors of the same block.
  it('entre dos locales de la cuadra gana el de la placa exacta, no el primero', () => {
    const cafe = hits('Calle 42, Bogota').find((hit) => hit.place_rank >= 30)
    if (cafe === undefined) throw new Error('falta el café en la fixture')
    const other = { ...cafe, lat: 4.6326, address: { ...cafe.address, house_number: '22 - 30' } }
    const t = target('Calle 42 # 22-30', 'BOGOTÁ D.C.', null)
    expect(resolveLocation(t, [cafe, other], [])).toMatchObject({ ok: true, latitude: 4.6326 })
  })
})

describe('regla 3: solo una calle muy corta', () => {
  it('el tope es 300 m: el centro queda a lo sumo a ~150 m de cualquier puerta', () => {
    expect(MAX_STREET_SPAN_M).toBe(300)
  })

  // The only piece of "Avenida Carrera 33" the answer has, ~110 m long.
  it('una calle de 110 m ubica la tienda cuando nada la contradice', () => {
    const t = target('Carrera 33 # 52G-38', 'BOGOTÁ D.C.', null)
    const result = resolveLocation(t, cached('Carrera 33 52G-38, Bogota'), [])
    expect(result).toMatchObject({ ok: true, precision: 'street' })
    if (result.ok) {
      expect(result.latitude).toBeCloseTo(4.5896, 3)
      expect(result.longitude).toBeCloseTo(-74.1219, 3)
    }
  })

  // "Ísimo Gaitán": the one piece of Transversal 13 is 240 m long, and Calle
  // 35B has four pieces in Ibagué, the nearest 500 m away. It was accepted.
  it('si el cruce existe pero lejos de la calle, la calle no es la de la tienda', () => {
    const t = target('Transversal 13 # 35B-28 LOTE 14', 'IBAGUÉ', 'TOLIMA')
    const address = cached('Transversal 13 35B-28, Ibague, Tolima')
    expect(resolveLocation(t, address, [])).toMatchObject({ ok: true, precision: 'street' })
    expect(resolveLocation(t, address, cached('Calle 35B, Ibague, Tolima'))).toEqual({
      ok: false,
      reason: 'el cruce existe, pero lejos de la calle',
    })
  })

  // "Ísimo Saladoblanco" sat on this street: 140 m long, in the hamlet of La
  // Cabaña, 10 km from Saladoblanco. Nothing else places it, so the hamlet
  // cannot be taken for noise.
  it('una calle corta en un caserío que la tienda no nombra se rechaza', () => {
    const t = target('Calle 2 # 6-67 BARRIO CENTRO', 'SALADOBLANCO', 'HUILA', 'SALADOBLANCO')
    const address = cached('Calle 2 6-67, Saladoblanco, Huila')
    const expected = { ok: false, reason: 'calle corta en un poblado que la tienda no nombra' }
    expect(resolveLocation(t, address, [])).toEqual(expected)
    expect(resolveLocation(t, address, cached('Carrera 6, Saladoblanco, Huila'))).toEqual(expected)
  })

  it('la misma calle sí vale si la tienda nombra ese caserío', () => {
    const t = target('Calle 2 # 6-67', 'SALADOBLANCO', 'HUILA', 'ISIMO LA CABAÑA')
    expect(resolveLocation(t, cached('Calle 2 6-67, Saladoblanco, Huila'), [])).toMatchObject({
      ok: true,
      precision: 'street',
    })
  })

  // Six pieces of Carrera 4 across Tabio, ~700 m: it passed under the 1 km rule.
  it('una calle de pueblo de más de 300 m ya no basta sin la esquina', () => {
    const t = target('Carrera 4 # 5-21', 'TABIO', 'CUNDINAMARCA')
    expect(resolveLocation(t, hits('dedupe=0|Carrera 4 5-21, Tabio, Cundinamarca'), [])).toEqual({
      ok: false,
      reason: 'solo la calle, demasiado larga para ubicar',
    })
  })

  it('con el cruce, esa misma tienda queda en su esquina', () => {
    const t = target('Carrera 4 # 5-21', 'TABIO', 'CUNDINAMARCA')
    const result = resolveLocation(
      t,
      hits('dedupe=0|Carrera 4 5-21, Tabio, Cundinamarca'),
      hits('dedupe=0|Calle 5, Tabio, Cundinamarca'),
    )
    expect(result).toMatchObject({ ok: true, precision: 'intersection' })
    if (result.ok) {
      expect(result.latitude).toBeCloseTo(4.9167, 3)
      expect(result.longitude).toBeCloseTo(-74.0982, 3)
    }
  })

  // Derived: the real 140 m piece repeated until the answer is as long as the limit.
  it('una respuesta cortada en el límite no prueba que se vio toda la calle', () => {
    const t = target('Calle 2 # 6-67', 'SALADOBLANCO', 'HUILA')
    const [piece] = hits('Calle 2 6-67, Saladoblanco, Huila')
    if (piece === undefined) throw new Error('fixture vacía')
    const cut = Array.from({ length: NOMINATIM_LIMIT }, () => piece)
    expect(resolveLocation(t, cut, [])).toEqual({
      ok: false,
      reason: 'solo la calle, demasiado larga para ubicar',
    })
  })

  // 40 results with one unreadable leave 39 hits: the count looks complete.
  it('lo cortado lo dice el geocodificador, no el número de hits legibles', () => {
    const t = target('Carrera 33 # 52G-38', 'BOGOTÁ D.C.', null)
    const address = cached('Carrera 33 52G-38, Bogota')
    expect(resolveLocation(t, address, [], false)).toMatchObject({ ok: true })
    expect(resolveLocation(t, address, [], true)).toEqual({
      ok: false,
      reason: 'solo la calle, demasiado larga para ubicar',
    })
  })
})

describe('poblados: un municipio no es un solo pueblo', () => {
  // Calle 4 exists in Tello and in its village San Andrés, 13 km away; only in
  // San Andrés does OSM name Carrera 6. The shop was drawn there.
  it('Tello: la esquina está en una vereda y la calle también existe en la cabecera', () => {
    const t = target('Calle 4 # 6-57 PORTADA', 'TELLO', 'HUILA', 'ISIMO TELLO')
    const result = resolveLocation(
      t,
      cached('Calle 4 6-57, Tello, Huila'),
      cached('Carrera 6, Tello, Huila'),
    )
    expect(result).toEqual({ ok: false, reason: 'solo la calle, demasiado larga para ubicar' })
  })

  it('esa misma esquina vale para una tienda que nombra la vereda', () => {
    const t = target('Calle 4 # 6-57', 'TELLO', 'HUILA', 'ISIMO SAN ANDRÉS')
    const result = resolveLocation(
      t,
      cached('Calle 4 6-57, Tello, Huila'),
      cached('Carrera 6, Tello, Huila'),
    )
    expect(result).toMatchObject({ ok: true, precision: 'intersection' })
    if (result.ok) {
      expect(result.latitude).toBeCloseTo(3.0476, 3)
      expect(result.longitude).toBeCloseTo(-75.0164, 3)
    }
  })

  // Carrera 4 is only named in the village of La Garita; Calle 28 only in Los
  // Patios itself, 10 km north. The short-street rule took the village.
  it('Los Patios: la calle solo aparece en una vereda y el cruce solo en la cabecera', () => {
    const t = target('CRA 4 # 28-53', 'LOS PATIOS', 'NORTE DE SANTANDER', 'ISIMO LOS PATIOS CENTRO')
    const result = resolveLocation(
      t,
      cached('Carrera 4 28-53, Los Patios, Norte De Santander'),
      cached('Calle 28, Los Patios, Norte De Santander'),
    )
    expect(result).toEqual({
      ok: false,
      reason: 'la calle solo aparece en un poblado que la tienda no nombra',
    })
  })

  // Calle 2 × Carrera 7 only meet in Pontezuela, 15 km from the city, which
  // has three more pieces of Calle 2.
  it('Cartagena: una esquina en un corregimiento no ubica una tienda de la ciudad', () => {
    const t = target('Calle 2 No. 7 – 100', 'CARTAGENA', 'BOLÍVAR', 'ISIMO FRANCO SAN MARTIN')
    const result = resolveLocation(
      t,
      cached('Calle 2 7-100, Cartagena, Bolivar'),
      cached('Carrera 7, Cartagena, Bolivar'),
    )
    expect(result).toEqual({ ok: false, reason: 'solo la calle, demasiado larga para ubicar' })
  })

  // Calle 5 exists in the city (two barrios) and in Bonda, Minca, Taganga and
  // Don Diego. The title says which.
  it('Santa Marta Bonda: el título nombra el corregimiento y la esquina es la de allí', () => {
    const address = cached('Calle 5 19-62, Santa Marta, Magdalena')
    const crossHits = cached('Carrera 19, Santa Marta, Magdalena')
    const t = target('Calle 5 # 19 – 62', 'SANTA MARTA', 'MAGDALENA', 'ISIMO SANTA MARTA BONDA')
    const result = resolveLocation(t, address, crossHits)
    expect(result).toMatchObject({ ok: true, precision: 'intersection' })
    if (result.ok) {
      expect(result.latitude).toBeCloseTo(11.234, 3)
      expect(result.longitude).toBeCloseTo(-74.1247, 3)
    }

    // Without the name it is a shop of the city, where the two do not meet.
    const unnamed = target('Calle 5 # 19 – 62', 'SANTA MARTA', 'MAGDALENA', 'ISIMO SANTA MARTA')
    expect(resolveLocation(unnamed, address, crossHits)).toMatchObject({ ok: false })
  })

  it('una tienda que nombra un poblado donde la calle no aparece no se ubica en otro', () => {
    const t = target('Calle 2 No. 7 – 100', 'CARTAGENA', 'BOLÍVAR', 'ISIMO BAYUNCA')
    const result = resolveLocation(
      t,
      cached('Calle 2 7-100, Cartagena, Bolivar'),
      cached('Carrera 7, Cartagena, Bolivar'),
    )
    expect(result).toEqual({
      ok: false,
      reason: 'calle no encontrada en el poblado que nombra la tienda',
    })
  })

  // The field alone is noise: every street of these two seats carries the
  // nearest hamlet or village, and both shops are where they should be.
  it.each([
    [
      'Carrera 3 No. 11-02',
      'ANZOÁTEGUI',
      'Carrera 3 11-02, Anzoategui, Tolima',
      'Calle 11, Anzoategui, Tolima',
      4.6317,
      -75.0943,
    ],
    [
      'Calle 6 6-10, BARRIO CENTRO',
      'PALOCABILDO',
      'Calle 6 6-10, Palocabildo, Tolima',
      'Carrera 6, Palocabildo, Tolima',
      5.1209,
      -75.0215,
    ],
  ] as const)(
    'un caserío en TODAS las piezas no dice nada: %s, %s',
    (address, town, addressQ, crossQ, latitude, longitude) => {
      const t = target(address, town, 'TOLIMA', `ISIMO ${town}`)
      const result = resolveLocation(t, cached(addressQ), cached(crossQ))
      expect(result).toMatchObject({ ok: true, precision: 'intersection' })
      if (result.ok) {
        expect(result.latitude).toBeCloseTo(latitude, 3)
        expect(result.longitude).toBeCloseTo(longitude, 3)
      }
    },
  )

  // Calle 21 reads `hamlet: "San Pedro"` and half of Carrera 6 does not; all
  // of them read `city: "Casco urbano de Chía"`.
  it('dentro del casco urbano el caserío más cercano no cuenta', () => {
    const t = target('Calle 21 # 6-30', 'CHIA', 'CUNDINAMARCA', 'ISIMO CHIA CHILACOS')
    const result = resolveLocation(
      t,
      cached('Calle 21 6-30, Chia, Cundinamarca'),
      cached('Carrera 6, Chia, Cundinamarca'),
    )
    expect(result).toMatchObject({ ok: true, precision: 'intersection' })
  })

  it('el tope para seguir siendo la misma calle es 1 km', () => {
    expect(MAX_SAME_STREET_GAP_M).toBe(1000)
  })

  // Carrera 3 × Calle 13 meet once, in the east of Mosquera. The other twelve
  // pieces of Carrera 3 are 3 to 6 km west, in the old town, which has its own
  // Calle 13 too. No field tells the two apart.
  it('Mosquera: la calle se repite a kilómetros de la esquina y nada dice cuál es', () => {
    const t = target(
      'Carrera 3 No. 13 – 12 local # 1',
      'MOSQUERA',
      'CUNDINAMARCA',
      'ISIMO EL TREBOL',
    )
    const result = resolveLocation(
      t,
      cached('Carrera 3 13-12, Mosquera, Cundinamarca'),
      cached('Calle 13, Mosquera, Cundinamarca'),
    )
    expect(result).toEqual({
      ok: false,
      reason: 'la calle se repite en otro lugar del municipio',
    })
  })

  // Calle 70C comes back in 12 loose pieces, one of them 6 km from the corner.
  // A city has one grid: that is the street itself, not another one.
  it('en una ciudad, piezas lejanas de la calle son la misma calle', () => {
    const t = target('CALLE 70C # 26B – 23', 'BARRANQUILLA', 'ATLÁNTICO', 'ISIMO LA 70 C')
    const result = resolveLocation(
      t,
      cached('Calle 70C 26B-23, Barranquilla, Atlantico'),
      cached('Carrera 26B, Barranquilla, Atlantico'),
    )
    expect(result).toMatchObject({ ok: true, precision: 'intersection' })
  })
})

describe('inMunicipality: el municipio tiene que ser igual, no parecido', () => {
  const anywhere = parseColombianAddress('Calle 1 # 1-1')
  const town = (municipality: string, department: string | null): GeocodeTarget => {
    if (anywhere === null) throw new Error('direccion de prueba ilegible')
    return { address: anywhere, municipality, department }
  }

  // Derived from a real Medellín hit: only the barrio's name is changed.
  it('"Bello" no es el barrio "Bello Horizonte" de Medellín', () => {
    const [real] = hits('Carrera 80 50-87, Medellin, Antioquia')
    if (real === undefined) throw new Error('fixture vacía')
    const hit = { ...real, address: { ...real.address, suburb: 'Bello Horizonte' } }
    expect(inMunicipality(hit, town('BELLO', 'ANTIOQUIA'))).toBe(false)
    expect(inMunicipality(hit, town('MEDELLÍN', 'ANTIOQUIA'))).toBe(true)
  })

  it('"Perímetro Urbano Medellín", "Bogotá ciudad" y "BOGOTÁ D.C." siguen casando', () => {
    for (const hit of hits('Carrera 80 50-87, Medellin, Antioquia')) {
      expect(inMunicipality(hit, town('Medellin', 'Antioquia'))).toBe(true)
    }
    // The same answer brings Calle 42 of Soacha, Sincelejo and Cúcuta.
    const calle42 = hits('Calle 42, Bogota')
    const inBogota = calle42.filter((hit) => inMunicipality(hit, town('BOGOTÁ D.C.', null)))
    expect(inBogota).toHaveLength(11)
    expect(inBogota.every((hit) => hit.address.city === 'Bogotá ciudad')).toBe(true)
    expect(calle42.length - inBogota.length).toBe(4)
  })

  it('un municipio que Nominatim solo da en "county" sigue casando', () => {
    const florencia = hits('Calle 2 19A-18, Florencia, Caqueta')
    const onlyCounty = florencia.filter(
      (hit) => hit.address.city === undefined && hit.address.town === undefined,
    )
    expect(onlyCounty.length).toBeGreaterThan(0)
    for (const hit of onlyCounty) {
      expect(hit.address.county).toBe('Florencia')
      expect(inMunicipality(hit, town('FLORENCIA', 'CAQUETÁ'))).toBe(true)
    }
  })

  it('el mismo municipio en otro departamento se rechaza', () => {
    const [hit] = hits('Calle 2 19A-18, Florencia, Caqueta')
    if (hit === undefined) throw new Error('fixture vacía')
    expect(inMunicipality(hit, town('FLORENCIA', 'CAUCA'))).toBe(false)
  })

  // The hit's state is "Norte de Santander", which CONTAINS "Santander".
  it('el departamento tiene que ser igual: Santander no es Norte de Santander', () => {
    const [hit] = cached('Calle 28, Los Patios, Norte De Santander')
    if (hit === undefined) throw new Error('fixture vacía')
    expect(hit.address.state).toBe('Norte de Santander')
    expect(inMunicipality(hit, town('LOS PATIOS', 'NORTE DE SANTANDER'))).toBe(true)
    expect(inMunicipality(hit, town('LOS PATIOS', 'SANTANDER'))).toBe(false)
  })

  // Derived from the same hit: only the state is changed.
  it('ni Cauca es Valle del Cauca; San Andrés sí es su archipiélago', () => {
    const [real] = cached('Calle 28, Los Patios, Norte De Santander')
    if (real === undefined) throw new Error('fixture vacía')
    const inState = (state: string) => ({ ...real, address: { ...real.address, state } })
    expect(inMunicipality(inState('Valle del Cauca'), town('LOS PATIOS', 'CAUCA'))).toBe(false)
    expect(inMunicipality(inState('Valle del Cauca'), town('LOS PATIOS', 'VALLE DEL CAUCA'))).toBe(
      true,
    )
    const islands = 'Archipiélago de San Andrés, Providencia y Santa Catalina'
    expect(inMunicipality(inState(islands), town('LOS PATIOS', 'SAN ANDRÉS'))).toBe(true)
  })

  // The source's "town" is a vereda of San Luis: OSM names it only as
  // city_district "Vereda Payandé". Not provably the place, so it is skipped.
  it('una vereda que OSM no da como municipio se rechaza', () => {
    const t = target('Carrera 5 # 9-18', 'PAYANDÉ', 'TOLIMA')
    expect(resolveLocation(t, hits('Carrera 5 9-18, Payande, Tolima'), [])).toEqual({
      ok: false,
      reason: 'otro municipio',
    })
  })
})

describe('geocodificador (sin red)', () => {
  const ctx = { userAgent: 'PocketMarket/test (x@y.z)', delayMs: 0 }
  const melgar = responses['Calle 8, Melgar, Tolima']
  const cachePath = 'ingestion/.cache/geocode.json'

  const answer = (...bodies: unknown[]) => {
    const spy = jest.spyOn(globalThis, 'fetch')
    for (const body of bodies) {
      spy.mockImplementationOnce(() =>
        Promise.resolve(new Response(JSON.stringify(body), { status: 200 })),
      )
    }
    return spy
  }

  afterEach(() => {
    jest.restoreAllMocks()
    mockDisk.clear()
  })

  it('pide a Nominatim con el User-Agent del contexto y no repite una consulta ya hecha', async () => {
    const spy = answer(melgar)
    const geocoder = await createNominatimGeocoder({ ctx, cachePath })

    const first = await geocoder.search('Calle 8, Melgar, Tolima')
    const second = await geocoder.search('Calle 8, Melgar, Tolima')

    expect(first?.hits).toHaveLength(5)
    expect(first?.truncated).toBe(false)
    expect(second).toEqual(first)
    expect(spy).toHaveBeenCalledTimes(1)
    const [url, init] = spy.mock.calls[0] ?? []
    expect(String(url)).toContain('countrycodes=co')
    expect(String(url)).toContain('dedupe=0')
    expect((init?.headers as Record<string, string>)['User-Agent']).toBe(
      'PocketMarket/test (x@y.z)',
    )
    expect(geocoder.stats).toEqual({ cached: 1, requested: 1 })
  })

  it('una respuesta guardada sin dedupe=0 no responde a la consulta nueva', async () => {
    const at = new Date().toISOString()
    await writeFile(cachePath, JSON.stringify({ '40|Calle 8, Melgar, Tolima': { at, hits: [] } }))
    const spy = answer(melgar)
    const geocoder = await createNominatimGeocoder({ ctx, cachePath })

    expect((await geocoder.search('Calle 8, Melgar, Tolima'))?.hits).toHaveLength(5)
    expect(spy).toHaveBeenCalledTimes(1)

    await geocoder.flush()
    const saved = JSON.parse(await readFile(cachePath, 'utf8')) as Record<string, unknown>
    expect(Object.keys(saved).sort()).toEqual([
      '40|Calle 8, Melgar, Tolima',
      '40|dedupe=0|Calle 8, Melgar, Tolima',
    ])

    // And what was just saved is read back by the next run, with no request.
    const again = await createNominatimGeocoder({ ctx, cachePath })
    expect((await again.search('Calle 8, Melgar, Tolima'))?.hits).toHaveLength(5)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['no es JSON', '{"40|dedupe=0|Calle 8, Melgar, Tolima": {"at": "2026-10-04T0'],
    ['otra forma', JSON.stringify({ '40|dedupe=0|Calle 8, Melgar, Tolima': { hits: 'x' } })],
    [
      'un hit sin coordenadas',
      JSON.stringify({
        '40|dedupe=0|Calle 8, Melgar, Tolima': {
          at: new Date().toISOString(),
          hits: [{ name: 'Calle 8' }],
        },
      }),
    ],
  ])('un caché ilegible (%s) se descarta con aviso y se empieza de cero', async (_, content) => {
    await writeFile(cachePath, content)
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const spy = answer(melgar)
    const geocoder = await createNominatimGeocoder({ ctx, cachePath })

    expect(warn).toHaveBeenCalledTimes(1)
    expect((await geocoder.search('Calle 8, Melgar, Tolima'))?.hits).toHaveLength(5)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('sin archivo de caché no hay aviso: es la primera corrida', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    await createNominatimGeocoder({ ctx, cachePath })
    expect(warn).not.toHaveBeenCalled()
  })

  // With limit 5 the 5 pieces of Calle 8 look cut. The second answer stands in
  // for the folded view of the same street.
  it('una respuesta cortada en el límite se completa con la vista sin dedupe=0', async () => {
    const spy = answer(melgar, responses['Carrera 24, Melgar, Tolima'])
    const geocoder = await createNominatimGeocoder({ ctx, cachePath, limit: 5 })

    const found = await geocoder.search('Calle 8, Melgar, Tolima')

    expect(spy).toHaveBeenCalledTimes(2)
    expect(String(spy.mock.calls[0]?.[0])).toContain('dedupe=0')
    expect(String(spy.mock.calls[1]?.[0])).not.toContain('dedupe')
    expect(found?.hits).toHaveLength(8)
    // The union is still not the whole street.
    expect(found?.truncated).toBe(true)

    // Both shapes are cached, each under its own key.
    expect((await geocoder.search('Calle 8, Melgar, Tolima'))?.hits).toHaveLength(8)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('el mismo hit en las dos vistas cuenta una vez', async () => {
    answer(melgar, melgar)
    const geocoder = await createNominatimGeocoder({ ctx, cachePath, limit: 5 })
    expect((await geocoder.search('Calle 8, Melgar, Tolima'))?.hits).toHaveLength(5)
  })

  // Five results, one of them unreadable: four hits, under the limit of five.
  // Counting hits, the answer looked complete and the folded view was skipped.
  it('lo cortado se mide en la respuesta cruda: un hit ilegible no la hace completa', async () => {
    const broken = [...melgar.slice(0, 4), { name: 'sin coordenadas' }]
    const spy = answer(broken, [])
    const geocoder = await createNominatimGeocoder({ ctx, cachePath, limit: 5 })

    const found = await geocoder.search('Calle 8, Melgar, Tolima')

    expect(found?.hits).toHaveLength(4)
    expect(found?.truncated).toBe(true)
    expect(spy).toHaveBeenCalledTimes(2)

    // The flag survives the cache: the next run knows it without counting.
    await geocoder.flush()
    const again = await createNominatimGeocoder({ ctx, cachePath, limit: 5 })
    expect((await again.search('Calle 8, Melgar, Tolima'))?.truncated).toBe(true)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  // Entries written before the flag existed: all there is to go by is the length.
  it('una entrada de caché sin la marca se lee por su longitud', async () => {
    const at = new Date().toISOString()
    const old = melgar.map((raw) => nominatimHitSchema.parse(raw))
    await writeFile(
      cachePath,
      JSON.stringify({
        '5|dedupe=0|Calle 8, Melgar, Tolima': { at, hits: old },
        '5|Calle 8, Melgar, Tolima': { at, hits: [] },
        '5|dedupe=0|Carrera 24, Melgar, Tolima': { at, hits: old.slice(0, 3) },
      }),
    )
    const spy = jest.spyOn(globalThis, 'fetch')
    const geocoder = await createNominatimGeocoder({ ctx, cachePath, limit: 5 })

    expect((await geocoder.search('Calle 8, Melgar, Tolima'))?.truncated).toBe(true)
    expect((await geocoder.search('Carrera 24, Melgar, Tolima'))?.truncated).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })
})
