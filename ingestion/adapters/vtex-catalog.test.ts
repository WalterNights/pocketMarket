import type { FetchContext, RawProduct } from '../core/types'
import { createVtexCatalogAdapter, VTEX_TRUNCATED_REASON, type VtexCategory } from './vtex-catalog'

// No network: global fetch is replaced per test (same approach as core/http.test.ts).

const CATEGORIES: readonly VtexCategory[] = [
  { id: '10', label: 'Lácteos', slug: 'lacteos' },
  { id: '20', label: 'Desayuno', slug: 'viveres' },
]

const adapter = createVtexCatalogAdapter({
  storeSlug: 'prueba',
  baseUrl: 'https://vtex.test',
  parentPath: '/1',
  categories: CATEGORIES,
  regions: ['NACIONAL'],
  nameField: 'productName',
})

function vtexProduct(productId: string | undefined, productName = `Producto ${productId}`) {
  return {
    productId,
    productName,
    brand: 'MARCA',
    items: [
      {
        nameComplete: productName,
        sellers: [
          {
            commertialOffer: {
              Price: 1000,
              ListPrice: 1000,
              IsAvailable: true,
              AvailableQuantity: 5,
            },
          },
        ],
      },
    ],
  }
}

type Pages = (categoryId: string, from: number) => unknown[] | number

/** Serves `pages(categoryId, from)`: an array is a 206 body, a number a bare status. */
function mockVtex(pages: Pages): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(String(input))
    const categoryId = /fq=C:\/1\/([^/]+)\//.exec(decodeURIComponent(url.search))?.[1] ?? ''
    const answer = pages(categoryId, Number(url.searchParams.get('_from')))
    const response =
      typeof answer === 'number'
        ? new Response('{}', { status: answer })
        : new Response(JSON.stringify(answer), {
            status: 206,
            headers: { 'Content-Type': 'application/json' },
          })
    return Promise.resolve(response)
  })
}

type Dropped = { url: string; reason: string }

function context(dropped: Dropped[] = []): FetchContext {
  return {
    userAgent: 'test',
    delayMs: 0,
    onRequestDropped: (url, reason) => {
      dropped.push({ url, reason })
    },
  }
}

async function collect(ctx: FetchContext): Promise<RawProduct[]> {
  const out: RawProduct[] = []
  for await (const raw of adapter.fetchCatalog('NACIONAL', ctx)) out.push(raw)
  return out
}

const fullPage = (from: number) =>
  Array.from({ length: 50 }, (_, i) => vtexProduct(String(from + i)))

let warn: jest.SpyInstance

beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('createVtexCatalogAdapter.fetchCatalog — un producto en varios pasillos', () => {
  it('lo entrega una sola vez y gana el PRIMER pasillo', async () => {
    mockVtex((categoryId, from) => {
      if (from > 0) return []
      return categoryId === '10'
        ? [vtexProduct('1', 'Leche entera'), vtexProduct('2', 'Queso campesino')]
        : [vtexProduct('2', 'Queso campesino'), vtexProduct('3', 'Cafe molido')]
    })

    const raws = await collect(context())
    expect(raws.map((r) => r.productId)).toEqual(['1', '2', '3'])

    const buckets = raws.map((r) => {
      const out = adapter.normalize(r)
      return out.status === 'ok' ? out.product.sourceBucket : out.status
    })
    // The cheese stays in dairy; "Desayuno" only adds what no other aisle has.
    expect(buckets).toEqual(['lacteos', 'lacteos', 'viveres'])
  })

  it('recuerda los ids de toda la corrida, no solo de la página', async () => {
    // The repeat arrives 60 products later: a different batch of the pipeline.
    mockVtex((categoryId, from) => {
      if (categoryId === '10') {
        if (from === 0) return fullPage(0)
        if (from === 50) return fullPage(50).slice(0, 10)
        return []
      }
      return from === 0 ? [vtexProduct('0'), vtexProduct('59'), vtexProduct('900')] : []
    })

    const ids = (await collect(context())).map((r) => r.productId)
    expect(ids).toHaveLength(61)
    expect(new Set(ids).size).toBe(61)
    expect(ids.at(-1)).toBe('900')
  })

  it('compara el id como texto, venga como número o como cadena', async () => {
    mockVtex((categoryId, from) => {
      if (from > 0) return []
      return categoryId === '10'
        ? [{ ...vtexProduct('7'), productId: 7 }]
        : [vtexProduct('7'), vtexProduct(' 7 ')]
    })
    expect(await collect(context())).toHaveLength(1)
  })

  it('no esconde los registros sin id: normalize() los cuenta como ilegibles', async () => {
    mockVtex((categoryId, from) =>
      from === 0 && categoryId === '10' ? [vtexProduct(undefined), vtexProduct(undefined)] : [],
    )
    const raws = await collect(context())
    expect(raws).toHaveLength(2)
    expect(raws.map((r) => adapter.normalize(r).status)).toEqual(['failed', 'failed'])
  })

  it('los repetidos no cuentan para maxProducts', async () => {
    mockVtex((categoryId, from) => {
      if (from > 0) return []
      return categoryId === '10'
        ? [vtexProduct('1'), vtexProduct('2')]
        : [vtexProduct('1'), vtexProduct('2'), vtexProduct('3'), vtexProduct('4')]
    })
    const ids = (await collect({ ...context(), maxProducts: 3 })).map((r) => r.productId)
    expect(ids).toEqual(['1', '2', '3'])
  })
})

describe('createVtexCatalogAdapter.fetchCatalog — tope de paginación (ING-005)', () => {
  it('una categoría que sigue llena en el tope se reporta como truncada', async () => {
    const spy = mockVtex((categoryId, from) => (categoryId === '10' ? fullPage(from) : []))
    const dropped: Dropped[] = []

    const raws = await collect(context(dropped))

    expect(raws).toHaveLength(2500)
    expect(dropped).toHaveLength(1)
    // The literal, not the constant: run reports are read by this exact text.
    expect(dropped[0]?.reason).toBe('tope de paginacion de VTEX: categoria truncada')
    expect(VTEX_TRUNCATED_REASON).toBe(dropped[0]?.reason)
    expect(dropped[0]?.url).toContain('/10/')
    expect(dropped[0]?.url).toContain('_from=2450')
    // One warning per category, naming the aisle the operator has to split.
    expect(warn).toHaveBeenCalledTimes(1)
    const message = String(warn.mock.calls[0]?.[0])
    expect(message).toContain('categoria truncada')
    expect(message).toContain('"Lácteos"')
    expect(message).not.toContain('Desayuno')

    // Never asks past the ceiling, and the next category is still visited.
    const urls = spy.mock.calls.map((call) => String(call[0]))
    expect(urls.some((u) => u.includes('_from=2500'))).toBe(false)
    expect(urls.filter((u) => u.includes('/20/'))).toHaveLength(1)
  })

  it('cada categoría truncada avisa por separado, con su nombre', async () => {
    mockVtex((_categoryId, from) => fullPage(from))
    const dropped: Dropped[] = []

    await collect(context(dropped))

    expect(dropped.map((d) => d.reason)).toEqual([VTEX_TRUNCATED_REASON, VTEX_TRUNCATED_REASON])
    expect(warn).toHaveBeenCalledTimes(2)
    expect(String(warn.mock.calls[0]?.[0])).toContain('"Lácteos"')
    expect(String(warn.mock.calls[1]?.[0])).toContain('"Desayuno"')
  })

  it('con exactamente 2500 productos también se reporta: no se puede distinguir', async () => {
    // Accepted edge: the last page is full and the next cannot be asked for.
    mockVtex((categoryId, from) => (categoryId === '10' && from < 2500 ? fullPage(from) : []))
    const dropped: Dropped[] = []

    expect(await collect(context(dropped))).toHaveLength(2500)
    expect(dropped.map((d) => d.reason)).toEqual([VTEX_TRUNCATED_REASON])
  })

  it('una categoría que termina antes del tope no reporta nada', async () => {
    mockVtex((categoryId, from) => {
      if (categoryId !== '10') return []
      return from < 2450 ? fullPage(from) : fullPage(from).slice(0, 49)
    })
    const dropped: Dropped[] = []

    expect(await collect(context(dropped))).toHaveLength(2499)
    expect(dropped).toEqual([])
    expect(warn).not.toHaveBeenCalled()
  })

  it('un 400 de la fuente es fin de categoría, no un hueco', async () => {
    mockVtex((categoryId, from) => {
      if (categoryId !== '10') return from === 0 ? [vtexProduct('otro')] : []
      return from === 0 ? fullPage(0) : 400
    })
    const dropped: Dropped[] = []

    const raws = await collect(context(dropped))
    expect(raws).toHaveLength(51)
    expect(raws.at(-1)?.productId).toBe('otro')
    expect(dropped).toEqual([])
  })
})
