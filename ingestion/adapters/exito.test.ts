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
  // Path under the "Mercado" root: the aisle id, then any subcategory ids.
  const aisleOf = (id: string) => id.split('/')[0]

  it('cubre los 14 pasillos de Mercado', () => {
    expect(new Set(EXITO_CATEGORIES.map((c) => aisleOf(c.id))).size).toBe(14)
  })

  it('los pasillos que pasan del tope de VTEX se recorren por subcategoría (ING-005)', () => {
    // Totals measured 2026-10-05 are in exito.ts. Listing one of these aisles
    // whole would truncate it at 2.500 and mark every run as incomplete.
    const split = [
      '34185101', // Despensa
      '34185103', // Lácteos, huevos y refrigerados
      '34185097', // Pollo, carne y pescado
      '34185100', // Panadería y repostería
      '346084837', // Bebidas
      '34185106', // Aseo del hogar
      '34185107', // Mascotas
      '34185105', // Pasabocas y snacks
      '346098434', // Dulces y chocolatería
    ]
    const ids = new Set(EXITO_CATEGORIES.map((c) => c.id))
    for (const aisle of split) {
      expect(ids.has(aisle)).toBe(false)
      expect(EXITO_CATEGORIES.some((c) => c.id.startsWith(`${aisle}/`))).toBe(true)
    }
    expect(EXITO_CATEGORIES).toHaveLength(74)
  })

  it('"Perros" nunca entra entero: 9.984 productos, casi todo marketplace', () => {
    const ids = EXITO_CATEGORIES.map((c) => c.id)
    expect(ids).not.toContain('34185107/34185333')
    expect(ids.some((id) => id.startsWith('34185107/347733851'))).toBe(false)
  })

  it('no repite ninguna categoría y los ids son rutas numéricas', () => {
    const ids = EXITO_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^\d+(\/\d+){0,2}$/)
  })

  it('los pasillos van juntos: gana el primer pasillo que lista un producto', () => {
    // The adapter yields a product once, for the FIRST category listing it, so
    // an aisle's children must be contiguous or the order stops meaning anything.
    const aisles = EXITO_CATEGORIES.map((c) => aisleOf(c.id))
    const runs = aisles.filter((aisle, i) => aisle !== aisles[i - 1])
    expect(runs).toHaveLength(14)
    expect(runs[0]).toBe('34185101')
  })

  it('las etiquetas dicen de qué pasillo sale cada subcategoría', () => {
    for (const c of EXITO_CATEGORIES) {
      expect(c.label.includes(' > ')).toBe(c.id.includes('/'))
    }
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
