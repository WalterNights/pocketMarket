import type { Product } from '@/features/catalog'

import {
  listNameSchema,
  saveListErrorMessage,
  splitForEdit,
  toSavePayload,
  type SavedList,
} from './saved-list'
import type { DraftItem } from './totals'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'

const product = (id: string): Product => ({
  id,
  name: 'Producto',
  brand: null,
  storeSlug: 'exito',
  storeName: 'Éxito',
  categorySlug: null,
  unitKind: 'unit',
  unitValue: 1,
  unitMeasure: 'un',
  imageUrl: null,
  isAvailable: true,
  priceCop: 1000,
})

const draftItem = (id: string, quantity: number): DraftItem => ({ product: product(id), quantity })

describe('listNameSchema', () => {
  it('recorta y exige un nombre', () => {
    expect(listNameSchema.parse('  Mercado  ')).toBe('Mercado')
    expect(listNameSchema.safeParse('   ').success).toBe(false)
  })

  it('limita la longitud', () => {
    expect(listNameSchema.safeParse('x'.repeat(61)).success).toBe(false)
  })
})

describe('toSavePayload', () => {
  it('manda el borrador en el orden que el usuario ve', () => {
    expect(toSavePayload([draftItem(A, 2), draftItem(B, 1)])).toEqual([
      { store_product_id: A, quantity: 2 },
      { store_product_id: B, quantity: 1 },
    ])
  })

  it('añade los productos apartados, para que guardar no los borre', () => {
    expect(toSavePayload([draftItem(A, 1)], [{ productId: C, quantity: 3 }])).toEqual([
      { store_product_id: A, quantity: 1 },
      { store_product_id: C, quantity: 3 },
    ])
  })

  it('si un apartado también está en el borrador, manda la cantidad del borrador una sola vez', () => {
    expect(toSavePayload([draftItem(A, 5)], [{ productId: A, quantity: 1 }])).toEqual([
      { store_product_id: A, quantity: 5 },
    ])
  })
})

describe('splitForEdit', () => {
  const list: SavedList = {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Mercado',
    items: [
      { productId: A, productName: 'Arroz', quantity: 2, priceCopAtAdd: 4200 },
      { productId: B, productName: 'Leche descontinuada', quantity: 1, priceCopAtAdd: 3000 },
    ],
  }

  it('lo que tiene precio hoy va al borrador; lo que no, se aparta', () => {
    const { draft, kept } = splitForEdit(list, [product(A)])

    expect(draft).toEqual([{ product: product(A), quantity: 2 }])
    expect(kept).toEqual([{ productId: B, quantity: 1 }])
  })

  it('ida y vuelta sin tocar nada devuelve la misma lista', () => {
    const { draft, kept } = splitForEdit(list, [product(A)])

    expect(toSavePayload(draft, kept)).toEqual([
      { store_product_id: A, quantity: 2 },
      { store_product_id: B, quantity: 1 },
    ])
  })
})

describe('saveListErrorMessage', () => {
  it('sin conexión, tranquiliza: el borrador no se pierde', () => {
    expect(saveListErrorMessage('network')).toMatch(/Tu lista sigue aquí/)
  })

  it('una lista ajena se ve igual que una borrada', () => {
    expect(saveListErrorMessage('P0002')).toMatch(/ya no existe/)
  })

  it('un código desconocido nunca muestra el mensaje crudo', () => {
    expect(saveListErrorMessage('XX000')).toBe('No se pudo guardar. Vuelve a intentarlo.')
    expect(saveListErrorMessage(undefined)).toBe('No se pudo guardar. Vuelve a intentarlo.')
  })
})
