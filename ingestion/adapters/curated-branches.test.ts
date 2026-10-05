import mercadoMadrid from '../data/branches/mercado-madrid.json'
import supermu from '../data/branches/supermu.json'
import vaquitaExpress from '../data/branches/vaquita-express.json'
import { abortReason, collectBranches } from '../core/branch-pipeline'
import { isInColombia, type RawBranch } from '../core/branch-types'
import {
  curatedBranchAdapter,
  curatedFileSchema,
  mercadoMadridBranchAdapter,
  supermuBranchAdapter,
  vaquitaExpressBranchAdapter,
} from './curated-branches'

const FILES = [
  { file: supermu, adapter: supermuBranchAdapter, expected: 14 },
  { file: vaquitaExpress, adapter: vaquitaExpressBranchAdapter, expected: 8 },
  { file: mercadoMadrid, adapter: mercadoMadridBranchAdapter, expected: 2 },
]

async function load(adapter: typeof supermuBranchAdapter) {
  const results = []
  for await (const raw of adapter.fetchBranches({ userAgent: 'test', delayMs: 0 })) {
    results.push(adapter.normalize(raw))
  }
  return collectBranches(results)
}

describe.each(FILES)('sucursales curadas: $adapter.storeSlug', ({ file, adapter, expected }) => {
  it('el archivo dice de dónde salió y cuándo se verificó', () => {
    const parsed = curatedFileSchema.parse(file)
    expect(parsed.source).toMatch(/^https:\/\/|OpenStreetMap/)
  })

  it('toda fila es válida, única y está dentro de Colombia', async () => {
    const c = await load(adapter)
    expect(c.failed).toBe(0)
    expect(c.duplicates).toBe(0)
    expect(c.branches).toHaveLength(expected)
    expect(abortReason(c)).toBeNull()
    for (const b of c.branches) expect(isInColombia(b.latitude, b.longitude)).toBe(true)
  })

  // Estas tres cadenas son del Valle de Aburrá y el Oriente antioqueño: una
  // coordenada fuera de esa caja es un error de copia (lat/lng cambiadas, un
  // dígito de más).
  it('toda tienda cae en el área metropolitana de Medellín o Rionegro', async () => {
    const c = await load(adapter)
    for (const b of c.branches) {
      expect(b.latitude).toBeGreaterThan(6.0)
      expect(b.latitude).toBeLessThan(6.4)
      expect(b.longitude).toBeGreaterThan(-75.7)
      expect(b.longitude).toBeLessThan(-75.3)
    }
  })
})

describe('adaptador curado', () => {
  const file = {
    source: 'https://x.test',
    verifiedAt: '2026-10-04',
    coordinates: 'test',
    branches: [
      { externalId: 'a', name: 'A', address: null, city: null, latitude: 40.4, longitude: -3.7 },
    ],
  }

  it('una fila fuera de Colombia es ilegible, no se escribe', () => {
    const adapter = curatedBranchAdapter('x', file)
    expect(adapter.normalize(file.branches[0] as RawBranch).status).toBe('failed')
  })

  it('un archivo sin fuente o sin fecha no carga', () => {
    expect(() => curatedBranchAdapter('x', { ...file, source: '' })).toThrow()
    expect(() => curatedBranchAdapter('x', { ...file, verifiedAt: 'ayer' })).toThrow()
  })
})
