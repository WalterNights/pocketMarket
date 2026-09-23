import { capitaliseFirst, cleanProductName, extractMeasure, tidyBrand, toCop } from './normalize'

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
    expect(cleanProductName('DORIA (500 gr)', 'DORIA')).toBe('')
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
})

describe('capitaliseFirst', () => {
  it('sube la primera letra sin tocar el resto', () => {
    expect(capitaliseFirst('pastas spaghetti')).toBe('Pastas spaghetti')
    expect(capitaliseFirst('')).toBe('')
  })
})
