import {
  abortReason,
  branchRetireSkipReason,
  collectBranches,
  mayRetire,
} from '../core/branch-pipeline'
import { isInColombia, tidyName, type RawBranch } from '../core/branch-types'
import { gridAround, METRO_AREAS, nationalGrid } from '../core/colombia-grid'
import araStores from './__fixtures__/branches/ara-stores.json'
import d1Page from './__fixtures__/branches/d1-pickup-points.json'
import dollarcityPage from './__fixtures__/branches/dollarcity-locations.json'
import exitoPage from './__fixtures__/branches/exito-pickup-points.json'
import { araBranchAdapter, collapseRepeats } from './ara-branches'
import { d1BranchAdapter } from './d1-branches'
import { dollarcityBranchAdapter } from './dollarcity-branches'
import { exitoBranchAdapter } from './exito-branches'
import { sweepPickupPoints } from './vtex-pickup-points'

// Real responses captured on 2026-10-04. When a source changes its format,
// these fail and say what changed (rules/ingestion.md, "Fixtures obligatorias").

const exitoRaw = exitoPage.items.map((item) => item.pickupPoint as RawBranch)
const d1Raw = d1Page.items.map((item) => item.pickupPoint as RawBranch)

describe('Ara', () => {
  it('normaliza la fuente real sin ilegibles', () => {
    const c = collectBranches(araStores.map((s) => araBranchAdapter.normalize(s)))
    expect(c.failed).toBe(0)
    expect(c.branches).toHaveLength(araStores.length)
  })

  it('las coordenadas en texto se vuelven números, y el nombre deja solo la tienda', () => {
    const result = araBranchAdapter.normalize(araStores[0] as RawBranch)
    expect(result).toEqual({
      status: 'ok',
      branch: {
        externalId: '202',
        name: 'Ara Cajica Cra 6',
        address: 'Carrera 6 # 1 - 90 Lote 3',
        city: 'Cajica',
        latitude: 4.91526,
        longitude: -74.0268,
      },
    })
  })

  it('quita las palabras que la fuente repite', () => {
    expect(collapseRepeats('Chico Cra Cra 15')).toBe('Chico Cra 15')
    expect(collapseRepeats('San Patricio Patricio 2 Usaquen')).toBe('San Patricio 2 Usaquen')
    expect(collapseRepeats('Plaza de Mercado')).toBe('Plaza de Mercado')
  })

  it('una tienda inactiva o sin coordenadas se salta; sin código es ilegible', () => {
    const base = araStores[0] as RawBranch
    expect(araBranchAdapter.normalize({ ...base, status: '0' }).status).toBe('skipped')
    expect(araBranchAdapter.normalize({ ...base, latitude: '' }).status).toBe('skipped')
    expect(araBranchAdapter.normalize({ ...base, store_code: undefined }).status).toBe('failed')
  })
})

describe('Éxito', () => {
  it('cada tienda llega con dos ids y queda una sola por número', () => {
    const c = collectBranches(exitoRaw.map((raw) => exitoBranchAdapter.normalize(raw)))
    const chapinero = c.branches.filter((b) => b.name === 'Éxito Chapinero')

    expect(c.failed).toBe(0)
    expect(chapinero).toHaveLength(1)
    expect(chapinero[0]?.externalId).toBe('94')
    expect(c.duplicates).toBeGreaterThan(10)
  })

  it('las coordenadas vienen [lng, lat] y se leen en ese orden', () => {
    const result = exitoBranchAdapter.normalize(exitoRaw[0] as RawBranch)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.branch.latitude).toBeCloseTo(4.63964)
      expect(result.branch.longitude).toBeCloseTo(-74.06712)
    }
  })

  it('ni Carulla ni los puntos de recogida son tiendas Éxito', () => {
    const base = exitoRaw[0] as RawBranch
    expect(
      exitoBranchAdapter.normalize({ ...base, friendlyName: 'Carulla Calle 140' }).status,
    ).toBe('skipped')
    expect(
      exitoBranchAdapter.normalize({ ...base, friendlyName: 'Punto Exito Locker' }).status,
    ).toBe('skipped')
  })
})

describe('D1', () => {
  it('quita el código de ciudad y pone el nombre de la cadena', () => {
    const result = d1BranchAdapter.normalize(d1Raw[0] as RawBranch)
    expect(result).toMatchObject({
      status: 'ok',
      branch: { externalId: '1_6A330091', name: 'D1 Benjamin Herrera', city: 'Bogota' },
    })
  })

  it('la página real se lee entera', () => {
    const c = collectBranches(d1Raw.map((raw) => d1BranchAdapter.normalize(raw)))
    expect(c.failed).toBe(0)
    expect(c.branches.length).toBe(d1Raw.length)
  })
})

describe('Dollarcity', () => {
  it('lee la página real y el GeoJSON [lng, lat]', () => {
    const raws = dollarcityPage.StoreLocations as RawBranch[]
    const c = collectBranches(raws.map((raw) => dollarcityBranchAdapter.normalize(raw)))
    expect(c.failed).toBe(0)
    expect(c.branches[0]).toMatchObject({ name: 'Dollarcity Icarus Soacha' })
    expect(c.branches[0]?.latitude).toBeCloseTo(4.579861)
  })

  it('una tienda cerrada se salta', () => {
    const raw = dollarcityPage.StoreLocations[0] as RawBranch
    const closed = { ...raw, ExtraData: { ...(raw.ExtraData as object), BusinessStatus: 2 } }
    expect(dollarcityBranchAdapter.normalize(closed).status).toBe('skipped')
  })
})

describe('pipeline de sucursales', () => {
  it('aborta si más del 20% es ilegible, no por los saltados', () => {
    const skipped = { status: 'skipped', reason: 'x' } as const
    const failed = { status: 'failed', reason: 'y' } as const
    expect(abortReason(collectBranches([skipped, skipped, skipped]))).toBeNull()
    expect(abortReason(collectBranches([failed, skipped, skipped, skipped]))).toMatch(/25%/)
    expect(abortReason(collectBranches([]))).toMatch(/nada/)
  })

  it('no retira tiendas si "desaparecieron" demasiadas: la fuente respondió a medias', () => {
    expect(mayRetire(1000, 20)).toBe(true)
    expect(mayRetire(1000, 250)).toBe(true)
    expect(mayRetire(500, 400)).toBe(false)
  })

  it('no retira nada si se perdió alguna petición: el barrido tiene huecos', () => {
    expect(branchRetireSkipReason({ requestsDropped: 0, found: 1000, missing: 5 })).toBeNull()
    expect(branchRetireSkipReason({ requestsDropped: 1, found: 1000, missing: 5 })).toMatch(
      /huecos/,
    )
    expect(branchRetireSkipReason({ requestsDropped: 0, found: 500, missing: 400 })).toMatch(
      /demasiadas/,
    )
  })
})

describe('barrido de pickup points (sin red)', () => {
  const point = { label: 'Bogotá', latitude: 4.65, longitude: -74.07 }
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  async function sweep(responses: Response[]) {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const spy = jest.spyOn(globalThis, 'fetch')
    for (const r of responses) spy.mockResolvedValueOnce(r)

    const saturated: string[] = []
    const dropped: string[] = []
    const yielded: RawBranch[] = []
    for await (const raw of sweepPickupPoints('https://x.test', [point], {
      userAgent: 'test',
      delayMs: 0,
      onSaturated: (label) => saturated.push(label),
      onRequestDropped: (url) => dropped.push(url),
    })) {
      yielded.push(raw)
    }
    return { saturated, dropped, yielded, calls: spy.mock.calls.length }
  }

  // La página real de D1 dice total 300, pages 6: el punto está en el tope.
  // Antes, el "if (page >= pages) break" salía antes de mirarlo y el aviso
  // nunca saltaba.
  it('reporta el punto saturado aunque la paginación termine justo en el tope', async () => {
    const lastPage = { ...d1Page, paging: { ...d1Page.paging, page: 6 } }
    const pages = [d1Page, d1Page, d1Page, d1Page, d1Page, lastPage].map((p) => json(p))
    const result = await sweep(pages)
    expect(result.saturated).toEqual(['Bogotá'])
    expect(result.calls).toBe(6)
    expect(result.dropped).toEqual([])
  })

  it('un punto con pocas tiendas no está saturado', async () => {
    const small = { paging: { page: 1, pages: 1, total: 3 }, items: d1Page.items.slice(0, 3) }
    const result = await sweep([json(small)])
    expect(result.saturated).toEqual([])
    expect(result.yielded).toHaveLength(3)
  })

  it('una petición perdida se reporta al contexto y el barrido sigue', async () => {
    const result = await sweep([json({}, 404)])
    expect(result.dropped).toHaveLength(1)
    expect(result.yielded).toEqual([])
  })

  it('una respuesta sin items se cuenta como perdida; una vacía, no', async () => {
    expect((await sweep([json({ unexpected: true })])).dropped).toHaveLength(1)
    expect((await sweep([json({ paging: { total: 0 } })])).dropped).toEqual([])
  })
})

describe('utilidades', () => {
  it('isInColombia descarta coordenadas absurdas o invertidas', () => {
    expect(isInColombia(4.65, -74.07)).toBe(true)
    expect(isInColombia(-74.07, 4.65)).toBe(false)
    expect(isInColombia(40.41, -3.7)).toBe(false)
  })

  it('tidyName normaliza mayúsculas sin perder tildes', () => {
    expect(tidyName('  BOGOTÁ   NORTE ')).toBe('Bogotá Norte')
    expect(tidyName('ÉXITO LA FELICIDAD')).toBe('Éxito La Felicidad')
  })

  it('la cuadrícula de Bogotá cubre el radio sin salirse del círculo', () => {
    const bogota = METRO_AREAS[0]
    if (bogota === undefined) throw new Error('falta Bogotá')
    const points = gridAround(bogota)
    expect(points.length).toBeGreaterThan(20)
    expect(nationalGrid().length).toBeGreaterThan(points.length)
  })
})
