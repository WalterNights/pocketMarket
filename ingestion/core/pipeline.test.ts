import { dedupeByExternalId } from './pipeline'
import type { NormalizedProduct } from './schemas'

const product = (externalId: string, priceCop = 1000): NormalizedProduct => ({
  externalId,
  ean: null,
  name: `Producto ${externalId}`,
  brand: null,
  categorySlug: 'otros',
  unitKind: 'unit',
  unitValue: null,
  unitMeasure: null,
  imageUrl: null,
  isAvailable: true,
  priceCop,
  listPriceCop: null,
})

describe('dedupeByExternalId', () => {
  // Un producto puede estar en dos categorías de Éxito a la vez, y el pipeline
  // recorre categoría por categoría. Sin deduplicar, Postgres rechaza el upsert
  // entero: "ON CONFLICT DO UPDATE command cannot affect row a second time".
  it('descarta el SKU repetido dentro del mismo lote', () => {
    const out = dedupeByExternalId([product('A'), product('B'), product('A')])
    expect(out.map((p) => p.externalId)).toEqual(['A', 'B'])
  })

  it('se queda con la primera aparición', () => {
    const out = dedupeByExternalId([product('A', 100), product('A', 999)])
    expect(out).toHaveLength(1)
    expect(out[0]?.priceCop).toBe(100)
  })

  it('no toca un lote sin repetidos', () => {
    const batch = [product('A'), product('B'), product('C')]
    expect(dedupeByExternalId(batch)).toHaveLength(3)
  })

  it('un lote vacío sale vacío', () => {
    expect(dedupeByExternalId([])).toEqual([])
  })
})
