import { collectBranches } from '../core/branch-pipeline'
import type { RawBranch } from '../core/branch-types'
import type { GeocodeAnswer } from '../core/geocode'
import isimoShops from './__fixtures__/branches/isimo-tiendas.json'
import responses from './__fixtures__/branches/nominatim-responses.json'
import { htmlToText, isimoBranchAdapter, shopName } from './isimo-branches'

// fetchBranches() must never touch the real cache file nor Nominatim from a
// test: the geocoder is replaced by one that answers from the saved responses
// and records what it was asked.
// (jest.mock is hoisted: what the factory uses must be named mock*.)
const mockAsked: string[] = []
jest.mock('../core/geocode', () => {
  const actual = jest.requireActual<typeof import('../core/geocode')>('../core/geocode')
  const mockResponses: Record<string, unknown[]> = {
    ...jest.requireActual<Record<string, unknown[]>>(
      './__fixtures__/branches/nominatim-responses.json',
    ),
    ...jest.requireActual<Record<string, unknown[]>>(
      './__fixtures__/branches/nominatim-settlements.json',
    ),
  }
  return {
    ...actual,
    createNominatimGeocoder: () =>
      Promise.resolve({
        stats: { cached: 0, requested: 0 },
        flush: () => Promise.resolve(),
        search: (query: string): Promise<GeocodeAnswer> => {
          mockAsked.push(query)
          const saved = mockResponses[query] ?? []
          return Promise.resolve({
            hits: saved.map((raw) => actual.nominatimHitSchema.parse(raw)),
            truncated: false,
          })
        },
      }),
  }
})

// Real WordPress records (captured 2026-10-04) plus what fetchBranches()
// attaches to them: their town and department names and what Nominatim
// answered (saved responses, © OpenStreetMap contributors, ODbL 1.0).

type Query = keyof typeof responses

function enriched(
  title: string,
  municipality: string | null,
  department: string | null,
  addressQuery?: Query,
  crossQuery?: Query,
): RawBranch {
  const shop = isimoShops.find((s) => s.title.rendered === title)
  if (shop === undefined) throw new Error(`falta ${title} en la fixture`)
  return {
    ...shop,
    municipality,
    department,
    geocode: {
      addressHits: addressQuery === undefined ? [] : responses[addressQuery],
      crossHits: crossQuery === undefined ? [] : responses[crossQuery],
    },
  }
}

describe('Ísimo', () => {
  it('con la calle y su cruce en el municipio correcto, la tienda entra', () => {
    const raw = enriched(
      'ISIMO EL CORAZÓN',
      'MEDELLIN',
      'ANTIOQUIA',
      'Calle 34C, Medellin, Antioquia',
      'Carrera 118, Medellin, Antioquia',
    )
    const result = isimoBranchAdapter.normalize(raw)
    expect(result).toMatchObject({
      status: 'ok',
      branch: {
        externalId: '2272',
        name: 'Ísimo El Corazón',
        address: 'CLL 34C 118 13',
        city: 'Medellin',
      },
    })
    if (result.status === 'ok') {
      expect(result.branch.latitude).toBeCloseTo(6.249, 2)
      expect(result.branch.longitude).toBeCloseTo(-75.63, 2)
    }
  })

  it('una geocodificación sin confianza se salta, no falla', () => {
    const raw = enriched(
      'MELGAR',
      'MELGAR',
      'TOLIMA',
      'Calle 8, Melgar, Tolima',
      'Carrera 24, Melgar, Tolima',
    )
    expect(isimoBranchAdapter.normalize(raw)).toEqual({
      status: 'skipped',
      reason: 'geocodificacion: solo la calle, demasiado larga para ubicar',
    })
  })

  it('una dirección sin calle ("Urbanización ... Manzana 61") se salta sin consultar', () => {
    const raw = enriched('ISIMO ESPINOSA', 'IBAGUÉ', 'TOLIMA')
    expect(isimoBranchAdapter.normalize(raw)).toEqual({
      status: 'skipped',
      reason: 'direccion sin formato de calle',
    })
  })

  // La fuente trae municipio "CUNDINAMARCA" y departamento "MADRID".
  it('municipio y departamento intercambiados se corrigen', () => {
    const raw = enriched('ISIMO HACIENDA MADRID', 'CUNDINAMARCA', 'MADRID')
    expect(isimoBranchAdapter.normalize(raw)).toEqual({
      status: 'skipped',
      reason: 'geocodificacion: sin resultado',
    })
  })

  describe('fetchBranches: cuándo se pregunta por el cruce', () => {
    // A real WordPress record with another shop's title, address and town:
    // the fixture has no shop whose street alone is short enough to be accepted.
    const shopAt = (address: string, title: string) => ({
      ...isimoShops[0],
      title: { rendered: title },
      content: { rendered: `<p>${address}</p>`, protected: false },
      'tiendas-municipios': [1],
      'tiendas-departamento': [2],
    })

    const sweep = async (address: string, town: string, department: string, title = 'ISIMO') => {
      mockAsked.length = 0
      const pages: unknown[] = [
        [{ id: 1, name: town }],
        [{ id: 2, name: department }],
        [shopAt(address, title)],
      ]
      jest
        .spyOn(globalThis, 'fetch')
        .mockImplementation(() =>
          Promise.resolve(new Response(JSON.stringify(pages.shift() ?? []), { status: 200 })),
        )
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const raws: RawBranch[] = []
      for await (const raw of isimoBranchAdapter.fetchBranches({ userAgent: 'test', delayMs: 0 })) {
        raws.push(raw)
      }
      return raws
    }

    afterEach(() => {
      jest.restoreAllMocks()
    })

    // The street alone is accepted ('street'), and the pin would sit mid-street:
    // the corner must still be asked for. Here it also changes the verdict:
    // Calle 35B exists in Ibagué, and nowhere near that street.
    it('una calle corta aceptada sin cruce NO ahorra la consulta del cruce', async () => {
      const raws = await sweep('Transversal 13 # 35B-28 LOTE 14', 'IBAGUÉ', 'TOLIMA')
      expect(mockAsked).toEqual([
        'Transversal 13 35B-28, Ibague, Tolima',
        'Calle 35B, Ibague, Tolima',
      ])
      expect(raws).toHaveLength(1)
      expect(isimoBranchAdapter.normalize(raws[0] ?? {})).toEqual({
        status: 'skipped',
        reason: 'geocodificacion: el cruce existe, pero lejos de la calle',
      })
    })

    // Calle 5 × Carrera 19 exists in the village of Bonda, 9 km from the city.
    // The title is what says the shop is there.
    it('el título de la tienda llega a la regla: con "Bonda" entra, sin él no', async () => {
      const named = await sweep(
        'Calle 5 # 19 &#8211; 62',
        'SANTA MARTA',
        'MAGDALENA',
        'ISIMO SANTA MARTA BONDA',
      )
      const result = isimoBranchAdapter.normalize(named[0] ?? {})
      expect(result).toMatchObject({
        status: 'ok',
        branch: { name: 'Ísimo Santa Marta Bonda', city: 'Santa Marta' },
      })
      if (result.status === 'ok') {
        expect(result.branch.latitude).toBeCloseTo(11.234, 3)
        expect(result.branch.longitude).toBeCloseTo(-74.1247, 3)
      }

      const unnamed = await sweep('Calle 5 # 19 &#8211; 62', 'SANTA MARTA', 'MAGDALENA')
      expect(isimoBranchAdapter.normalize(unnamed[0] ?? {}).status).toBe('skipped')
    })

    // The geocoder says the answer was cut; the record must carry it, because
    // normalize() cannot tell from 39 readable hits.
    it('lo cortado viaja en el registro hasta normalize()', async () => {
      const [raw] = await sweep('Carrera 33 # 52G-38', 'BOGOTÁ', 'BOGOTÁ D.C.')
      expect(raw).toMatchObject({ geocode: { addressTruncated: false } })
      expect(isimoBranchAdapter.normalize(raw ?? {}).status).toBe('ok')
      const cut = { ...raw, geocode: { ...(raw?.geocode as object), addressTruncated: true } }
      expect(isimoBranchAdapter.normalize(cut)).toEqual({
        status: 'skipped',
        reason: 'geocodificacion: solo la calle, demasiado larga para ubicar',
      })
    })

    it('un edificio con la placa del cruce sí la ahorra', async () => {
      const raws = await sweep('Calle 48 # 17C-13', 'SOLEDAD', 'ATLÁNTICO')
      expect(mockAsked).toEqual(['Calle 48 17C-13, Soledad, Atlantico'])
      expect(isimoBranchAdapter.normalize(raws[0] ?? {})).toMatchObject({
        status: 'ok',
        branch: { city: 'Soledad', latitude: 10.9162608, longitude: -74.7850227 },
      })
    })
  })

  describe('fetchBranches: municipios y departamentos, página a página', () => {
    const term = (id: number) => ({ id, name: `PUEBLO ${id}` })
    const page = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => term(from + i))

    const run = async (answers: Record<string, () => Response>) => {
      const urls: string[] = []
      jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
        const url = String(input)
        urls.push(url)
        const found = Object.entries(answers).find(([part]) => url.includes(part))
        return Promise.resolve(found === undefined ? Response.json([]) : found[1]())
      })
      jest.spyOn(console, 'warn').mockImplementation(() => undefined)
      const dropped: string[] = []
      const raws: RawBranch[] = []
      const ctx = {
        userAgent: 'test',
        delayMs: 0,
        onRequestDropped: (url: string) => dropped.push(url),
      }
      for await (const raw of isimoBranchAdapter.fetchBranches(ctx)) raws.push(raw)
      return { urls, raws, dropped }
    }

    // A shop of town 150: with a single page of 100 terms it had no town.
    const shop = { ...isimoShops[0], 'tiendas-municipios': [150], 'tiendas-departamento': [1] }

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('un municipio de la segunda página se encuentra', async () => {
      const { urls, raws } = await run({
        'tiendas-municipios?per_page=100&page=1&': () => Response.json(page(1, 100)),
        'tiendas-municipios?per_page=100&page=2&': () => Response.json(page(101, 60)),
        'tiendas-departamento?': () => Response.json([{ id: 1, name: 'TOLIMA' }]),
        'tiendas?per_page=100&page=1': () => Response.json([shop]),
      })
      expect(urls.filter((url) => url.includes('tiendas-municipios'))).toHaveLength(2)
      expect(urls.filter((url) => url.includes('tiendas-departamento'))).toHaveLength(1)
      expect(raws).toHaveLength(1)
      expect(raws[0]).toMatchObject({ municipality: 'PUEBLO 150', department: 'TOLIMA' })
    })

    it('justo 100 términos: el 400 de la página siguiente es el final, no un fallo', async () => {
      const { raws, dropped } = await run({
        'tiendas-municipios?per_page=100&page=1&': () => Response.json(page(51, 100)),
        'tiendas-municipios?per_page=100&page=2&': () => new Response('{}', { status: 400 }),
        'tiendas-departamento?': () => Response.json([{ id: 1, name: 'TOLIMA' }]),
        'tiendas?per_page=100&page=1': () => Response.json([shop]),
      })
      expect(dropped).toEqual([])
      expect(raws[0]).toMatchObject({ municipality: 'PUEBLO 150' })
    })

    // Half a list of towns would turn real shops into "municipio desconocido".
    it('si una página de municipios falla no se entrega ninguna tienda', async () => {
      const { urls, raws, dropped } = await run({
        'tiendas-municipios?per_page=100&page=1&': () => Response.json(page(1, 100)),
        'tiendas-municipios?per_page=100&page=2&': () => new Response('{}', { status: 404 }),
        'tiendas-departamento?': () => Response.json([{ id: 1, name: 'TOLIMA' }]),
        'tiendas?per_page=100&page=1': () => Response.json([shop]),
      })
      expect(raws).toEqual([])
      expect(dropped).toHaveLength(1)
      expect(urls.some((url) => url.includes('/tiendas?'))).toBe(false)
    })
  })

  it('un registro sin la forma de WordPress es ilegible', () => {
    const c = collectBranches([isimoBranchAdapter.normalize({ unexpected: true })])
    expect(c.failed).toBe(1)
  })

  it('limpia el HTML de WordPress y da nombre de cadena', () => {
    expect(htmlToText('<p>Calle 8 # 24 &#8211; 11 CENTRO</p>\n')).toBe('Calle 8 # 24 – 11 CENTRO')
    expect(htmlToText('&#8220;Transversal 7 sur 75&#8221;')).toBe('Transversal 7 sur 75')
    expect(shopName('ISIMO COLORADOS')).toBe('Ísimo Colorados')
    expect(shopName('RICAURTE CUNDINAMARCA')).toBe('Ísimo Ricaurte Cundinamarca')
  })
})
