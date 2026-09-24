import { greetingName, toSessionUser } from './session'

const ID = '5b0f2a52-3c1e-4c55-9d7e-1f0a6f4b2c11'

describe('toSessionUser', () => {
  it('toma el nombre de los metadatos del registro', () => {
    expect(
      toSessionUser({ id: ID, email: 'w@x.co', user_metadata: { display_name: ' Walter ' } }),
    ).toEqual({ id: ID, email: 'w@x.co', displayName: 'Walter' })
  })

  it('ignora metadatos ausentes o con otra forma', () => {
    expect(toSessionUser({ id: ID }).displayName).toBeNull()
    expect(toSessionUser({ id: ID, user_metadata: { display_name: 42 } }).displayName).toBeNull()
    expect(toSessionUser({ id: ID, user_metadata: { display_name: '  ' } }).displayName).toBeNull()
  })

  it('falla ante un id que no es uuid', () => {
    expect(() => toSessionUser({ id: 'no' })).toThrow()
  })
})

describe('greetingName', () => {
  it('usa el primer nombre, o la parte local del correo', () => {
    expect(greetingName({ id: ID, email: null, displayName: 'Walter Nights' })).toBe('Walter')
    expect(greetingName({ id: ID, email: 'walter@x.co', displayName: null })).toBe('walter')
    expect(greetingName({ id: ID, email: null, displayName: null })).toBe('tú')
  })
})
