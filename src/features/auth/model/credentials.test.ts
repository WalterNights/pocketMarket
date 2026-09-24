import { authErrorMessage, safeRedirect, signInSchema, signUpSchema } from './credentials'

describe('signUpSchema', () => {
  const valid = { displayName: ' Walter ', email: ' Walter@Correo.COM ', password: '12345678' }

  it('limpia nombre y correo', () => {
    expect(signUpSchema.parse(valid)).toEqual({
      displayName: 'Walter',
      email: 'walter@correo.com',
      password: '12345678',
    })
  })

  it('exige 8 caracteres de contraseña, igual que el servidor', () => {
    const result = signUpSchema.safeParse({ ...valid, password: '1234567' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Mínimo 8 caracteres')
  })

  it('rechaza un correo mal escrito y un nombre en blanco', () => {
    expect(signUpSchema.safeParse({ ...valid, email: 'walter@' }).success).toBe(false)
    expect(signUpSchema.safeParse({ ...valid, displayName: '   ' }).success).toBe(false)
  })

  it('no recorta la contraseña: los espacios son parte de ella', () => {
    expect(signUpSchema.parse({ ...valid, password: ' 1234567 ' }).password).toBe(' 1234567 ')
  })
})

describe('signInSchema', () => {
  it('pide los dos campos', () => {
    const result = signInSchema.safeParse({ email: '', password: '' })
    expect(result.error?.issues.map((i) => i.message)).toEqual([
      'Escribe tu correo',
      'Escribe tu contraseña',
    ])
  })
})

describe('authErrorMessage', () => {
  it('no revela si el correo está registrado', () => {
    expect(authErrorMessage('invalid_credentials')).toBe('Correo o contraseña incorrectos.')
  })

  it('traduce un registro duplicado', () => {
    expect(authErrorMessage('user_already_exists')).toMatch(/Ya hay una cuenta/)
  })

  it('un código desconocido o ausente da un mensaje genérico, nunca el crudo', () => {
    expect(authErrorMessage('something_new')).toBe('Algo salió mal. Vuelve a intentarlo.')
    expect(authErrorMessage(undefined)).toBe('Algo salió mal. Vuelve a intentarlo.')
  })
})

describe('safeRedirect', () => {
  it('acepta rutas internas', () => {
    expect(safeRedirect('/lists')).toBe('/lists')
    expect(safeRedirect(['/account', '/otra'])).toBe('/account')
  })

  it('rechaza lo que saldría de la app', () => {
    expect(safeRedirect('//evil.com')).toBe('/')
    expect(safeRedirect('https://evil.com')).toBe('/')
    expect(safeRedirect('javascript:alert(1)')).toBe('/')
    expect(safeRedirect('/\\evil.com')).toBe('/')
  })

  it('no vuelve al login ni acepta basura', () => {
    expect(safeRedirect('/sign-in')).toBe('/')
    expect(safeRedirect(undefined)).toBe('/')
    expect(safeRedirect(42)).toBe('/')
    expect(safeRedirect('lists')).toBe('/')
  })
})
