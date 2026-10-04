import { navigationView, type NavigationState } from './navigation-view'

const ROUTE = { distanceM: 1000, durationS: 720 }
const BASE: NavigationState = {
  arrived: false,
  route: undefined,
  progress: null,
  rerouting: false,
  failure: null,
}

describe('navigationView', () => {
  it('sin ruta todavía, calcula', () => {
    expect(navigationView(BASE)).toEqual({ kind: 'loading' })
  })

  it('sin ruta y con fallo, muestra el error en palabras del usuario', () => {
    expect(navigationView({ ...BASE, failure: { code: 'quota' } })).toEqual({
      kind: 'error',
      message: expect.stringMatching(/Se agotaron/),
    })
  })

  it('con ruta y sin lecturas del GPS, muestra lo que dio el servicio', () => {
    expect(navigationView({ ...BASE, route: ROUTE })).toEqual({
      kind: 'following',
      remainingM: 1000,
      remainingS: 720,
      rerouting: false,
      failure: null,
    })
  })

  it('con progreso, muestra lo que falta desde donde está', () => {
    const view = navigationView({
      ...BASE,
      route: ROUTE,
      progress: { remainingM: 400, remainingS: 290 },
      rerouting: true,
    })
    expect(view).toMatchObject({ kind: 'following', remainingM: 400, rerouting: true })
  })

  it('si falla un recálculo, sigue la ruta anterior y lo avisa', () => {
    const view = navigationView({ ...BASE, route: ROUTE, failure: { code: 'network' } })
    expect(view).toMatchObject({
      kind: 'following',
      failure: expect.stringMatching(/Sin conexión/),
    })
  })

  it('llegar gana a todo, aunque no haya ruta', () => {
    expect(navigationView({ ...BASE, arrived: true, failure: { code: 'upstream' } })).toEqual({
      kind: 'arrived',
    })
  })
})
