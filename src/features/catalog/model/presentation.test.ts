import {
  clampQuantity,
  formatMeasure,
  formatQuantity,
  presentationOf,
  totalContentOf,
} from './presentation'
import type { Product } from './product'

const base: Product = {
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

const p = (patch: Partial<Product>): Product => ({ ...base, ...patch })

describe('presentationOf — huevos', () => {
  // El caso que motivó todo esto: "2" tiene que leerse como "2 cartones".
  it('30 huevos es un cartón', () => {
    const eggs = p({ name: 'Huevos AA x 30', unitKind: 'unit', unitValue: 30, unitMeasure: 'un' })
    expect(presentationOf(eggs)).toMatchObject({
      singular: 'cartón',
      plural: 'cartones',
      label: 'Cartón x 30',
    })
  })

  it('12 huevos es una docena, sin decir "x 12"', () => {
    const eggs = p({ name: 'Huevos AA x 12', unitKind: 'unit', unitValue: 12, unitMeasure: 'un' })
    expect(presentationOf(eggs)).toMatchObject({ singular: 'docena', label: 'Docena' })
  })

  it('6 huevos es media docena', () => {
    const eggs = p({ name: 'Huevos rojos x 6', unitKind: 'unit', unitValue: 6, unitMeasure: 'un' })
    expect(presentationOf(eggs).singular).toBe('media docena')
  })

  it('una cantidad rara de huevos es un panal', () => {
    const eggs = p({ name: 'Huevos x 15', unitKind: 'unit', unitValue: 15, unitMeasure: 'un' })
    expect(presentationOf(eggs)).toMatchObject({ singular: 'panal', label: 'Panal x 15' })
  })
})

describe('presentationOf — envases', () => {
  it('la leche viene en bolsa', () => {
    const milk = p({ name: 'Leche entera', unitKind: 'volume', unitValue: 1100, unitMeasure: 'ml' })
    expect(presentationOf(milk)).toMatchObject({ singular: 'bolsa', label: 'Bolsa 1,1 L' })
  })

  it('el aceite viene en botella', () => {
    const oil = p({
      name: 'Aceite de girasol',
      unitKind: 'volume',
      unitValue: 1000,
      unitMeasure: 'ml',
    })
    expect(presentationOf(oil)).toMatchObject({ singular: 'botella', label: 'Botella 1 L' })
  })

  it('lo que se pesa y no tiene envase conocido es un paquete', () => {
    expect(presentationOf(base)).toMatchObject({ singular: 'paquete', label: 'Paquete 500 g' })
  })

  it('una sola unidad no lleva sufijo', () => {
    const one = p({ name: 'Escoba', unitKind: 'unit', unitValue: 1, unitMeasure: 'un' })
    expect(presentationOf(one)).toMatchObject({ singular: 'unidad', label: 'Unidad' })
  })
})

describe('formatMeasure', () => {
  it('sube a kg y L cuando la cifra lo pide', () => {
    expect(formatMeasure(1000, 'g')).toBe('1 kg')
    expect(formatMeasure(1500, 'g')).toBe('1,5 kg')
    expect(formatMeasure(1100, 'ml')).toBe('1,1 L')
  })

  it('no infla lo que es pequeño', () => {
    expect(formatMeasure(500, 'g')).toBe('500 g')
    expect(formatMeasure(250, 'ml')).toBe('250 ml')
  })

  it('quita los ceros sobrantes: nadie escribe 500,000 g', () => {
    expect(formatMeasure(500.0, 'g')).toBe('500 g')
  })
})

describe('formatQuantity', () => {
  it('concuerda singular y plural', () => {
    const eggs = p({ name: 'Huevos AA x 30', unitKind: 'unit', unitValue: 30, unitMeasure: 'un' })
    expect(formatQuantity(eggs, 1)).toBe('1 cartón')
    expect(formatQuantity(eggs, 2)).toBe('2 cartones')
  })

  it('nunca deja la cantidad como un número suelto', () => {
    expect(formatQuantity(base, 3)).toBe('3 paquetes')
  })
})

describe('totalContentOf', () => {
  it('dice cuánto se lleva de verdad, no cuántas cajas', () => {
    const eggs = p({ name: 'Huevos AA x 30', unitKind: 'unit', unitValue: 30, unitMeasure: 'un' })
    expect(totalContentOf(eggs, 2)).toBe('60 un')
    expect(totalContentOf(base, 3)).toBe('1,5 kg')
  })

  it('con una sola unidad no aporta nada y se omite', () => {
    expect(totalContentOf(base, 1)).toBeNull()
  })

  it('sin medida no inventa una', () => {
    expect(totalContentOf(p({ unitValue: null, unitMeasure: null }), 2)).toBeNull()
  })
})

describe('clampQuantity', () => {
  it('mantiene la cantidad dentro de límites razonables', () => {
    expect(clampQuantity(0)).toBe(1)
    expect(clampQuantity(-5)).toBe(1)
    expect(clampQuantity(150)).toBe(99)
    expect(clampQuantity(Number.NaN)).toBe(1)
    expect(clampQuantity(7)).toBe(7)
  })
})
