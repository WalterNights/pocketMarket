import {
  dedupeByExternalId,
  diffPrices,
  isAbsurdPriceJump,
  MAX_PRICE_JUMP,
  productRetireSkipReason,
  rememberPrices,
  splitKnown,
} from './pipeline'
import type { NormalizedProduct } from './schemas'

const product = (externalId: string, priceCop = 1000): NormalizedProduct => ({
  externalId,
  ean: null,
  name: `Producto ${externalId}`,
  brand: null,
  categorySlug: 'otros',
  sourceBucket: null,
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

describe('precios entre lotes', () => {
  // current_price es una vista materializada que solo se refresca cada mil
  // cambios. Un producto que vuelve en otro lote (está en dos categorías) se
  // comparaba contra la vista vieja y su precio se escribía dos veces.
  it('un precio escrito en un lote no se repite en el siguiente', () => {
    const known = new Map<string, number>()
    const ids = new Map([['A', 'id-a']])

    // Lote 1: el producto es nuevo, la vista no sabe nada.
    const first = splitKnown(['id-a'], known)
    expect(first.unknownIds).toEqual(['id-a'])
    const diff1 = diffPrices([product('A', 4200)], ids, first.previous, 'NACIONAL')
    expect(diff1.snapshots).toHaveLength(1)
    rememberPrices(known, first.previous, diff1.snapshots)

    // Lote 2: mismo producto, mismo precio. La vista sigue sin refrescar, pero
    // la corrida ya sabe lo que escribió y no vuelve a preguntarle.
    const second = splitKnown(['id-a'], known)
    expect(second.unknownIds).toEqual([])
    const diff2 = diffPrices([product('A', 4200)], ids, second.previous, 'NACIONAL')
    expect(diff2.snapshots).toHaveLength(0)
  })

  it('si el precio de verdad cambió entre lotes, sí se escribe', () => {
    const known = new Map([['id-a', 4200]])
    const { previous } = splitKnown(['id-a'], known)
    const diff = diffPrices([product('A', 4500)], new Map([['A', 'id-a']]), previous, 'NACIONAL')
    expect(diff.snapshots.map((s) => s.price_cop)).toEqual([4500])
  })

  it('un precio igual al publicado no genera snapshot', () => {
    const diff = diffPrices(
      [product('A', 4200)],
      new Map([['A', 'id-a']]),
      new Map([['id-a', 4200]]),
      'NACIONAL',
    )
    expect(diff.snapshots).toEqual([])
  })
})

describe('corte de precio absurdo', () => {
  it(`descarta un salto de x${MAX_PRICE_JUMP} o más, en cualquier dirección`, () => {
    expect(isAbsurdPriceJump(4200, 42000)).toBe(true)
    expect(isAbsurdPriceJump(4200, 420)).toBe(true)
    // "$ 4.200" leído como 4,2 → 4: el error de parseo típico.
    expect(isAbsurdPriceJump(4200, 4)).toBe(true)
  })

  it('deja pasar cambios grandes pero creíbles, y el primer precio', () => {
    expect(isAbsurdPriceJump(4200, 9900)).toBe(false)
    expect(isAbsurdPriceJump(4200, 1000)).toBe(false)
    expect(isAbsurdPriceJump(undefined, 999999)).toBe(false)
  })

  it('el precio absurdo no se escribe, se reporta, y el anterior sigue siendo el conocido', () => {
    const known = new Map([['id-a', 4200]])
    const { previous } = splitKnown(['id-a', 'id-b'], known)
    previous.set('id-b', 1000)
    const ids = new Map([
      ['A', 'id-a'],
      ['B', 'id-b'],
    ])

    const diff = diffPrices([product('A', 42), product('B', 1200)], ids, previous, 'NACIONAL')

    expect(diff.rejected).toEqual([{ externalId: 'A', previous: 4200, next: 42 }])
    expect(diff.snapshots.map((s) => s.store_product_id)).toEqual(['id-b'])

    rememberPrices(known, previous, diff.snapshots)
    expect(known.get('id-a')).toBe(4200)
    expect(known.get('id-b')).toBe(1200)
  })
})

describe('retirar productos ausentes', () => {
  const clean = {
    dryRun: false,
    aborted: false,
    partial: false,
    pagesDropped: 0,
    found: 1000,
    missing: 20,
  }

  it('una corrida completa y limpia retira lo que falta', () => {
    expect(productRetireSkipReason(clean)).toBeNull()
  })

  it('no retira si faltan demasiados: la fuente respondió a medias', () => {
    expect(productRetireSkipReason({ ...clean, missing: 400 })).toMatch(/demasiados/)
  })

  it('solo una corrida completa puede decir que algo desapareció', () => {
    expect(productRetireSkipReason({ ...clean, aborted: true })).toMatch(/abortada/)
    expect(productRetireSkipReason({ ...clean, partial: true })).toMatch(/parcial/)
    expect(productRetireSkipReason({ ...clean, pagesDropped: 1 })).toMatch(/huecos/)
    expect(productRetireSkipReason({ ...clean, dryRun: true })).toMatch(/dry run/)
  })
})
