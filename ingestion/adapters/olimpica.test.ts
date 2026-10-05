import fixture from './__fixtures__/olimpica/arroces-page.json'
import { olimpicaAdapter, OLIMPICA_CATEGORIES } from './olimpica'

/**
 * Tested against a real response saved on 2026-10-04: the first 15 products of
 * Supermercado > Despensa > Arroces (fq=C:/900000000/900020000/900020400/),
 * trimmed to the fields normalize() reads plus a few for context. The fixture
 * is the contract with the source.
 */

const raws = fixture as unknown as Record<string, unknown>[]
const results = raws.map((r) => olimpicaAdapter.normalize(r))
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

describe('olimpicaAdapter.normalize — respuesta real', () => {
  it('normaliza todos los productos de la página guardada', () => {
    expect(results.map((r) => r.status)).toEqual(raws.map(() => 'ok'))
  })

  it('toma el nombre de productName, no el nameComplete pegado al del SKU', () => {
    // nameComplete: "Arroz Sabrosón 5 Kg ARROZ SABROSON 5 KG"
    expect(byId('2000025')?.name).toBe('Arroz Sabrosón 5 Kg')
    // productName "Arroz Diana 5 Kg"; nameComplete is the SKU's "ARROZ DIANA 5 kg".
    expect(byId('566554')).toMatchObject({ name: 'Arroz 5 Kg', brand: 'Diana' })
  })

  it('saca la medida del nombre', () => {
    expect(byId('518231')).toMatchObject({ unitKind: 'weight', unitValue: 500, unitMeasure: 'g' })
    expect(byId('1515360')).toMatchObject({ unitKind: 'weight', unitValue: 2.5, unitMeasure: 'kg' })
  })

  it('no inventa la medida de un paquete de varias unidades', () => {
    // "Arroz Diana Paca 12,5 Kg X25 Unds": the name ends in the pack count.
    expect(byId('2317851')).toMatchObject({ unitValue: null, unitMeasure: null })
  })

  it('convierte los precios a entero COP', () => {
    for (const p of normalised) {
      expect(Number.isInteger(p?.priceCop)).toBe(true)
      expect(p?.priceCop).toBeGreaterThan(0)
    }
  })

  it('guarda listPrice solo cuando hay descuento real', () => {
    // Price 11135, ListPrice 13100.
    expect(byId('518233')).toMatchObject({ priceCop: 11135, listPriceCop: 13100 })
    // Price === ListPrice is not a discount.
    expect(byId('518231')?.listPriceCop).toBeNull()
  })

  it('conserva el EAN', () => {
    for (const p of normalised) {
      expect(p?.ean).toMatch(/^\d{8,14}$/)
    }
  })

  it('marca disponibilidad', () => {
    expect(normalised.every((p) => p?.isAvailable === true)).toBe(true)
  })
})

describe('olimpicaAdapter.normalize — entradas rotas', () => {
  it('un producto sin precio es agotado, no un error de formato', () => {
    const sinPrecio = structuredClone(raws[0]) as Record<string, unknown>
    // @ts-expect-error navegando una estructura de origen deliberadamente
    sinPrecio.items[0].sellers[0].commertialOffer.Price = 0
    expect(olimpicaAdapter.normalize(sinPrecio).status).toBe('skipped')
  })

  it('descarta un producto sin items', () => {
    expect(olimpicaAdapter.normalize({ productId: '1', items: [] }).status).toBe('failed')
  })

  it('descarta un producto sin id', () => {
    const sinId = structuredClone(raws[0]) as Record<string, unknown>
    sinId.productId = ''
    expect(olimpicaAdapter.normalize(sinId).status).toBe('failed')
  })

  it('no revienta con un objeto vacío', () => {
    expect(olimpicaAdapter.normalize({}).status).toBe('failed')
  })

  it('deja la medida en null si el nombre no la trae, sin inventarla', () => {
    const sinMedida = structuredClone(raws[0]) as Record<string, unknown>
    sinMedida.productName = 'Producto sin medida'
    const out = olimpicaAdapter.normalize(sinMedida)
    expect(out.status === 'ok' && out.product.unitValue).toBeNull()
    expect(out.status === 'ok' && out.product.unitMeasure).toBeNull()
  })
})

describe('mapeo de categorías de Olímpica', () => {
  it('todas apuntan a un slug de nuestra taxonomía', () => {
    for (const c of OLIMPICA_CATEGORIES) {
      expect(OUR_TAXONOMY.has(c.slug)).toBe(true)
    }
  })

  it('no repite pasillos', () => {
    const ids = OLIMPICA_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('solo trae pasillos de mercado', () => {
    for (const c of OLIMPICA_CATEGORIES) {
      expect(c.label).not.toMatch(/licor|cigarr|cuidado personal|^marcas propias|saludable/i)
    }
  })
})
