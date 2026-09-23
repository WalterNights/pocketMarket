import { priceChangeOf, unitPriceOf, type Product } from './product'

const baseProduct: Product = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Arroz blanco',
  brand: 'Diana',
  storeSlug: 'exito',
  storeName: 'Éxito',
  categorySlug: 'viveres',
  unitKind: 'weight',
  unitValue: 500,
  unitMeasure: 'g',
  imageUrl: null,
  isAvailable: true,
  priceCop: 4200,
}

const productWith = (patch: Partial<Product>): Product => ({ ...baseProduct, ...patch })

describe('unitPriceOf', () => {
  it('cotiza por 100 g', () => {
    expect(unitPriceOf(baseProduct)).toEqual({ amountCop: 840, perAmount: 100, measure: 'g' })
  })

  it('normaliza kg a g para que las presentaciones sean comparables', () => {
    const oneKilo = productWith({ unitValue: 1, unitMeasure: 'kg', priceCop: 7800 })
    expect(unitPriceOf(oneKilo)).toEqual({ amountCop: 780, perAmount: 100, measure: 'g' })
  })

  it('el empaque grande sale más barato por medida aunque cueste más', () => {
    const small = unitPriceOf(baseProduct)
    const large = unitPriceOf(productWith({ unitValue: 1, unitMeasure: 'kg', priceCop: 7800 }))

    expect(large!.amountCop).toBeLessThan(small!.amountCop)
  })

  it('normaliza litros a ml', () => {
    const oil = productWith({ unitKind: 'volume', unitValue: 1, unitMeasure: 'l', priceCop: 12900 })
    expect(unitPriceOf(oil)).toEqual({ amountCop: 1290, perAmount: 100, measure: 'ml' })
  })

  it('cotiza por unidad cuando se vende por piezas', () => {
    const eggs = productWith({
      unitKind: 'unit',
      unitValue: 30,
      unitMeasure: 'un',
      priceCop: 18500,
    })
    expect(unitPriceOf(eggs)).toEqual({ amountCop: 617, perAmount: 1, measure: 'un' })
  })

  it('devuelve null sin medida, en vez de inventar una', () => {
    expect(unitPriceOf(productWith({ unitValue: null, unitMeasure: null }))).toBeNull()
    expect(unitPriceOf(productWith({ unitValue: 500, unitMeasure: null }))).toBeNull()
    expect(unitPriceOf(productWith({ unitValue: null, unitMeasure: 'g' }))).toBeNull()
  })
})

describe('priceChangeOf', () => {
  it('detecta una subida', () => {
    expect(priceChangeOf(4200, 4600)).toEqual({ deltaCop: 400, direction: 'up', percent: 10 })
  })

  it('detecta una bajada y devuelve el porcentaje en positivo', () => {
    expect(priceChangeOf(4200, 3800)).toEqual({ deltaCop: -400, direction: 'down', percent: 10 })
  })

  it('sin cambio no reporta dirección', () => {
    expect(priceChangeOf(4200, 4200)).toEqual({ deltaCop: 0, direction: 'same', percent: 0 })
  })

  it('no divide por cero si el precio anterior es inválido', () => {
    expect(priceChangeOf(0, 4200)).toEqual({ deltaCop: 0, direction: 'same', percent: 0 })
  })
})
