import { MAX_PRICE_COP, normalizedProductSchema } from './schemas'

const product = {
  externalId: '1',
  ean: null,
  name: 'Arroz',
  brand: null,
  categorySlug: 'arroz',
  sourceBucket: 'viveres',
  unitKind: 'weight',
  unitValue: 500,
  unitMeasure: 'g',
  imageUrl: null,
  isAvailable: true,
  priceCop: 4200,
  listPriceCop: null,
}

describe('normalizedProductSchema — precios', () => {
  it('acepta un precio normal', () => {
    expect(normalizedProductSchema.safeParse(product).success).toBe(true)
  })

  it('rechaza un precio imposible, que no cabría en la base y tumbaría el lote entero', () => {
    expect(normalizedProductSchema.safeParse({ ...product, priceCop: 3_450_034_500 }).success).toBe(
      false,
    )
    expect(
      normalizedProductSchema.safeParse({ ...product, listPriceCop: MAX_PRICE_COP + 1 }).success,
    ).toBe(false)
  })

  it('el tope en sí es válido', () => {
    expect(normalizedProductSchema.safeParse({ ...product, priceCop: MAX_PRICE_COP }).success).toBe(
      true,
    )
  })
})
