import { compileKeyword, compileKeywordTable, firstMatch } from './keyword-match'

describe('compileKeyword', () => {
  it('casa la palabra entera y su plural', () => {
    const pan = compileKeyword('pan')
    expect(pan.test('pan tajado')).toBe(true)
    expect(pan.test('panes de bono')).toBe(true)
    expect(pan.test('panal')).toBe(false)
    expect(pan.test('pantene')).toBe(false)
  })

  it('no encuentra la palabra dentro de otra (ING-006)', () => {
    expect(compileKeyword('res').test('refresco de fresa')).toBe(false)
    expect(compileKeyword('agua').test('aguacate')).toBe(false)
  })

  it('una clave con * es una raíz explícita', () => {
    const stem = compileKeyword('salchich*')
    expect(stem.test('salchichon')).toBe(true)
    expect(stem.test('salchichas')).toBe(true)
  })

  it('normaliza la clave igual que el texto (ING-001)', () => {
    expect(compileKeyword('piña').test('pina golden')).toBe(true)
    expect(compileKeyword('piña').test('espinaca')).toBe(false)
  })
})

describe('firstMatch', () => {
  const table = compileKeywordTable([
    ['pasta dental', 'aseo'],
    ['pasta', 'despensa'],
  ])

  it('respeta el orden: la regla más específica primero', () => {
    expect(firstMatch(table, 'Pasta dental')).toBe('aseo')
    expect(firstMatch(table, 'Pasta corta')).toBe('despensa')
  })

  it('normaliza el texto de entrada', () => {
    expect(firstMatch(table, 'PASTA Dental')).toBe('aseo')
  })

  it('devuelve undefined si nada casa', () => {
    expect(firstMatch(table, 'Arroz')).toBeUndefined()
  })
})
