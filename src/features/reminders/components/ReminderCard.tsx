import BellOff from 'lucide-react-native/icons/bell-off'
import BellRing from 'lucide-react-native/icons/bell-ring'
import type { ReactNode } from 'react'
import { Pressable, Text, View } from 'react-native'

import { notifications } from '@/shared/lib/notifications'

import { useListReminder, useNotificationPermission } from '../hooks/useListReminder'
import { describeReminder, formatShortDate, nextOccurrences } from '../model/reminder'

const FOREGROUND = '#1F1D1B'
const MUTED = '#78726B'

type ReminderCardProps = {
  listId: string
  onEdit: () => void
}

/**
 * The reminder of a saved list, in one card. When notifications are denied the
 * reminder still exists: the card says when the next shop is due and offers the
 * way back to system settings — the feature degrades, it does not vanish
 * (03-reminders.md, "Si se deniega el permiso").
 */
export function ReminderCard({ listId, onEdit }: ReminderCardProps) {
  const reminder = useListReminder(listId)
  const permission = useNotificationPermission()

  if (reminder.isPending) {
    return <View className="h-[76px] rounded-lg border border-border bg-card" />
  }

  if (reminder.isError) {
    return (
      <CardFrame icon={<BellOff size={20} color={MUTED} strokeWidth={1.75} />}>
        <Text className="text-sm text-foreground">No se pudo cargar el aviso.</Text>
        <Action label="Reintentar" onPress={() => void reminder.refetch()} />
      </CardFrame>
    )
  }

  if (reminder.data === null) {
    return (
      <CardFrame icon={<BellOff size={20} color={MUTED} strokeWidth={1.75} />}>
        <Text className="text-sm text-foreground">Sin aviso</Text>
        <Text className="mt-0.5 text-xs text-muted-foreground">
          Te recordamos cuándo hacer mercado con esta lista.
        </Text>
        <Action label="Añadir aviso" onPress={onEdit} />
      </CardFrame>
    )
  }

  const next = nextOccurrences(reminder.data, new Date(), 1)[0]
  const denied = permission.data === 'denied'

  return (
    <CardFrame icon={<BellRing size={20} color={FOREGROUND} strokeWidth={1.75} />}>
      <Text className="text-sm text-foreground">{describeReminder(reminder.data)}</Text>
      {next ? (
        <Text className="mt-0.5 text-xs text-muted-foreground">
          Próximo mercado: {formatShortDate(next)}
        </Text>
      ) : null}

      {denied ? (
        <View className="mt-2">
          <Text className="text-xs text-muted-foreground">
            Las notificaciones están desactivadas, así que el teléfono no sonará.
          </Text>
          <Action label="Activarlas en Ajustes" onPress={() => void notifications.openSettings()} />
        </View>
      ) : null}

      <Action label="Cambiar aviso" onPress={onEdit} />
    </CardFrame>
  )
}

function CardFrame({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <View className="flex-row rounded-lg border border-border bg-card p-4">
      <View className="mr-3 pt-0.5">{icon}</View>
      <View className="flex-1">{children}</View>
    </View>
  )
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={8}
      className="mt-2 h-11 justify-center self-start"
    >
      <Text className="text-sm font-medium text-foreground underline">{label}</Text>
    </Pressable>
  )
}
