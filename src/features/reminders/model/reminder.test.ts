import {
  anchorFor,
  describeReminder,
  formatShortDate,
  formatTime,
  isoWeekday,
  nextOccurrences,
  reminderSchema,
  toReminder,
  DEFAULT_DRAFT,
  type Reminder,
} from './reminder'

const LIST = '11111111-1111-4111-8111-111111111111'

const weekly = (patch: Partial<Reminder> = {}): Reminder => ({
  listId: LIST,
  frequency: 'weekly',
  weekday: 6, // sábado
  dayOfMonth: null,
  timeLocal: '08:00',
  anchorDate: null,
  isEnabled: true,
  ...patch,
})

const monthly = (day: number): Reminder =>
  weekly({ frequency: 'monthly', weekday: null, dayOfMonth: day })

// Wednesday 1 October 2025, 10:00 local.
const WED = new Date(2025, 9, 1, 10, 0)

describe('isoWeekday / anchorFor', () => {
  it('lunes es 1 y domingo es 7', () => {
    expect(isoWeekday(new Date(2025, 8, 29))).toBe(1)
    expect(isoWeekday(new Date(2025, 9, 5))).toBe(7)
  })

  it('el ancla es el primer día pedido desde hoy, hoy incluido', () => {
    expect(anchorFor(6, WED)).toBe('2025-10-04')
    expect(anchorFor(3, WED)).toBe('2025-10-01')
  })
})

describe('nextOccurrences — semanal', () => {
  it('cada sábado a las 8', () => {
    expect(nextOccurrences(weekly(), WED, 3)).toEqual([
      new Date(2025, 9, 4, 8, 0),
      new Date(2025, 9, 11, 8, 0),
      new Date(2025, 9, 18, 8, 0),
    ])
  })

  it('si hoy es el día pero la hora ya pasó, empieza la semana siguiente', () => {
    const wedReminder = weekly({ weekday: 3, timeLocal: '07:00' })
    expect(nextOccurrences(wedReminder, WED, 1)).toEqual([new Date(2025, 9, 8, 7, 0)])
  })

  it('si hoy es el día y la hora no ha llegado, es hoy', () => {
    const wedReminder = weekly({ weekday: 3, timeLocal: '20:00' })
    expect(nextOccurrences(wedReminder, WED, 1)).toEqual([new Date(2025, 9, 1, 20, 0)])
  })

  it('desactivado no programa nada', () => {
    expect(nextOccurrences(weekly({ isEnabled: false }), WED, 3)).toEqual([])
  })
})

describe('nextOccurrences — quincenal', () => {
  it('cuenta los 14 días desde el ancla, aunque el ancla sea vieja', () => {
    const biweekly = weekly({ frequency: 'biweekly', anchorDate: '2025-09-06' })
    expect(nextOccurrences(biweekly, WED, 2)).toEqual([
      new Date(2025, 9, 4, 8, 0),
      new Date(2025, 9, 18, 8, 0),
    ])
  })

  it('con el ancla en la semana "de descanso", salta al sábado correcto', () => {
    const biweekly = weekly({ frequency: 'biweekly', anchorDate: '2025-09-13' })
    expect(nextOccurrences(biweekly, WED, 1)).toEqual([new Date(2025, 9, 11, 8, 0)])
  })
})

describe('nextOccurrences — mensual', () => {
  it('el día 15 de cada mes', () => {
    expect(nextOccurrences(monthly(15), WED, 2)).toEqual([
      new Date(2025, 9, 15, 8, 0),
      new Date(2025, 10, 15, 8, 0),
    ])
  })

  it('el 31 cae el último día en los meses cortos, nunca se salta un mes', () => {
    const fromJan = new Date(2026, 0, 1, 9, 0)
    expect(nextOccurrences(monthly(31), fromJan, 4)).toEqual([
      new Date(2026, 0, 31, 8, 0),
      new Date(2026, 1, 28, 8, 0),
      new Date(2026, 2, 31, 8, 0),
      new Date(2026, 3, 30, 8, 0),
    ])
  })

  it('el 29 en un febrero bisiesto sí es el 29', () => {
    const fromFeb = new Date(2028, 1, 1, 9, 0)
    expect(nextOccurrences(monthly(29), fromFeb, 1)).toEqual([new Date(2028, 1, 29, 8, 0)])
  })

  it('si el día de este mes ya pasó, empieza el mes siguiente', () => {
    expect(nextOccurrences(monthly(1), WED, 1)).toEqual([new Date(2025, 10, 1, 8, 0)])
  })
})

describe('reminderSchema', () => {
  it('acepta la hora de Postgres con segundos', () => {
    expect(reminderSchema.parse({ ...weekly(), timeLocal: '08:00:00' }).timeLocal).toBe('08:00')
  })

  it('rechaza la forma que la base también rechaza', () => {
    expect(reminderSchema.safeParse({ ...weekly(), dayOfMonth: 5 }).success).toBe(false)
    expect(reminderSchema.safeParse({ ...weekly({ frequency: 'biweekly' }) }).success).toBe(false)
    expect(reminderSchema.safeParse({ ...monthly(5), weekday: 2 }).success).toBe(false)
  })
})

describe('textos', () => {
  it('hora a la colombiana', () => {
    expect(formatTime('07:00')).toBe('7:00 a. m.')
    expect(formatTime('12:00')).toBe('12:00 p. m.')
    expect(formatTime('20:00')).toBe('8:00 p. m.')
  })

  it('describe cada frecuencia', () => {
    expect(describeReminder(weekly())).toBe('Cada sábado, a las 8:00 a. m.')
    expect(describeReminder(weekly({ frequency: 'biweekly', anchorDate: '2025-10-04' }))).toBe(
      'Cada dos semanas, el sábado, a las 8:00 a. m.',
    )
    expect(describeReminder(monthly(15))).toBe('El día 15 de cada mes, a las 8:00 a. m.')
    expect(describeReminder(monthly(31))).toMatch(/último día/)
  })

  it('fecha corta', () => {
    expect(formatShortDate(new Date(2025, 9, 4))).toBe('sáb 4 oct')
  })
})

describe('toReminder', () => {
  it('semanal: sin ancla ni día del mes', () => {
    expect(toReminder(DEFAULT_DRAFT, LIST, WED)).toEqual(weekly())
  })

  it('mensual: solo el día del mes', () => {
    const r = toReminder({ ...DEFAULT_DRAFT, frequency: 'monthly', dayOfMonth: 31 }, LIST, WED)
    expect(r).toMatchObject({ weekday: null, dayOfMonth: 31, anchorDate: null })
  })

  it('quincenal nuevo: el ancla es el próximo día elegido', () => {
    const r = toReminder({ ...DEFAULT_DRAFT, frequency: 'biweekly' }, LIST, WED)
    expect(r.anchorDate).toBe('2025-10-04')
  })

  it('quincenal editado sin cambiar el día: conserva el ancla, no corre la quincena', () => {
    const previous = weekly({ frequency: 'biweekly', anchorDate: '2025-09-06' })
    const r = toReminder(
      { ...DEFAULT_DRAFT, frequency: 'biweekly', timeLocal: '18:00' },
      LIST,
      WED,
      previous,
    )
    expect(r.anchorDate).toBe('2025-09-06')
  })

  it('quincenal con otro día: ancla nueva', () => {
    const previous = weekly({ frequency: 'biweekly', anchorDate: '2025-09-06' })
    const r = toReminder(
      { ...DEFAULT_DRAFT, frequency: 'biweekly', weekday: 7 },
      LIST,
      WED,
      previous,
    )
    expect(r.anchorDate).toBe('2025-10-05')
  })

  it('lo que produce siempre pasa el schema', () => {
    for (const frequency of ['weekly', 'biweekly', 'monthly'] as const) {
      expect(
        reminderSchema.safeParse(toReminder({ ...DEFAULT_DRAFT, frequency }, LIST, WED)).success,
      ).toBe(true)
    }
  })
})
