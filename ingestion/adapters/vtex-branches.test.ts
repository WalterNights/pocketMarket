import { collectBranches } from '../core/branch-pipeline'
import { isInColombia, type RawBranch } from '../core/branch-types'
import carullaPage from './__fixtures__/branches/carulla-pickup-points.json'
import jumboPage from './__fixtures__/branches/jumbo-pickup-points.json'
import olimpicaPage from './__fixtures__/branches/olimpica-pickup-points.json'
import { carullaBranchAdapter } from './carulla-branches'
import { jumboBranchAdapter } from './jumbo-branches'
import { distanceKm, findTown, olimpicaBranchAdapter } from './olimpica-branches'

// Real VTEX pickup-point pages around central Bogotá, captured 2026-10-04.

const raws = (page: { items: { pickupPoint: unknown }[] }) =>
  page.items.map((item) => item.pickupPoint as RawBranch)

const byId = (page: { items: { pickupPoint: unknown }[] }, id: string): RawBranch => {
  const found = raws(page).find((raw) => raw.id === id)
  if (found === undefined) throw new Error(`falta ${id} en la fixture`)
  return found
}

describe('Olímpica', () => {
  const c = collectBranches(raws(olimpicaPage).map((r) => olimpicaBranchAdapter.normalize(r)))

  it('lee la página real sin ilegibles, todo dentro de Colombia', () => {
    expect(c.failed).toBe(0)
    expect(c.branches.length).toBeGreaterThan(15)
    for (const b of c.branches) expect(isInColombia(b.latitude, b.longitude)).toBe(true)
  })

  it('el número es la tienda y la ciudad sale del nombre', () => {
    expect(olimpicaBranchAdapter.normalize(byId(olimpicaPage, 'olimpicaswl1418_1418'))).toEqual({
      status: 'ok',
      branch: {
        externalId: '1418',
        name: 'Olímpica Bogotá',
        address: 'KR 58 # 137 B - 01',
        city: 'Bogotá',
        latitude: 4.727575499999999,
        longitude: -74.0649959,
      },
    })
  })

  it('el mostrador "SAO" no es una tienda', () => {
    const sao = olimpicaBranchAdapter.normalize(byId(olimpicaPage, 'olimpicaswl405sfs_1405pp'))
    expect(sao.status).toBe('skipped')
  })

  // La fuente copia registros: 1433-Villavicencio trae la coordenada de una
  // tienda de Bogotá y 1396-Cajicá la de una de Soacha.
  it('un pin lejos del municipio de su nombre se salta: es un dato copiado', () => {
    for (const id of ['olimpicaswl1433_1433', 'olimpicaswl1396_1396']) {
      expect(olimpicaBranchAdapter.normalize(byId(olimpicaPage, id))).toMatchObject({
        status: 'skipped',
        reason: expect.stringMatching(/lejos/),
      })
    }
  })

  it('la codificación rota de la fuente se repara contra los municipios conocidos', () => {
    expect(findTown('C�cuta')?.label).toBe('Cúcuta')
    expect(findTown('Cajic�')?.label).toBe('Cajicá')
    expect(findTown('La Dorada Caldas')?.label).toBe('La Dorada')
    expect(findTown('Pueblo Inventado')).toBeNull()
  })

  it('distanceKm: Bogotá–Villavicencio ronda los 75 km', () => {
    const bogota = { label: 'x', latitude: 4.711, longitude: -74.072 }
    expect(distanceKm(bogota, { latitude: 4.142, longitude: -73.626 })).toBeGreaterThan(70)
    expect(distanceKm(bogota, { latitude: 4.142, longitude: -73.626 })).toBeLessThan(85)
  })
})

describe('Jumbo', () => {
  const c = collectBranches(raws(jumboPage).map((r) => jumboBranchAdapter.normalize(r)))

  it('lee la página real sin ilegibles', () => {
    expect(c.failed).toBe(0)
    expect(c.branches.length).toBeGreaterThan(15)
  })

  it('las tiendas Metro ("JM ...") son Jumbo, sin el prefijo', () => {
    expect(
      jumboBranchAdapter.normalize(byId(jumboPage, 'jumbocolombiaidmetro26banderas_26')),
    ).toMatchObject({
      status: 'ok',
      branch: { externalId: '26', name: 'Jumbo Banderas', city: 'Bogotá' },
    })
  })

  // The externalId drops the `ioswl` / `idmetro` prefix: that is only safe
  // while both families share one numbering. A single page has no overlapping
  // grid points, so any duplicate here would be two shops with one number.
  it('Jumbo y Metro comparten numeración: ningún número se repite en la página', () => {
    expect(c.duplicates).toBe(0)
    const ids = raws(jumboPage).map((r) => String(r.id))
    const families = ids.flatMap((id) => {
      const m = /^jumbocolombia(ioswl|idmetro)(\d+)[a-z]*_(\d+)$/.exec(id)
      return m === null ? [] : [{ family: m[1], inPrefix: m[2], number: m[3] }]
    })
    expect(new Set(families.map((f) => f.family))).toEqual(new Set(['ioswl', 'idmetro']))
    // Shops only: the donation counter is `ioswl11_111`.
    const shops = families.filter((f) => f.inPrefix === f.number)
    expect(shops.length).toBe(families.length - 1)
    expect(new Set(shops.map((f) => f.number)).size).toBe(shops.length)
  })

  it('ni el punto de donaciones ni el retiro con uuid son tiendas', () => {
    expect(jumboBranchAdapter.normalize(byId(jumboPage, 'jumbocolombiaioswl11_111')).status).toBe(
      'skipped',
    )
    const uuid = raws(jumboPage).find((r) => String(r.id).includes('retiroentienda'))
    expect(uuid && jumboBranchAdapter.normalize(uuid).status).toBe('skipped')
  })
})

describe('Carulla', () => {
  const c = collectBranches(raws(carullaPage).map((r) => carullaBranchAdapter.normalize(r)))

  it('solo Carulla: los Éxito de la misma cuenta se saltan', () => {
    expect(c.failed).toBe(0)
    expect(c.branches.length).toBeGreaterThan(10)
    expect(c.branches.every((b) => b.name.startsWith('Carulla'))).toBe(true)
    expect(c.skipReasons['no es un Carulla']).toBeGreaterThan(10)
  })

  it('el mismo número con los dos esquemas de id queda como una sola tienda', () => {
    const own = byId(carullaPage, 'carulla564_ptorecogida_564')
    const twin = { ...own, id: '1_ptorecogida_0564' }
    const pair = collectBranches([own, twin].map((r) => carullaBranchAdapter.normalize(r)))
    expect(pair.branches).toHaveLength(1)
    expect(pair.branches[0]).toMatchObject({ externalId: '564', name: 'Carulla Niza' })
  })
})
