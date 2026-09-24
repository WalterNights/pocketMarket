import { NOTIFICATION_BUDGET, planNotifications, reconcile, type ReminderContext } from './plan'
import type { Reminder } from './reminder'

const WED = new Date(2025, 9, 1, 10, 0)

const context = (listId: string, patch: Partial<Reminder> = {}): ReminderContext => ({
  reminder: {
    listId,
    frequency: 'weekly',
    weekday: 6,
    dayOfMonth: null,
    timeLocal: '08:00',
    anchorDate: null,
    isEnabled: true,
    ...patch,
  },
  listName: 'Mercado',
  itemCount: 23,
  totalCop: 182400,
})

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('planNotifications', () => {
  it('texto útil sin abrir la app, con el total aproximado', () => {
    const [first] = planNotifications([context(uuid(1))], WED)

    expect(first?.title).toBe('Hora del mercado')
    expect(first?.body).toMatch(/^"Mercado" · 23 productos · ~\$\s?182\.400$/)
    expect(first?.date).toEqual(new Date(2025, 9, 4, 8, 0))
  })

  it('el identificador es determinista: misma fecha, mismo id', () => {
    const a = planNotifications([context(uuid(1))], WED)
    const b = planNotifications([context(uuid(1))], new Date(2025, 9, 1, 11, 0))

    expect(a.map((n) => n.identifier)).toEqual(b.map((n) => n.identifier))
    expect(a[0]?.identifier).toBe(`reminder:${uuid(1)}:202510040800`)
  })

  it('nunca pasa del presupuesto de iOS, por muchos recordatorios que haya', () => {
    const many = Array.from({ length: 20 }, (_, i) => context(uuid(i)))
    const plan = planNotifications(many, WED)

    expect(plan).toHaveLength(NOTIFICATION_BUDGET)
    expect(NOTIFICATION_BUDGET).toBeLessThan(64)
  })

  it('con el presupuesto justo, cada recordatorio conserva sus fechas más cercanas', () => {
    const plan = planNotifications([context(uuid(1)), context(uuid(2), { weekday: 7 })], WED, 4)

    expect(plan.map((n) => n.date.getDate())).toEqual([4, 5, 11, 12])
    expect(new Set(plan.map((n) => n.listId)).size).toBe(2)
  })

  it('un recordatorio desactivado no ocupa sitio', () => {
    expect(planNotifications([context(uuid(1), { isEnabled: false })], WED)).toEqual([])
  })
})

describe('reconcile', () => {
  const plan = planNotifications([context(uuid(1))], WED, 2)

  it('primera vez: programa todo, no cancela nada', () => {
    const actions = reconcile(plan, [])
    expect(actions.cancel).toEqual([])
    expect(actions.schedule).toHaveLength(2)
  })

  it('es idempotente: con todo ya programado, no cancela nada', () => {
    const actions = reconcile(
      plan,
      plan.map((n) => n.identifier),
    )
    expect(actions.cancel).toEqual([])
  })

  it('cancela lo de un recordatorio borrado', () => {
    const stale = `reminder:${uuid(9)}:202510040800`
    expect(reconcile(plan, [stale]).cancel).toEqual([stale])
  })

  it('no toca notificaciones que no son suyas', () => {
    expect(reconcile(plan, ['otra-cosa:123']).cancel).toEqual([])
  })
})
