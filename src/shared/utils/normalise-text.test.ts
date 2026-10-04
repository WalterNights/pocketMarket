import { normaliseText } from './normalise-text'

describe('normaliseText', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normaliseText('PLÁTANO')).toBe('platano')
    expect(normaliseText('Piña')).toBe('pina')
    expect(normaliseText('Café')).toBe('cafe')
  })

  it('deja intacto lo que ya está normalizado', () => {
    expect(normaliseText('arroz blanco')).toBe('arroz blanco')
  })
})
