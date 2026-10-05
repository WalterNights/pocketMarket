import fixture from './__fixtures__/d1/lacteos-page.json'
import { d1Adapter, D1_CATEGORIES } from './d1'

/**
 * Tested against a real response saved on 2026-10-04: the first 15 products of
 * the "Lacteos y huevos" aisle (fq=C:/2/), trimmed to the fields normalize()
 * reads plus a few for context. The fixture is the contract with the source.
 */

const raws = fixture as unknown as Record<string, unknown>[]
const results = raws.map((r) => d1Adapter.normalize(r))
const normalised = results.map((r) => (r.status === 'ok' ? r.product : null))
const byId = (id: string) => normalised.find((p) => p?.externalId === id)

const OUR_TAXONOMY = new Set([
  'viveres',
  'lacteos',
  'carnes',
  'frutas-verduras',
  'panaderia',
  'bebidas',
  'congelados',
  'aseo-hogar',
  'mascotas',
  'bebes',
  'otros',
])

describe('d1Adapter.normalize — respuesta real', () => {
  it('normaliza todos los productos de la página guardada', () => {
    expect(results.map((r) => r.status)).toEqual(raws.map(() => 'ok'))
  })

  it('toma el nombre de productName, no el nameComplete pegado al del SKU', () => {
    // nameComplete: "Leche Deslactosada Tetrapak UHT Latti 900 Ml Leche Deslac
    // Tetrapak UHT Latti 900 Ml"
    expect(byId('717')?.name).toBe('Leche Deslactosada Tetrapak UHT 900 Ml')
    expect(byId('717')?.brand).toBe('Latti')
  })

  it('saca la medida del nombre', () => {
    expect(byId('892')).toMatchObject({ unitKind: 'volume', unitValue: 900, unitMeasure: 'ml' })
    expect(byId('902')).toMatchObject({ unitKind: 'weight', unitValue: 400, unitMeasure: 'g' })
    expect(byId('1515')).toMatchObject({ unitKind: 'unit', unitValue: 30, unitMeasure: 'un' })
  })

  it('convierte los precios a entero COP', () => {
    for (const p of normalised) {
      expect(Number.isInteger(p?.priceCop)).toBe(true)
      expect(p?.priceCop).toBeGreaterThan(0)
    }
    expect(byId('892')?.priceCop).toBe(3090)
  })

  it('sin descuento real no hay listPrice: D1 trae Price === ListPrice', () => {
    expect(normalised.every((p) => p?.listPriceCop === null)).toBe(true)
  })

  it('conserva el EAN válido y descarta el que no lo es', () => {
    expect(byId('892')?.ean).toBe('7707361719802')
    // El producto 816 llega sin EAN de 8-14 dígitos.
    expect(byId('816')?.ean).toBeNull()
  })

  it('marca disponibilidad', () => {
    expect(normalised.every((p) => p?.isAvailable === true)).toBe(true)
  })
})

describe('d1Adapter.normalize — entradas rotas', () => {
  it('un producto sin precio es agotado, no un error de formato', () => {
    const sinPrecio = structuredClone(raws[0]) as Record<string, unknown>
    // @ts-expect-error navegando una estructura de origen deliberadamente
    sinPrecio.items[0].sellers[0].commertialOffer.Price = 0
    expect(d1Adapter.normalize(sinPrecio).status).toBe('skipped')
  })

  it('descarta un producto sin items', () => {
    expect(d1Adapter.normalize({ productId: '1', items: [] }).status).toBe('failed')
  })

  it('descarta un producto sin id', () => {
    const sinId = structuredClone(raws[0]) as Record<string, unknown>
    sinId.productId = ''
    expect(d1Adapter.normalize(sinId).status).toBe('failed')
  })

  it('no revienta con un objeto vacío', () => {
    expect(d1Adapter.normalize({}).status).toBe('failed')
  })

  it('deja la medida en null si el nombre no la trae, sin inventarla', () => {
    const sinMedida = structuredClone(raws[0]) as Record<string, unknown>
    sinMedida.productName = 'Producto sin medida'
    const out = d1Adapter.normalize(sinMedida)
    expect(out.status === 'ok' && out.product.unitValue).toBeNull()
    expect(out.status === 'ok' && out.product.unitMeasure).toBeNull()
  })
})

describe('mapeo de categorías de D1', () => {
  it('todas apuntan a un slug de nuestra taxonomía', () => {
    for (const c of D1_CATEGORIES) {
      expect(OUR_TAXONOMY.has(c.slug)).toBe(true)
    }
  })

  it('no repite pasillos', () => {
    const ids = D1_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('solo trae pasillos de mercado', () => {
    for (const c of D1_CATEGORIES) {
      expect(c.label).not.toMatch(/licor|cuidado personal|moda|campa|donaci|temporada|electro/i)
    }
  })
})
