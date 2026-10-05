import fixture from './__fixtures__/supermu/products-page.json'
import {
  parseShopifyPrice,
  supermuAdapter,
  supermuAisle,
  supermuMeasure,
  tidyCase,
} from './supermu'

/**
 * Tested against real products saved from supermu.com/products.json on
 * 2026-10-04 (20 picked from the 7.615 of the catalogue, `body_html` removed).
 * The fixture is the contract with the source: when Supermú changes its
 * format these tests fail and say what changed.
 */

type Raw = Record<string, unknown> & { id: number; title: string }

const raws = fixture.products as unknown as Raw[]

function byTitle(title: string) {
  const raw = raws.find((r) => r.title === title)
  if (raw === undefined) throw new Error(`fixture sin "${title}"`)
  return supermuAdapter.normalize(raw)
}

function product(title: string) {
  const out = byTitle(title)
  if (out.status !== 'ok') throw new Error(`"${title}" no normalizó: ${out.reason}`)
  return out.product
}

describe('supermuAdapter.normalize — respuesta real', () => {
  it('no hay ningún registro ilegible en la página guardada', () => {
    const statuses = raws.map((r) => supermuAdapter.normalize(r).status)
    expect(statuses).not.toContain('failed')
    expect(statuses.filter((s) => s === 'ok').length).toBeGreaterThanOrEqual(15)
  })

  it('normaliza un producto completo', () => {
    expect(product('GALLETA ANTOJOS 170G PROVOCACION')).toEqual({
      externalId: '7460531667166',
      ean: null,
      name: 'Galleta provocacion',
      brand: 'Antojos',
      categorySlug: 'galletas',
      sourceBucket: 'viveres',
      unitKind: 'weight',
      unitValue: 170,
      unitMeasure: 'g',
      imageUrl: expect.stringMatching(/^https:\/\/cdn\.shopify\.com\//) as unknown as string,
      isAvailable: true,
      priceCop: 8290,
      listPriceCop: null,
    })
  })

  it('baja el nombre de mayúsculas y quita marca y medida', () => {
    expect(product('PAN HAMBURGUESA SUPERMU 320G').name).toBe('Pan hamburguesa')
    expect(product('NARANJA VALENCIA Aprox 5000gr').name).toBe('Naranja valencia')
    expect(product('MONDONGO ESPECIAL*500gr').name).toBe('Mondongo especial')
  })

  it('respeta un título que ya viene escrito por una persona', () => {
    expect(product('Limpia Pisos Fabuloso Antibacterial Violeta 5L').name).toBe(
      'Limpia Pisos Antibacterial Violeta',
    )
  })

  it('lee las abreviaturas de unidad del ERP', () => {
    expect(product('LECHE COLANTA 1000C ENTERA')).toMatchObject({
      unitValue: 1000,
      unitMeasure: 'ml',
      unitKind: 'volume',
    })
    expect(product('ACEITE DIANA 3000M VITAMINA')).toMatchObject({
      unitValue: 3000,
      unitMeasure: 'ml',
    })
    expect(product('GASEOSA POSTOBON 1.5L COLOMBIANA')).toMatchObject({
      unitValue: 1.5,
      unitMeasure: 'l',
    })
  })

  it('no inventa la medida de un paquete ambiguo, y la deja en el nombre', () => {
    // 6 vasos: ¿200 ml cada uno o en total? El título no lo dice.
    const yogurt = product('YOGURT COLANTA 6U 200C SURTIDO')
    expect(yogurt).toMatchObject({ unitValue: null, unitMeasure: null, unitKind: 'unit' })
    expect(yogurt.name).toContain('6u 200c')

    // "Pague 2 lleve 3": el precio es de tres paquetes de 500 g.
    expect(product('PASTA DORIA SPAGUETTI 500G PG 2 LLVE 3').unitValue).toBeNull()
  })

  it('no lee metros como mililitros', () => {
    expect(product('PAPEL ALUMINIO HAAS 7M')).toMatchObject({ unitValue: null, unitMeasure: null })
  })

  it('descarta una medida absurda en vez de publicarla', () => {
    // La fuente dice 1000 litros de jugo.
    expect(product('JUGO HIT 1000L MORA').unitValue).toBeNull()
  })

  it('marca como no disponible lo agotado, sin descartarlo', () => {
    const agotado = product('GALLETA GRECO 156G INTEGRAL AVENA/UVAS/C')
    expect(agotado.isAvailable).toBe(false)
    expect(agotado.priceCop).toBe(7150)
  })

  it('usa compare_at_price solo como descuento real', () => {
    expect(product('CHOCOLATE TESALIA 200G CLASICO PASTILLA')).toMatchObject({
      priceCop: 10490,
      listPriceCop: 15490,
    })
  })

  it('el pasillo de mascotas manda sobre el nombre', () => {
    expect(product('ARENA GATOS MAUCAT 4000G LIMON').categorySlug).toBe('mascotas')
  })

  it('deja fuera licores y cuidado personal como "fuera de mercado", no como error', () => {
    expect(byTitle('TEQUILA 1800 750C ANEJO')).toEqual({
      status: 'skipped',
      reason: 'fuera de mercado',
    })
    expect(byTitle('DESODORANTE AXE BS 150M DARK/TEMPT')).toEqual({
      status: 'skipped',
      reason: 'fuera de mercado',
    })
  })

  it('omite lo que la fuente no clasifica, sin contarlo como ilegible', () => {
    expect(byTitle('COMBO CINE').status).toBe('skipped')
  })
})

describe('supermuAdapter.normalize — entradas rotas', () => {
  const base = raws.find((r) => r.title === 'GALLETA ANTOJOS 170G PROVOCACION')!

  function withPrice(price: unknown) {
    const copy = structuredClone(base) as Raw & { variants: Record<string, unknown>[] }
    copy.variants[0]!.price = price
    return supermuAdapter.normalize(copy)
  }

  it('un precio en cero es "sin precio", no un error de formato', () => {
    expect(withPrice('0.00').status).toBe('skipped')
  })

  it('rechaza un precio con separador de miles en vez de leer 8,29', () => {
    expect(withPrice('8.290').status).toBe('failed')
  })

  it('rechaza centavos reales y precios que no son texto', () => {
    expect(withPrice('8290.50').status).toBe('failed')
    expect(withPrice(8290).status).toBe('failed')
  })

  it('descarta un producto sin variantes, sin id o vacío', () => {
    expect(supermuAdapter.normalize({ ...base, variants: [] }).status).toBe('failed')
    expect(supermuAdapter.normalize({ ...base, id: undefined }).status).toBe('failed')
    expect(supermuAdapter.normalize({}).status).toBe('failed')
  })

  it('acepta el EAN solo si tiene 8 a 14 dígitos', () => {
    const copy = structuredClone(base) as Raw & { variants: Record<string, unknown>[] }
    copy.variants[0]!.barcode = '7702011000427'
    const out = supermuAdapter.normalize(copy)
    expect(out.status === 'ok' && out.product.ean).toBe('7702011000427')

    copy.variants[0]!.barcode = '025431'
    const short = supermuAdapter.normalize(copy)
    expect(short.status === 'ok' && short.product.ean).toBeNull()
  })

  it('unas etiquetas que ya no son una lista son un cambio de formato, no un salto', () => {
    // Read as "no tags", the whole catalogue would turn into "sin pasillo"
    // skips and the 20% ceiling would never fire (ING-004).
    for (const tags of [undefined, null, 42, { ABARROTES: true }]) {
      expect(supermuAdapter.normalize({ ...base, tags, product_type: '' })).toEqual({
        status: 'failed',
        reason: 'tags ilegibles',
      })
    }
    // Not even a valid product_type covers for it.
    expect(supermuAdapter.normalize({ ...base, tags: null }).status).toBe('failed')
  })

  it('una lista vacía de etiquetas sigue siendo un salto de rutina', () => {
    expect(supermuAdapter.normalize({ ...base, tags: [], product_type: '' })).toEqual({
      status: 'skipped',
      reason: 'sin pasillo en la fuente',
    })
  })

  it('acepta las etiquetas como texto separado por comas (forma del Admin API)', () => {
    const out = supermuAdapter.normalize({ ...base, tags: 'ABARROTES, GALLETAS', product_type: '' })
    expect(out.status === 'ok' && out.product.sourceBucket).toBe('viveres')
  })

  it('usa el pasillo para decidir si una "M" suelta es volumen', () => {
    const toalla = supermuAdapter.normalize({
      ...base,
      title: 'TOALLA COCINA FAMILIA 80M',
      vendor: 'FAMILIA',
      tags: ['ASEO HOGAR'],
    })
    expect(toalla.status === 'ok' && toalla.product).toMatchObject({
      sourceBucket: 'aseo-hogar',
      unitValue: null,
      unitMeasure: null,
      unitKind: 'unit',
    })

    const avena = supermuAdapter.normalize({
      ...base,
      title: 'AVENA ALPINA 80M VASO',
      vendor: 'ALPINA',
      tags: ['LACTEOS Y DERIVADOS'],
    })
    expect(avena.status === 'ok' && avena.product).toMatchObject({
      unitValue: 80,
      unitMeasure: 'ml',
    })
  })
})

describe('parseShopifyPrice', () => {
  it('lee pesos enteros', () => {
    expect(parseShopifyPrice('8290.00')).toBe(8290)
    expect(parseShopifyPrice('8290')).toBe(8290)
    expect(parseShopifyPrice('0.00')).toBeNull()
  })

  it('no confunde un separador de miles con decimales', () => {
    expect(parseShopifyPrice('4.200')).toBeUndefined()
    expect(parseShopifyPrice('4,200')).toBeUndefined()
    expect(parseShopifyPrice('$ 4.200')).toBeUndefined()
  })
})

describe('supermuMeasure', () => {
  it('encuentra la medida en mitad del título', () => {
    expect(supermuMeasure('GALLETA ANTOJOS 170G PROVOCACION')?.measure).toEqual({
      value: 170,
      measure: 'g',
      kind: 'weight',
    })
    expect(supermuMeasure('INFUSION BITACO 10U FRUTAL')?.measure).toMatchObject({
      value: 10,
      measure: 'un',
    })
    expect(supermuMeasure('ARENA GATOS PETYS 4.5 KILOS')?.measure).toMatchObject({
      value: 4.5,
      measure: 'kg',
    })
  })

  it('no lee la cola de un decimal partido', () => {
    // 42,5 g escrito con un espacio: leer "5G" daría un precio por gramo 8 veces mayor.
    expect(supermuMeasure('CREMA SOPERA POLLO 42, 5G')).toBeNull()
  })

  it('devuelve null ante packs y promociones', () => {
    expect(supermuMeasure('LECHE COLANTA 6U 1100ML DESLACTOSADA')).toBeNull()
    expect(supermuMeasure('JUGO NECTAR FRUTO 200ML PAGUE 7 LLEVE 10')).toBeNull()
    expect(supermuMeasure('Crema Dental Colgate Total 3x75ml')).toBeNull()
    expect(supermuMeasure('TALCO YODORA 120G + 90G')).toBeNull()
  })

  it('devuelve null ante un pack escrito con X y sin dígito delante', () => {
    // Three 300 g bars: reading 300 g would triple the price per gram.
    expect(supermuMeasure('JABON REY X3 300G')).toBeNull()
    expect(supermuMeasure('JABON REY X 3 300G')).toBeNull()
    expect(supermuMeasure('JABON REY 300G X3')).toBeNull()
    expect(supermuMeasure('Jabon Rey x3 300g')).toBeNull()
  })

  it('devuelve null ante un entero suelto justo antes de la medida', () => {
    expect(supermuMeasure('ATUN VAN CAMPS 3 160G')).toBeNull()
    expect(supermuMeasure('ATUN VAN CAMPS 3 160 G ACEITE')).toBeNull()
  })

  it('la X que solo introduce la medida no es un pack', () => {
    expect(supermuMeasure('PANELERA X 310GR')?.measure).toMatchObject({ value: 310, measure: 'g' })
    expect(supermuMeasure('PANELA X 500 G')?.measure).toMatchObject({ value: 500, measure: 'g' })
    expect(supermuMeasure('HUEVOS AA X 30 UND')?.measure).toMatchObject({
      value: 30,
      measure: 'un',
    })
  })

  it('una "M" o "C" suelta solo es volumen en pasillo líquido o desde 100', () => {
    // Metres, not millilitres — and no list of roll goods can keep up.
    expect(supermuMeasure('TOALLA COCINA FAMILIA 80M', 'aseo-hogar')).toBeNull()
    expect(supermuMeasure('CUERDA ROPA 10M', 'aseo-hogar')).toBeNull()
    expect(supermuMeasure('CUERDA ROPA 10M')).toBeNull()
    expect(supermuMeasure('VELA CUMPLEANOS 12C', 'otros')).toBeNull()

    // Liquid aisle: accepted even when the number is small.
    expect(supermuMeasure('AVENA ALPINA 80M VASO', 'lacteos')?.measure).toMatchObject({
      value: 80,
      measure: 'ml',
    })
    expect(supermuMeasure('JUGO HIT 90C CAJA', 'bebidas')?.measure).toMatchObject({
      value: 90,
      measure: 'ml',
    })

    // From 100 up nobody sells by the metre in a supermarket.
    expect(supermuMeasure('ACEITE DIANA 3000M VITAMINA', 'viveres')?.measure).toMatchObject({
      value: 3000,
      measure: 'ml',
    })
    expect(supermuMeasure('AGUARDIENTE REAL 750M', 'otros')?.measure).toMatchObject({
      value: 750,
      measure: 'ml',
    })

    // What was already metres stays metres, large numbers included.
    expect(supermuMeasure('PAPEL VINIPEL 100M', 'aseo-hogar')).toBeNull()
  })

  it('fuera de los pasillos de comida una "M" suelta son metros, mida lo que mida', () => {
    expect(supermuMeasure('TOALLA COCINA FAMILIA 120M', 'aseo-hogar')).toBeNull()
    expect(supermuMeasure('HILO 200M', 'aseo-hogar')).toBeNull()
    expect(supermuMeasure('CORREA PERRO 150M', 'mascotas')).toBeNull()
    // Sin pasillo no hay con qué decidir.
    expect(supermuMeasure('HILO 200M')).toBeNull()
    expect(supermuMeasure('HILO 200M', null)).toBeNull()
    // El precio de no adivinar: un limpiador "500M" tampoco se lee.
    expect(supermuMeasure('LIMPIADOR FABULOSO 500M', 'aseo-hogar')).toBeNull()
    // Escrito entero sí, en cualquier pasillo.
    expect(supermuMeasure('LIMPIADOR FABULOSO 500ML', 'aseo-hogar')?.measure).toMatchObject({
      value: 500,
      measure: 'ml',
    })
  })

  it('una X seguida de una medida con separador de miles no es un pack', () => {
    expect(supermuMeasure('PANELA X 2.500 G')?.measure).toEqual({
      value: 2500,
      measure: 'g',
      kind: 'weight',
    })
    expect(supermuMeasure('ARROZ DIANA X 2.500G')?.measure).toMatchObject({ value: 2500 })
    expect(supermuMeasure('GASEOSA X 1.5 L', 'bebidas')?.measure).toMatchObject({
      value: 1.5,
      measure: 'l',
    })
    // Y un pack de verdad lo sigue siendo.
    expect(supermuMeasure('JABON REY X 2 500 G')).toBeNull()
    expect(supermuMeasure('JABON REY X2 2.500 G')).toBeNull()
  })

  it('devuelve null ante combos y packs escritos con palabras', () => {
    expect(supermuMeasure('LECHE COLANTA SIXPACK 900ML', 'lacteos')).toBeNull()
    expect(supermuMeasure('ENERGIZANTE VIVE100 FOURPACK 250ML', 'bebidas')).toBeNull()
    expect(supermuMeasure('CHOCOLATE HUEVO BIPACK 40G')).toBeNull()
    expect(supermuMeasure('ATUN VAN CAMPS DUO PACK 160G')).toBeNull()
    expect(supermuMeasure('JABON PROTEX TRI-PACK 110G')).toBeNull()
    expect(supermuMeasure('COMBO SALCHICHA ZENU 450G')).toBeNull()
    expect(supermuMeasure('KIT LIMPIAVIDRIOS 500ML')).toBeNull()
    expect(supermuMeasure('AVENA QUAKER 400G GRATIS VASO')).toBeNull()
    expect(supermuMeasure('KOLA GRANULADA 135G+FRESA')).toBeNull()
  })

  it('pero no ante un "+", un "pack" o un "kit" que son parte del nombre', () => {
    expect(supermuMeasure('ARROZ VITA+ 500G')?.measure).toMatchObject({ value: 500 })
    expect(supermuMeasure('SALSA TOMATE FRUCO DOY PACK 400G')?.measure).toMatchObject({
      value: 400,
    })
    expect(supermuMeasure('CHOCOLATINA KIT KAT 41.5G')?.measure).toMatchObject({ value: 41.5 })
  })

  it('"ML" y "CC" escritos enteros no dependen del pasillo', () => {
    expect(supermuMeasure('SALSA FRUCO 80ML', 'viveres')?.measure).toMatchObject({
      value: 80,
      measure: 'ml',
    })
    expect(supermuMeasure('ESENCIA LEVAPAN 60CC', 'viveres')?.measure).toMatchObject({
      value: 60,
      measure: 'ml',
    })
  })
})

describe('tidyCase', () => {
  it('baja a minúsculas un título gritado', () => {
    expect(tidyCase('GALLETA PROVOCACION')).toBe('Galleta provocacion')
  })

  it('deja intacto un título con mayúsculas y minúsculas', () => {
    expect(tidyCase('Crema Dental Total')).toBe('Crema Dental Total')
  })
})

describe('supermuAisle', () => {
  it('las etiquetas del ERP mandan sobre product_type', () => {
    expect(supermuAisle(['ABARROTES', 'GALLETAS'], 'Bebidas')).toBe('viveres')
  })

  it('lo excluido gana a una etiqueta de comida puesta por error', () => {
    // Real: "ROLLONDESOD BALANCE 50ML" lleva ASEO PERSONAL y LACTEOS Y DERIVADOS.
    expect(supermuAisle(['ASEO PERSONAL', 'LACTEOS Y DERIVADOS'], '')).toBeNull()
  })

  it('el pollo congelado es carne, no congelado', () => {
    expect(supermuAisle(['CONGELADOS', 'CARNES-POLLO-PESCADO'], '')).toBe('carnes')
  })

  it('compara sin tildes ni mayúsculas', () => {
    expect(supermuAisle(['Lácteos/Derivados/Huevos'], '')).toBe('lacteos')
    expect(supermuAisle([], 'Bebés y niños pequeños')).toBe('bebes')
  })

  it('cae a product_type cuando no hay etiqueta, y a undefined si tampoco', () => {
    expect(supermuAisle([], 'Despensa')).toBe('viveres')
    expect(supermuAisle([], 'Licores')).toBeNull()
    expect(supermuAisle([], 'Producto')).toBeUndefined()
  })

  it('todos los pasillos apuntan a un slug de nuestra taxonomía', () => {
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
    for (const raw of raws) {
      const out = supermuAdapter.normalize(raw)
      if (out.status === 'ok') expect(ours.has(out.product.sourceBucket ?? '')).toBe(true)
    }
  })
})
