import fixture from './__fixtures__/exito/despensa-page.json'
import { exitoAdapter, EXITO_CATEGORIES } from './exito'

/**
 * Tested against a real response saved on 2026-09-23. The fixture is the
 * contract with the source: when Éxito changes its format these tests fail and
 * say exactly what changed (docs/domain/02-ingestion.md).
 */

const raws = fixture as unknown as Record<string, unknown>[]
const results = raws.map((r) => exitoAdapter.normalize(r))
const normalised = results.map((r) => (r.status === 'ok' ? r.product : null))

describe('exitoAdapter.normalize — respuesta real', () => {
  it('normaliza todos los productos de la página guardada', () => {
    expect(normalised.every((p) => p !== null)).toBe(true)
  })

  it('quita la marca duplicada del nombre', () => {
    const pasta = normalised.find((p) => p?.externalId === String(raws[0]?.productId))
    // Origen: "Pastas DORIA spaghetti clásico (1000  gr)"
    expect(pasta?.name).toBe('Pastas spaghetti clásico')
    expect(pasta?.brand).toBe('Doria')
  })

  it('saca la medida del nombre, que es donde Éxito la esconde', () => {
    const pasta = normalised[0]
    expect(pasta).toMatchObject({ unitValue: 1000, unitMeasure: 'g', unitKind: 'weight' })
  })

  it('reconoce volumen', () => {
    const aceite = normalised.find((p) => p?.name.toLowerCase().includes('aceite'))
    expect(aceite).toMatchObject({ unitValue: 3000, unitMeasure: 'ml', unitKind: 'volume' })
  })

  it('convierte los precios flotantes a entero COP', () => {
    for (const p of normalised) {
      expect(Number.isInteger(p?.priceCop)).toBe(true)
      expect(p?.priceCop).toBeGreaterThan(0)
    }
  })

  it('solo guarda listPrice cuando hay descuento real', () => {
    // La salchicha ZENU viene con Price 14407 y ListPrice 17750.
    const conDescuento = normalised.find((p) => p?.listPriceCop !== null)
    expect(conDescuento?.listPriceCop).toBeGreaterThan(conDescuento!.priceCop)

    // Los demás traen Price === ListPrice, que no es un descuento.
    const sinDescuento = normalised.filter((p) => p?.listPriceCop === null)
    expect(sinDescuento.length).toBeGreaterThan(0)
  })

  it('conserva el EAN, que habilita equivalencias entre tiendas', () => {
    for (const p of normalised) {
      expect(p?.ean).toMatch(/^\d{8,14}$/)
    }
  })

  it('marca disponibilidad', () => {
    expect(normalised.every((p) => p?.isAvailable === true)).toBe(true)
  })
})

describe('exitoAdapter.normalize — entradas rotas', () => {
  it('un producto sin precio es agotado, no un error de formato', () => {
    const sinPrecio = structuredClone(raws[0]) as Record<string, unknown>
    // @ts-expect-error navegando una estructura de origen deliberadamente
    sinPrecio.items[0].sellers[0].commertialOffer.Price = 0
    expect(exitoAdapter.normalize(sinPrecio).status).toBe('skipped')
  })

  it('descarta un producto sin items', () => {
    expect(exitoAdapter.normalize({ productId: '1', items: [] }).status).toBe('failed')
  })

  it('descarta un producto sin id', () => {
    const sinId = structuredClone(raws[0]) as Record<string, unknown>
    sinId.productId = ''
    expect(exitoAdapter.normalize(sinId).status).toBe('failed')
  })

  it('no revienta con un objeto vacío', () => {
    expect(exitoAdapter.normalize({}).status).toBe('failed')
  })

  it('deja la medida en null si el nombre no la trae, sin inventarla', () => {
    const sinMedida = structuredClone(raws[0]) as Record<string, unknown>
    // @ts-expect-error navegando una estructura de origen deliberadamente
    sinMedida.items[0].nameComplete = 'Producto sin medida'
    const out = exitoAdapter.normalize(sinMedida)
    expect(out.status === 'ok' && out.product.unitValue).toBeNull()
    expect(out.status === 'ok' && out.product.unitMeasure).toBeNull()
  })
})

describe('mapeo de categorías', () => {
  it('cubre las 14 subcategorías de Mercado', () => {
    expect(EXITO_CATEGORIES).toHaveLength(14)
  })

  it('todas apuntan a un slug de nuestra taxonomía', () => {
    const ours = new Set([
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
    for (const c of EXITO_CATEGORIES) {
      expect(ours.has(c.slug)).toBe(true)
    }
  })
})
