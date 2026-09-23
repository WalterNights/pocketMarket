import { routeParamsSchema } from './route-params'

describe('routeParamsSchema', () => {
  it('acepta params normales', () => {
    const r = routeParamsSchema.safeParse({ slug: 'exito', name: 'Éxito' })
    expect(r.success && r.data).toEqual({ slug: 'exito', name: 'Éxito' })
  })

  it('el nombre es opcional', () => {
    const r = routeParamsSchema.safeParse({ slug: 'd1' })
    expect(r.success && r.data.slug).toBe('d1')
  })

  it('toma el primero cuando el param llega repetido', () => {
    const r = routeParamsSchema.safeParse({ slug: ['exito', 'd1'] })
    expect(r.success && r.data.slug).toBe('exito')
  })

  it('rechaza un deep link sin slug en vez de crashear', () => {
    expect(routeParamsSchema.safeParse({}).success).toBe(false)
    expect(routeParamsSchema.safeParse({ slug: '' }).success).toBe(false)
  })
})
