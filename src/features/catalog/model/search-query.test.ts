import { toPrefixQuery } from './search-query'

describe('toPrefixQuery', () => {
  it('cada letra que se escribe ya busca: g, go, gom, gomi', () => {
    expect(toPrefixQuery('g')).toBe('g:*')
    expect(toPrefixQuery('go')).toBe('go:*')
    expect(toPrefixQuery('gom')).toBe('gom:*')
    expect(toPrefixQuery('gomi')).toBe('gomi:*')
  })

  it('varias palabras tienen que estar todas, cada una como comienzo', () => {
    expect(toPrefixQuery('leche alm')).toBe('leche:*&alm:*')
  })

  it('quita tildes y mayúsculas, como el índice', () => {
    expect(toPrefixQuery('PLÁtano')).toBe('platano:*')
  })

  it('la ñ se busca como n, que es como la guarda el índice', () => {
    expect(toPrefixQuery('piñ')).toBe('pin:*')
  })

  it('los símbolos separan palabras y nunca llegan a la consulta', () => {
    expect(toPrefixQuery("coca-cola 1.5 & !x:* (y) 'z'")).toBe('coca:*&cola:*&1:*&5:*&x:*&y:*')
  })

  it('sin nada que buscar devuelve null', () => {
    expect(toPrefixQuery('')).toBeNull()
    expect(toPrefixQuery('   ')).toBeNull()
    expect(toPrefixQuery('---')).toBeNull()
  })

  it('recorta una palabra absurdamente larga', () => {
    expect(toPrefixQuery('x'.repeat(500))).toBe(`${'x'.repeat(30)}:*`)
  })

  it('limita el número de palabras', () => {
    expect(toPrefixQuery('a b c d e f g h')?.split('&')).toHaveLength(6)
  })
})
