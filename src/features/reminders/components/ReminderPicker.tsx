import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import {
  describeReminder,
  END_OF_MONTH,
  formatTime,
  MONTH_DAYS,
  REMINDER_TIMES,
  toReminder,
  weekdayName,
  type Frequency,
  type ReminderDraft,
} from '../model/reminder'

const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
}

const WEEKDAY_INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

type ReminderPickerProps = {
  value: ReminderDraft
  onChange: (value: ReminderDraft) => void
}

/**
 * How often and when. Chips instead of wheels: every option is visible and one
 * tap away, and no native date picker is needed. Controlled — the caller owns
 * the draft and decides when it becomes a saved reminder.
 */
export function ReminderPicker({ value, onChange }: ReminderPickerProps) {
  const set = (patch: Partial<ReminderDraft>) => onChange({ ...value, ...patch })

  // Preview through the same conversion that saves it, so what is read is
  // exactly what will ring. The list id is irrelevant to the sentence.
  const preview = describeReminder(toReminder(value, PREVIEW_LIST_ID, new Date()))

  return (
    <View>
      <Group label="Frecuencia">
        {(['weekly', 'biweekly', 'monthly'] as const).map((frequency) => (
          <Chip
            key={frequency}
            label={FREQUENCY_LABELS[frequency]}
            selected={value.frequency === frequency}
            onPress={() => set({ frequency })}
          />
        ))}
      </Group>

      {value.frequency === 'monthly' ? (
        <Group label="Día del mes">
          {MONTH_DAYS.map((day) => (
            <Chip
              key={day}
              label={day === END_OF_MONTH ? 'Fin de mes' : String(day)}
              accessibilityLabel={day === END_OF_MONTH ? 'Fin de mes' : `Día ${day}`}
              selected={value.dayOfMonth === day}
              onPress={() => set({ dayOfMonth: day })}
            />
          ))}
        </Group>
      ) : (
        <Group label="Día">
          {WEEKDAY_INITIALS.map((initial, index) => {
            const weekday = index + 1
            return (
              <Chip
                key={weekday}
                label={initial}
                accessibilityLabel={weekdayName(weekday)}
                selected={value.weekday === weekday}
                onPress={() => set({ weekday })}
                square
              />
            )
          })}
        </Group>
      )}

      <Group label="Hora">
        {REMINDER_TIMES.map((time) => (
          <Chip
            key={time}
            label={formatTime(time)}
            selected={value.timeLocal === time}
            onPress={() => set({ timeLocal: time })}
          />
        ))}
      </Group>

      <Text className="mt-1 text-sm text-muted-foreground" accessibilityLiveRegion="polite">
        {preview}
      </Text>
    </View>
  )
}

const PREVIEW_LIST_ID = '00000000-0000-4000-8000-000000000000'

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="mb-4" accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text className="mb-2 text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  )
}

type ChipProps = {
  label: string
  accessibilityLabel?: string
  selected: boolean
  onPress: () => void
  /** One-letter weekday chips: square keeps the row of seven even. */
  square?: boolean
}

/**
 * Selection is carried by fill AND weight, not by colour alone
 * (ui-styling.md): the selected chip is inverted and its label bold.
 */
function Chip({ label, accessibilityLabel, selected, onPress, square = false }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, checked: selected }}
      className={`h-11 items-center justify-center rounded-md border ${
        square ? 'w-11' : 'px-3'
      } ${selected ? 'border-primary bg-primary' : 'border-border bg-card active:bg-muted'}`}
    >
      <Text
        className={`text-sm ${
          selected ? 'font-semibold text-primary-foreground' : 'text-foreground'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  )
}
