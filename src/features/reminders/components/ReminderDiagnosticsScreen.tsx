import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useDiagnosticsActions, useReminderDiagnostics } from '../hooks/useReminderDiagnostics'
import type { PlannedNotification, ScheduledReminder } from '../model/plan'
import { formatShortDate, formatTime } from '../model/reminder'

const PERMISSION_LABELS = {
  granted: 'Concedido',
  denied: 'Denegado (hay que activarlo en Ajustes)',
  undetermined: 'Sin pedir todavía',
  unavailable: 'No disponible en este entorno (Expo Go en Android)',
} as const

/**
 * Development tool, not a user screen: shows what should ring against what the
 * phone holds, and fires a real notification a minute out. A ScrollView is
 * fine here — the lists are capped by the 56-notification budget.
 */
export function ReminderDiagnosticsScreen() {
  const insets = useSafeAreaInsets()
  const diagnostics = useReminderDiagnostics()
  const { requestPermission, syncNow, scheduleTest, cancelTests } = useDiagnosticsActions()

  if (diagnostics.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator accessibilityLabel="Leyendo avisos programados" />
      </View>
    )
  }

  if (diagnostics.isError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-base text-foreground">
          No se pudo leer el estado de los avisos.
        </Text>
        <Text className="mt-2 text-center text-xs text-muted-foreground">
          {String(diagnostics.error)}
        </Text>
        <DebugButton label="Reintentar" onPress={() => void diagnostics.refetch()} />
      </View>
    )
  }

  const data = diagnostics.data
  const firstListId = data.planned[0]?.listId ?? null
  const busy =
    requestPermission.isPending ||
    syncNow.isPending ||
    scheduleTest.isPending ||
    cancelTests.isPending

  return (
    <ScrollView
      className="flex-1 bg-background px-4"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}
    >
      <Section title="Entorno">
        <Row label="Permiso" value={PERMISSION_LABELS[data.permission]} />
        <Row label="Planeados (Supabase)" value={String(data.planned.length)} />
        <Row label="Programados (teléfono)" value={String(data.scheduled.length)} />
        <Row label="Avisos de prueba pendientes" value={String(data.testCount)} />
        <Row
          label="Reconciliación"
          value={data.inSync ? '✓ Coinciden' : '✗ No coinciden — pulsa "Sincronizar"'}
        />
      </Section>

      <Section title="Acciones">
        <DebugButton
          label="Pedir permiso"
          disabled={busy}
          onPress={() => requestPermission.mutate()}
        />
        <DebugButton label="Sincronizar ahora" disabled={busy} onPress={() => syncNow.mutate()} />
        <DebugButton
          label={
            firstListId ? 'Aviso de prueba en 1 min (abre una lista)' : 'Aviso de prueba en 1 min'
          }
          disabled={busy || data.permission !== 'granted'}
          onPress={() => scheduleTest.mutate(firstListId)}
        />
        <DebugButton
          label="Cancelar avisos de prueba"
          disabled={busy || data.testCount === 0}
          onPress={() => cancelTests.mutate()}
        />
        <DebugButton label="Refrescar" disabled={busy} onPress={() => void diagnostics.refetch()} />
        <Text className="mt-2 text-xs text-muted-foreground">
          Para el aviso de prueba, bloquea el teléfono o sal de la app: así se comprueba también que
          suena en segundo plano.
        </Text>
      </Section>

      <Section title="Planeados (lo que debería sonar)">
        {data.planned.length === 0 ? (
          <Text className="text-sm text-muted-foreground">
            Ninguno. Crea un aviso en una lista guardada.
          </Text>
        ) : (
          data.planned.map((item) => <PlannedRow key={item.identifier} item={item} />)
        )}
      </Section>

      <Section title="Programados en el teléfono">
        {data.scheduled.length === 0 ? (
          <Text className="text-sm text-muted-foreground">Ninguno.</Text>
        ) : (
          data.scheduled.map((item) => <ScheduledRow key={item.identifier} item={item} />)
        )}
      </Section>
    </ScrollView>
  )
}

function when(date: Date): string {
  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${formatShortDate(date)} · ${formatTime(hhmm)}`
}

function PlannedRow({ item }: { item: PlannedNotification }) {
  return (
    <View className="border-b border-border py-2">
      <Text className="text-sm text-foreground">{when(item.date)}</Text>
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
        {item.body}
      </Text>
    </View>
  )
}

function ScheduledRow({ item }: { item: ScheduledReminder }) {
  return (
    <View className="border-b border-border py-2">
      <Text className="text-sm text-foreground">{when(item.date)}</Text>
      <Text className="text-xs text-muted-foreground" numberOfLines={1}>
        lista {item.listId.slice(0, 8)}…
      </Text>
    </View>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 text-sm font-semibold text-foreground">{title}</Text>
      <View className="rounded-lg border border-border bg-card p-3">{children}</View>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="ml-3 flex-1 text-right text-sm text-foreground">{value}</Text>
    </View>
  )
}

function DebugButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={`mt-2 h-11 justify-center rounded-md border border-border bg-background px-3 ${
        disabled ? 'opacity-50' : 'active:bg-muted'
      }`}
    >
      <Text className="text-sm font-medium text-foreground">{label}</Text>
    </Pressable>
  )
}
