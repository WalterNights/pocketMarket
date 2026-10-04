import { isClientErrorCode, isNonRetryableError } from './error-classification'

describe('isClientErrorCode', () => {
  it('"sin filas" de .single() no se reintenta', () => {
    expect(isClientErrorCode('PGRST116')).toBe(true)
  })

  it('JWT y caché de esquema son errores de la petición', () => {
    expect(isClientErrorCode('PGRST301')).toBe(true)
    expect(isClientErrorCode('PGRST205')).toBe(true)
  })

  it('la conexión de PostgREST con la base de datos sí es transitoria', () => {
    expect(isClientErrorCode('PGRST000')).toBe(false)
    expect(isClientErrorCode('PGRST003')).toBe(false)
  })

  it('RLS, restricciones y excepciones de función no se reintentan', () => {
    expect(isClientErrorCode('42501')).toBe(true)
    expect(isClientErrorCode('23505')).toBe(true)
    expect(isClientErrorCode('22023')).toBe(true)
    expect(isClientErrorCode('P0002')).toBe(true)
  })

  it('sin código, o con código vacío, es la red: se reintenta', () => {
    expect(isClientErrorCode(undefined)).toBe(false)
    expect(isClientErrorCode('')).toBe(false)
  })

  it('recursos agotados y cancelaciones se reintentan', () => {
    expect(isClientErrorCode('53300')).toBe(false)
    expect(isClientErrorCode('57014')).toBe(false)
  })
})

describe('isNonRetryableError', () => {
  it('respeta la clasificación del propio error', () => {
    expect(isNonRetryableError({ isClientError: true })).toBe(true)
    expect(isNonRetryableError({ isClientError: false })).toBe(false)
  })

  it('un error sin clasificar se reintenta', () => {
    expect(isNonRetryableError(new Error('boom'))).toBe(false)
    expect(isNonRetryableError(null)).toBe(false)
    expect(isNonRetryableError({ isClientError: 'yes' })).toBe(false)
  })

  it('lee la clasificación aunque venga de un getter', () => {
    class Classified extends Error {
      get isClientError(): boolean {
        return true
      }
    }
    expect(isNonRetryableError(new Classified())).toBe(true)
  })
})
