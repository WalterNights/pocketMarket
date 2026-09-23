import type { Product } from '@/features/catalog'

import { grandTotalOf, itemCountOf, subtotalOf, totalsByStore, type DraftItem } from './totals'

const product = (patch: Partial<Product> & { id: string }): Product => ({
  name: 'Producto',
  brand: null,
  storeSlug: 'exito',
  storeName: 'Éxito',
  categorySlug: 'viveres',
  unitKind: 'unit',
  unitValue: 1,
  unitMeasure: 'un',
  imageUrl: null,
  isAvailable: true,
  priceCop: 1000,
  ...patch,
})

const item = (p: Partial<Product> & { id: string }, quantity: number): DraftItem => ({
  product: product(p),
  quantity,
})

describe('subtotalOf', () => {
  it('multiplica precio por cantidad', () => {
    expect(subtotalOf(item({ id: '1', priceCop: 4200 }, 3))).toBe(12600)
  })

  it('devuelve enteros: el peso no tiene centavos', () => {
    expect(Number.isInteger(subtotalOf(item({ id: '1', priceCop: 4333 }, 3)))).toBe(true)
  })
})

describe('grandTotalOf', () => {
  it('suma todo', () => {
    const items = [item({ id: '1', priceCop: 4200 }, 2), item({ id: '2', priceCop: 7800 }, 1)]
    expect(grandTotalOf(items)).toBe(16200)
  })

  it('una lista vacía suma cero, no null', () => {
    expect(grandTotalOf([])).toBe(0)
    expect(itemCountOf([])).toBe(0)
  })
})

describe('totalsByStore', () => {
  const items = [
    item({ id: '1', priceCop: 4200, storeSlug: 'exito', storeName: 'Éxito' }, 2),
    item({ id: '2', priceCop: 7800, storeSlug: 'exito', storeName: 'Éxito' }, 1),
    item({ id: '3', priceCop: 3000, storeSlug: 'd1', storeName: 'D1' }, 1),
  ]

  it('agrupa por tienda — el caso de uso central de la app', () => {
    const totals = totalsByStore(items)
    expect(totals).toHaveLength(2)
    expect(totals[0]).toMatchObject({ storeSlug: 'exito', itemCount: 2, subtotalCop: 16200 })
    expect(totals[1]).toMatchObject({ storeSlug: 'd1', itemCount: 1, subtotalCop: 3000 })
  })

  it('ordena por gasto, de mayor a menor', () => {
    expect(totalsByStore(items).map((t) => t.storeSlug)).toEqual(['exito', 'd1'])
  })

  it('los subtotales por tienda suman el total general', () => {
    const sum = totalsByStore(items).reduce((acc, t) => acc + t.subtotalCop, 0)
    expect(sum).toBe(grandTotalOf(items))
  })

  it('desempata por nombre, para que el orden sea estable', () => {
    const tied = [
      item({ id: '1', priceCop: 1000, storeSlug: 'zeta', storeName: 'Zeta' }, 1),
      item({ id: '2', priceCop: 1000, storeSlug: 'alfa', storeName: 'Alfa' }, 1),
    ]
    expect(totalsByStore(tied).map((t) => t.storeName)).toEqual(['Alfa', 'Zeta'])
  })

  it('sin ítems no hay tiendas', () => {
    expect(totalsByStore([])).toEqual([])
  })
})
