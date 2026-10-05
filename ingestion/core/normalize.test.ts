import { capitaliseFirst, cleanProductName, extractMeasure, tidyBrand, toCop } from './normalize'

describe('extractMeasure — separador de miles', () => {
  it('"2.500 G" son 2.500 g, no 2,5 g', () => {
    expect(extractMeasure('ARROZ 2.500 G')).toEqual({ value: 2500, measure: 'g', kind: 'weight' })
  })

  it('"3.000 Ml" son 3 litros', () => {
    expect(extractMeasure('Aceite Vegetal Imatá 3.000 Ml')?.value).toBe(3000)
  })

  it('los decimales siguen siendo decimales', () => {
    expect(extractMeasure('Atún (110.5 gr)')?.value).toBe(110.5)
    expect(extractMeasure('Gaseosa 1.5 L')?.value).toBe(1.5)
    expect(extractMeasure('Queso 0.250 kg')?.value).toBe(0.25)
    expect(extractMeasure('Leche 1,1 L')?.value).toBe(1.1)
  })
})

describe('extractMeasure — nombres reales de Éxito', () => {
  it('lee la medida del paréntesis con doble espacio', () => {
    expect(extractMeasure('Pastas DORIA spaghetti clásico (1000  gr)')).toEqual({
      value: 1000,
      measure: 'g',
      kind: 'weight',
    })
  })

  it('traduce "gr" a nuestra unidad canónica', () => {
    expect(extractMeasure('Sal REFISAL alta pureza  (1000  gr)')?.measure).toBe('g')
  })

  it('reconoce volumen', () => {
    expect(extractMeasure('Aceite FRESCAMPO vegetal multiusos (3000  ml)')).toEqual({
      value: 3000,
      measure: 'ml',
      kind: 'volume',
    })
  })

  it('acepta decimales', () => {
    expect(extractMeasure('Lomitos de atún FRESCAMPO en agua (110.5  gr)')?.value).toBe(110.5)
  })

  it('acepta coma decimal', () => {
    expect(extractMeasure('Queso (110,5 gr)')?.value).toBe(110.5)
  })

  it('se queda con el último paréntesis, no con el primero', () => {
    expect(extractMeasure('Café (descafeinado) (500 gr)')?.value).toBe(500)
  })

  it('lee la medida suelta al final del nombre', () => {
    expect(extractMeasure('Arroz Diana x 500g')).toEqual({
      value: 500,
      measure: 'g',
      kind: 'weight',
    })
  })

  it('normaliza unidades sueltas', () => {
    expect(extractMeasure('Huevos (30 und)')).toEqual({ value: 30, measure: 'un', kind: 'unit' })
    expect(extractMeasure('Leche (1 lt)')).toEqual({ value: 1, measure: 'l', kind: 'volume' })
    expect(extractMeasure('Gaseosa (350 cc)')?.measure).toBe('ml')
  })

  it('devuelve null en vez de inventarse una medida', () => {
    expect(extractMeasure('Escoba multiusos')).toBeNull()
    expect(extractMeasure('Producto (edición especial)')).toBeNull()
    expect(extractMeasure('Algo (0 gr)')).toBeNull()
    expect(extractMeasure('Algo (500 zanahorias)')).toBeNull()
  })
})

describe('cleanProductName', () => {
  it('quita la marca duplicada y la medida', () => {
    expect(cleanProductName('Pastas DORIA spaghetti clásico (1000  gr)', 'DORIA')).toBe(
      'Pastas spaghetti clásico',
    )
  })

  it('quita la marca sin importar mayúsculas', () => {
    expect(cleanProductName('Azúcar Manuelita alta pureza (1000 gr)', 'MANUELITA')).toBe(
      'Azúcar alta pureza',
    )
  })

  it('colapsa los espacios que deja el recorte', () => {
    expect(cleanProductName('Sal REFISAL alta pureza  (1000  gr)', 'REFISAL')).toBe(
      'Sal alta pureza',
    )
  })

  it('no toca el nombre si la marca no aparece dentro', () => {
    expect(cleanProductName('Lomitos de atún en agua (110.5 gr)', 'FRESCAMPO')).toBe(
      'Lomitos de atún en agua',
    )
  })

  it('no rompe con marcas que llevan caracteres de regex', () => {
    expect(cleanProductName('Jugo H2O+ natural (1 lt)', 'H2O+')).toBe('Jugo natural')
  })

  it('sin marca solo quita la medida', () => {
    expect(cleanProductName('Plátano maduro (1000 gr)', null)).toBe('Plátano maduro')
  })

  it('no deja el nombre vacío por quitar de más', () => {
    expect(cleanProductName('DORIA (500 gr)', 'DORIA')).toBe('DORIA')
  })

  it('conserva la marca cuando la marca ES el producto', () => {
    // Nombres reales de Olímpica y Supermú: quitar la marca dejaba la medida,
    // el empaque o la línea del fabricante.
    expect(cleanProductName('Maizena 90 G', 'Maizena')).toBe('Maizena 90 G')
    expect(cleanProductName('HALLS TUBO SURTIDO', 'HALLS')).toBe('HALLS TUBO SURTIDO')
    expect(cleanProductName('TRIGUISAR LA GRAN COCINA', 'TRIGUISAR')).toBe(
      'TRIGUISAR LA GRAN COCINA',
    )
  })

  it('conserva la marca si sin ella solo queda medida o empaque', () => {
    expect(cleanProductName('Bolsa X 6 Und Bonyurt', 'Bonyurt')).toBe('Bolsa X 6 Und Bonyurt')
  })

  it('pero la quita cuando el producto se nombra antes', () => {
    expect(cleanProductName('Arroz Diana 500 G', 'Diana')).toBe('Arroz 500 G')
    expect(cleanProductName('PASTA DORIA SPAGUETTI', 'DORIA')).toBe('PASTA SPAGUETTI')
  })
})

describe('toCop', () => {
  it('redondea los flotantes del origen a entero', () => {
    expect(toCop(7800.0)).toBe(7800)
    expect(toCop(14407.0)).toBe(14407)
    expect(toCop(2910.4)).toBe(2910)
    expect(toCop(2910.6)).toBe(2911)
  })

  it('rechaza lo que no es un precio usable', () => {
    expect(toCop(0)).toBeNull()
    expect(toCop(-100)).toBeNull()
    expect(toCop(null)).toBeNull()
    expect(toCop(undefined)).toBeNull()
    expect(toCop('7800')).toBeNull()
    expect(toCop(Number.NaN)).toBeNull()
    expect(toCop(Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('tidyBrand', () => {
  it('deja de gritar', () => {
    expect(tidyBrand('DORIA')).toBe('Doria')
    expect(tidyBrand('JUAN VALDEZ')).toBe('Juan Valdez')
  })

  it('trata lo vacío como ausencia', () => {
    expect(tidyBrand('')).toBeNull()
    expect(tidyBrand('   ')).toBeNull()
    expect(tidyBrand(null)).toBeNull()
    expect(tidyBrand(undefined)).toBeNull()
  })

  it('los marcadores de "sin marca" no son una marca', () => {
    expect(tidyBrand('Sin Marca')).toBeNull()
    expect(tidyBrand('SIN MARCA 2')).toBeNull()
    expect(tidyBrand('20.09')).toBeNull()
  })

  it('pero una marca que es un número entero sí lo es', () => {
    expect(tidyBrand('1800')).toBe('1800')
  })
})

describe('capitaliseFirst', () => {
  it('sube la primera letra sin tocar el resto', () => {
    expect(capitaliseFirst('pastas spaghetti')).toBe('Pastas spaghetti')
    expect(capitaliseFirst('')).toBe('')
  })
})

describe('extractMeasure — el punto depende de la unidad', () => {
  it('junto a kg o litros el punto es decimal aunque le sigan tres cifras', () => {
    expect(extractMeasure('Pollo entero 1.200 Kg')).toEqual({
      value: 1.2,
      measure: 'kg',
      kind: 'weight',
    })
    expect(extractMeasure('Queso 1.250 kg')?.value).toBe(1.25)
    expect(extractMeasure('Gaseosa 1.500 L')?.value).toBe(1.5)
    expect(extractMeasure('Agua (5.000 litros)')?.value).toBe(5)
  })

  it('junto a gramos, mililitros o unidades sigue siendo miles', () => {
    expect(extractMeasure('ARROZ 2.500 G')?.value).toBe(2500)
    expect(extractMeasure('Aceite 3.000 Ml')?.value).toBe(3000)
    expect(extractMeasure('Azúcar (2.500 gramos)')?.value).toBe(2500)
    expect(extractMeasure('Servilletas 1.000 und')?.value).toBe(1000)
  })

  it('una coma con tres cifras junto a una unidad pequeña no se adivina', () => {
    expect(extractMeasure('Arroz 1,000 g')).toBeNull()
    expect(extractMeasure('Aceite (3,000 ml)')).toBeNull()
  })

  it('la coma junto a kg o litros es decimal', () => {
    expect(extractMeasure('Leche 1,1 L')?.value).toBe(1.1)
    expect(extractMeasure('Queso 1,250 kg')?.value).toBe(1.25)
    expect(extractMeasure('Queso (110,5 gr)')?.value).toBe(110.5)
  })
})

describe('extractMeasure — el tamaño de una unidad no es el del paquete', () => {
  it('"6 x 330 ml" no son 330 ml', () => {
    expect(extractMeasure('Cerveza 6 x 330 ml')).toBeNull()
    expect(extractMeasure('Cerveza 6x330ml')).toBeNull()
    expect(extractMeasure('Cerveza x6 330 ml')).toBeNull()
    expect(extractMeasure('Cerveza x 6 und 330 ml')).toBeNull()
  })

  it('un conteo de latas, unidades o sobres delante de la medida la invalida', () => {
    expect(extractMeasure('Atun 3 Latas 160 G')).toBeNull()
    expect(extractMeasure('Jabon 3 Und 125 G')).toBeNull()
    expect(extractMeasure('Gaseosa 6 pack 400 ml')).toBeNull()
    expect(extractMeasure('Avena 12 sobres 30 g')).toBeNull()
  })

  it('tampoco dentro del paréntesis, ni se busca otra medida fuera', () => {
    expect(extractMeasure('Cerveza (6 x 330 ml)')).toBeNull()
    expect(extractMeasure('Atún en aceite (3 und 160 gr)')).toBeNull()
    expect(extractMeasure('Cerveza 330 ml (6 x 330 ml)')).toBeNull()
  })

  it('una "x" seguida de la medida no es un paquete', () => {
    expect(extractMeasure('Arroz Diana x 500g')?.value).toBe(500)
    expect(extractMeasure('Arroz Diana x500 g')?.value).toBe(500)
    expect(extractMeasure('Huevos x 30 und')).toEqual({ value: 30, measure: 'un', kind: 'unit' })
    expect(extractMeasure('Galletas Max 300 g')?.value).toBe(300)
  })
})

describe('extractMeasure — combos y packs escritos con palabras', () => {
  it('un "six pack" no mide lo que mide una unidad', () => {
    expect(extractMeasure('Leche entera six pack (900 ml)')).toBeNull()
    expect(extractMeasure('Té Lila SixPack x 250 ml')).toBeNull()
    expect(extractMeasure('FOURPACK MULTISABOR DE ALPINA 400 GR')).toBeNull()
    expect(extractMeasure('Chips de Vegetales Tripack 90 G')).toBeNull()
    expect(extractMeasure('Bebida de coco sin azúcar dúo pack (1000 ml)')).toBeNull()
    expect(extractMeasure('Jabón en Barra Duo Pack 500 Gr')).toBeNull()
    expect(extractMeasure('Jabón twin-pack 125 g')).toBeNull()
    expect(extractMeasure('Rosquitas Multipack 120 G')).toBeNull()
  })

  it('un "+" después de una cantidad es un combo', () => {
    expect(extractMeasure('Blanqueador Original 1800 Ml + Blanqueador Original 460 Ml')).toBeNull()
    expect(extractMeasure('KOLA GRANUL TARRIT ROJ TRA 135G+FRES 80G')).toBeNull()
    expect(extractMeasure('INSECT VOLADR 400+RAST 400ML')).toBeNull()
    expect(extractMeasure('Ambientador Toque Paraiso Azul Unidad + 1 repuesto 9g')).toBeNull()
  })

  it('"gratis", "combo", "kit" y "pague / lleve" invalidan la medida', () => {
    expect(extractMeasure('Endulzante Stevia 100 G + Gratis 50 G')).toBeNull()
    expect(
      extractMeasure('Combo Mortadela 250 G + Salchichón 250 G Gratis Salchicha 250 G'),
    ).toBeNull()
    expect(extractMeasure('Combo Alitas BBQ 900 G')).toBeNull()
    expect(extractMeasure('Kit Lustra Protector más Cubre Rasguños 300ml')).toBeNull()
    expect(extractMeasure('Spaguetti Pague 250 G Lleve 275 G')).toBeNull()
    expect(extractMeasure('Oferta Nuggets Pague 48 Lleve 60 (900 gr)')).toBeNull()
  })

  it('un "+" que es parte del nombre no es un combo', () => {
    expect(extractMeasure('Arroz Enriquecido Vita+ 5 Kg')?.value).toBe(5)
    expect(extractMeasure('Detergente Polvo Bicarbonato + Manzana 1000 G')?.value).toBe(1000)
    expect(extractMeasure('Protector Solar Spray FPS 50+ X 177ml')?.value).toBe(177)
    expect(extractMeasure('ALIMENTO LÁCTEO 1+ ESENCIAL 252 GR')?.value).toBe(252)
  })

  it('"doy pack", un "pack" suelto y "Kit Kat" no son paquetes', () => {
    expect(extractMeasure('Salsa de tomate doy pack (400 gr)')?.value).toBe(400)
    expect(extractMeasure('Detergente Líquido DoyPack 900 Ml')?.value).toBe(900)
    expect(extractMeasure('LECHE POLV ECONOPACK 350G')?.value).toBe(350)
    expect(extractMeasure('Salchicha ZENU viena roja pack (300  gr)')?.value).toBe(300)
    expect(extractMeasure('Chocolate Kit Kat 41.5 g')?.value).toBe(41.5)
  })
})

describe('extractMeasure — lo que hay justo antes del número', () => {
  it('un entero corto suelto delante de la medida la invalida', () => {
    expect(extractMeasure('Cafe 2 500 g')).toBeNull()
    expect(extractMeasure('Arena para Gatos 4 5 Kg')).toBeNull()
    expect(extractMeasure('Bon Bon Bum Fresa Pq 6 114 Gr')).toBeNull()
    expect(extractMeasure('Atún (3 160 gr)')).toBeNull()
  })

  it('una fracción no se lee como su denominador', () => {
    expect(extractMeasure('Arroz 1/2 kg')).toBeNull()
    expect(extractMeasure('Helado Chocolate 1/2 Lt')).toBeNull()
    expect(extractMeasure('Helado Jumbo 1/2L')).toBeNull()
  })

  it('un decimal partido por un espacio no se lee como su cola', () => {
    expect(extractMeasure('Crema sopera pollo 42, 5 g')).toBeNull()
  })

  it('un número que es parte del nombre no es un conteo', () => {
    expect(extractMeasure('Queso 1923 250g')?.value).toBe(250)
    expect(extractMeasure('Arroz 151 3 Kg')?.value).toBe(3)
    expect(extractMeasure('Pasta Espagueti #5 500 G')?.value).toBe(500)
    expect(extractMeasure('Carbón Común # 001 1200 G')?.value).toBe(1200)
    expect(extractMeasure('PASTA PENNE ZITI RIGA Ñ70 500 g')?.value).toBe(500)
    expect(extractMeasure('ESTUCH CHOC CORAZON T-5 55 g')?.value).toBe(55)
    expect(extractMeasure('Lavaplatos Líquido 7 en 1, 750 mL')?.value).toBe(750)
    expect(extractMeasure('Detergente 3 en 1 500 g')?.value).toBe(500)
    expect(extractMeasure('Fórmula Infantil de Inicio 0 a 12 meses - 720G')?.value).toBe(720)
  })

  it('dos medidas distintas seguidas describen un solo producto', () => {
    // 12 g de polvo que rinden 2 litros; 5 litros de helado que pesan 2200 g.
    expect(extractMeasure('TÉ DURAZNO 2L 12G')).toEqual({ value: 12, measure: 'g', kind: 'weight' })
    expect(extractMeasure('Helado Frutos Rojos 5L 2200G')?.value).toBe(2200)
  })

  it('un rango o dos medidas del mismo tipo no son una medida', () => {
    expect(extractMeasure('MARISCO LANGOSTINO 16-20 KG')).toBeNull()
    expect(extractMeasure('Jabón 125 g 375 g')).toBeNull()
  })
})

describe('extractMeasure — medidas imposibles', () => {
  it('descarta los errores de digitación de la fuente', () => {
    expect(extractMeasure('Menú Especial con Carne 1069 Kg')).toBeNull()
    expect(extractMeasure('Blanqueador Pureza Citrica 3800 Lt')).toBeNull()
    expect(extractMeasure('Yogurt Líquido sin Dulce 1,75 G')).toBeNull()
    expect(extractMeasure('Lasaña Mixta Congelada (0.39 gr)')).toBeNull()
    expect(extractMeasure('Pasta Tomate Rustica 0.7 gr')).toBeNull()
    expect(extractMeasure('Pan Artesano Con Masa Madre 1 gr')).toBeNull()
    expect(extractMeasure('Arroz Con Maiz Y Tocineta 5000 und')).toBeNull()
  })

  it('una medida imposible en el paréntesis no manda a buscar otra fuera', () => {
    expect(extractMeasure('Jugo 200 ml (1000 lt)')).toBeNull()
  })

  it('conserva los extremos reales del catálogo', () => {
    expect(extractMeasure('Laurel entero 4 g')?.value).toBe(4)
    expect(extractMeasure('Pulfen Spot On 3,2 Ml')?.value).toBe(3.2)
    expect(extractMeasure('Alimento Perros Ringo Croquetas Cachorros 30Kg')?.value).toBe(30)
    expect(extractMeasure('Arroz Florhuila Paca 12,5 Kg')?.value).toBe(12.5)
    expect(extractMeasure('Agua Botellón 20 Lt')?.value).toBe(20)
    expect(extractMeasure('Limpido Multiusos Ropa Color 18000 Ml')?.value).toBe(18000)
    expect(extractMeasure('Servilletas 1.000 und')?.value).toBe(1000)
    expect(extractMeasure('Arroz 500 g')).toEqual({ value: 500, measure: 'g', kind: 'weight' })
  })
})

describe('extractMeasure — el peso del perro no es el del producto', () => {
  it('un antipulgas se vende por el peso del animal', () => {
    expect(extractMeasure('Bravecto 37 Días 40Kg')).toBeNull()
    expect(extractMeasure('Antipulgas Simparica Trio Perro 40Kg 60Kg')).toBeNull()
    expect(extractMeasure('Credelio Perros X 3Tab 45 kg')).toBeNull()
    expect(extractMeasure('Credelio Perros 1 Tableta (22 kg)')).toBeNull()
    expect(extractMeasure('Antiparasitario Perros 20 A 40 Kg')).toBeNull()
  })

  it('un rango o un tope de peso tampoco, aunque no se nombre el remedio', () => {
    expect(extractMeasure('Spot On Gatos De 4 A 8Kg')).toBeNull()
    expect(extractMeasure('Spot On Gatos De 2.5Kg 7.5Kg')).toBeNull()
    expect(extractMeasure('Spot On Gatos Hasta 2.5Kg')).toBeNull()
    expect(extractMeasure('Arnés Perros 20Kg a 40Kg')).toBeNull()
  })

  it('la comida y la arena de mascotas conservan su peso', () => {
    expect(extractMeasure('Alimento Perro Natural Chunk 25 Kg')?.value).toBe(25)
    expect(extractMeasure('Arena Para Gatos De Maiz 24Kg')?.value).toBe(24)
    expect(extractMeasure('Alimento para Gatos Gaticos 1 a 12 Meses 1 Kg')?.value).toBe(1)
    // En gramos o mililitros la medida sí es la del producto.
    expect(extractMeasure('Antipulgas Spray Perros 250 ml')?.value).toBe(250)
  })
})

describe('tidyBrand — marcadores de "sin marca"', () => {
  it('"Generico" no es una marca', () => {
    expect(tidyBrand('Generico')).toBeNull()
    expect(tidyBrand('GENÉRICO')).toBeNull()
    expect(tidyBrand('generica')).toBeNull()
  })

  it('tampoco "sin marca." con punto, "NA", "N/A", "No Aplica" ni un guion', () => {
    expect(tidyBrand('sin marca.')).toBeNull()
    expect(tidyBrand('NA')).toBeNull()
    expect(tidyBrand('N/A')).toBeNull()
    expect(tidyBrand('n.a.')).toBeNull()
    expect(tidyBrand('No Aplica')).toBeNull()
    expect(tidyBrand('-')).toBeNull()
    expect(tidyBrand(' -- ')).toBeNull()
  })

  it('una marca que solo se les parece se conserva', () => {
    expect(tidyBrand('NAN')).toBe('Nan')
    expect(tidyBrand('Natura')).toBe('Natura')
    expect(tidyBrand('Genfar')).toBe('Genfar')
    expect(tidyBrand('Coca-Cola')).toBe('Coca-cola')
  })
})
