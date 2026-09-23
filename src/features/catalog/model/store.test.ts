import { freshnessLabel, isBrowsable, type Store } from './store'

const baseStore: Store = {
  id: '00000000-0000-0000-0000-000000000001',
  slug: 'exito',
  name: 'Éxito',
  sourceType: 'api',
  isActive: true,
  productCount: 10,
  lastUpdatedAt: '2026-09-23T10:00:00.000Z',
}

const storeWith = (patch: Partial<Store>): Store => ({ ...baseStore, ...patch })

describe('isBrowsable', () => {
  it('una tienda activa con productos se puede explorar', () => {
    expect(isBrowsable(baseStore)).toBe(true)
  })

  it('una tienda sin adaptador construido todavía no', () => {
    expect(isBrowsable(storeWith({ isActive: false, productCount: 0 }))).toBe(false)
  })

  it('activa pero sin productos tampoco', () => {
    expect(isBrowsable(storeWith({ productCount: 0 }))).toBe(false)
  })
})

describe('freshnessLabel', () => {
  const now = new Date('2026-09-23T12:00:00.000Z')

  it('menos de una hora', () => {
    expect(freshnessLabel('2026-09-23T11:30:00.000Z', now)).toBe('Precios de hace un momento')
  })

  it('horas', () => {
    expect(freshnessLabel('2026-09-23T06:00:00.000Z', now)).toBe('Precios de hace 6 h')
  })

  it('ayer', () => {
    expect(freshnessLabel('2026-09-22T10:00:00.000Z', now)).toBe('Precios de ayer')
  })

  it('varios días', () => {
    expect(freshnessLabel('2026-09-20T10:00:00.000Z', now)).toBe('Precios de hace 3 días')
  })

  it('sin datos lo dice, no finge frescura', () => {
    expect(freshnessLabel(null, now)).toBe('Sin datos todavía')
    expect(freshnessLabel('no-es-una-fecha', now)).toBe('Sin datos todavía')
  })
})
