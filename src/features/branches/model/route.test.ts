import {
  defaultMode,
  durationLabel,
  NON_RETRYABLE_ROUTE_ERRORS,
  routeBounds,
  routeErrorCodeSchema,
  routeErrorMessage,
  routeSchema,
} from './route'

describe('defaultMode', () => {
  it('a pie si la tienda está cerca, en carro si no', () => {
    expect(defaultMode(820)).toBe('foot')
    expect(defaultMode(1499)).toBe('foot')
    expect(defaultMode(1500)).toBe('car')
    expect(defaultMode(12000)).toBe('car')
  })
})

describe('durationLabel', () => {
  it('minutos, y horas a partir de 60', () => {
    expect(durationLabel(0)).toBe('1 min')
    expect(durationLabel(250)).toBe('4 min')
    expect(durationLabel(3600)).toBe('1 h')
    expect(durationLabel(4200)).toBe('1 h 10 min')
  })
})

describe('routeSchema', () => {
  it('acepta la respuesta de la función', () => {
    const route = {
      distanceM: 912,
      durationS: 655,
      coordinates: [
        [-74.0482, 4.6766],
        [-74.0461, 4.6801],
      ],
    }
    expect(routeSchema.parse(route)).toEqual(route)
  })

  it('rechaza una ruta de un solo punto o con distancia decimal', () => {
    expect(
      routeSchema.safeParse({ distanceM: 1, durationS: 1, coordinates: [[-74, 4.6]] }).success,
    ).toBe(false)
    expect(
      routeSchema.safeParse({
        distanceM: 1.5,
        durationS: 1,
        coordinates: [
          [-74, 4.6],
          [-74, 4.7],
        ],
      }).success,
    ).toBe(false)
  })
})

describe('routeErrorMessage', () => {
  it('sin cupo o sin servicio, lo dice claro', () => {
    expect(routeErrorMessage('quota')).toMatch(/Se agotaron/)
    expect(routeErrorMessage('unavailable')).toMatch(/no está disponible/)
  })

  it('un fallo pasajero del proveedor también tiene mensaje propio', () => {
    expect(routeErrorMessage('upstream')).toMatch(/Vuelve a intentarlo/)
  })

  it('sin código conocido nunca muestra el crudo', () => {
    expect(routeErrorMessage(undefined)).toMatch(/No pudimos calcular la ruta/)
  })
})

describe('routeErrorCodeSchema', () => {
  it('un código que la app no conoce no se acepta', () => {
    expect(routeErrorCodeSchema.safeParse('boom').success).toBe(false)
    expect(routeErrorCodeSchema.safeParse('quota').success).toBe(true)
  })
})

describe('NON_RETRYABLE_ROUTE_ERRORS', () => {
  it('no reintenta lo que daría la misma respuesta; sí lo pasajero', () => {
    expect(NON_RETRYABLE_ROUTE_ERRORS.has('invalid')).toBe(true)
    expect(NON_RETRYABLE_ROUTE_ERRORS.has('quota')).toBe(true)
    expect(NON_RETRYABLE_ROUTE_ERRORS.has('upstream')).toBe(false)
    expect(NON_RETRYABLE_ROUTE_ERRORS.has('network')).toBe(false)
  })
})

describe('routeBounds', () => {
  it('oeste-sur-este-norte de la línea', () => {
    expect(
      routeBounds([
        [-74.05, 4.67],
        [-74.04, 4.69],
        [-74.06, 4.68],
      ]),
    ).toEqual([-74.06, 4.67, -74.04, 4.69])
  })
})
