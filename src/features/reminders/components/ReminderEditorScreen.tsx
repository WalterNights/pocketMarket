import { useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import type { PermissionState } from '@/shared/lib/notifications'

import { useListReminder, useRemoveReminder, useSaveReminder } from '../hooks/useListReminder'
import { DEFAULT_DRAFT, draftOf, sameSchedule, toReminder, type Reminder } from '../model/reminder'
import { ReminderPicker } from './ReminderPicker'

type ReminderEditorScreenProps = {
  listId: string
  onDone: () => void
}

/** Create, change or remove the reminder of one saved list. */
export function ReminderEditorScreen({ listId, onDone }: ReminderEditorScreenProps) {
  const reminder = useListReminder(listId)

  if (reminder.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator accessibilityLabel="Cargando aviso" />
      </View>
    )
  }

  if (reminder.isError) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-base text-foreground">No se pudo cargar el aviso.</Text>
        <Pressable
          onPress={() => void reminder.refetch()}
          accessibilityRole="button"
          className="mt-4 h-11 justify-center rounded-md bg-primary px-5"
        >
          <Text className="text-base font-medium text-primary-foreground">Reintentar</Text>
        </Pressable>
      </View>
    )
  }

  return <Editor listId={listId} existing={reminder.data} onDone={onDone} />
}

/**
 * The reminder is saved even if notifications are denied; the user is told
 * plainly that the phone will not ring, instead of finding out on the day.
 */
export function explainPermission(permission: PermissionState): void {
  if (permission === 'granted') return
  if (permission === 'unavailable') {
    Alert.alert(
      'Aviso guardado',
      'Esta versión de prueba no puede mostrar avisos. Verás la fecha del próximo mercado ' +
        'en la lista, y el aviso sonará en la app instalada.',
    )
    return
  }
  Alert.alert(
    'Aviso guardado',
    'Las notificaciones están desactivadas, así que el teléfono no sonará. ' +
      'Verás la fecha del próximo mercado en la lista, y puedes activarlas en Ajustes.',
  )
}

type EditorProps = {
  listId: string
  existing: Reminder | null
  onDone: () => void
}

function Editor({ listId, existing, onDone }: EditorProps) {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const [initial] = useState(() => (existing ? draftOf(existing) : DEFAULT_DRAFT))
  const [draft, setDraft] = useState(initial)
  const save = useSaveReminder()
  const remove = useRemoveReminder()
  const busy = save.isPending || remove.isPending

  // Set right before `onDone`: a saved or removed reminder has nothing left
  // to lose, and the success callback runs before a re-render could lift the
  // guard below.
  const finished = useRef(false)
  const finish = () => {
    finished.current = true
    onDone()
  }

  // Android back, iOS swipe and the header button all go through here
  // (rules/react-native.md: back is handled explicitly with unsaved state).
  usePreventRemove(!sameSchedule(draft, initial), ({ data }) => {
    if (finished.current) {
      navigation.dispatch(data.action)
      return
    }
    Alert.alert('¿Salir sin guardar?', 'Los cambios de este aviso se perderán.', [
      { text: 'Seguir editando', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ])
  })

  const submit = () => {
    remove.reset()
    save.mutate(toReminder(draft, listId, new Date(), existing), {
      onSuccess: ({ permission }) => {
        explainPermission(permission)
        finish()
      },
    })
  }

  const removeReminder = () => {
    save.reset()
    remove.mutate(listId, { onSuccess: finish })
  }

  return (
    <ScrollView
      className="flex-1 bg-background px-4"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}
    >
      <Text className="mb-4 text-sm text-muted-foreground">
        Te avisamos cuándo toca hacer mercado, con el total estimado de la lista.
      </Text>

      <ReminderPicker value={draft} onChange={setDraft} />

      {save.isError ? (
        <Text className="mt-4 text-sm text-destructive" accessibilityLiveRegion="assertive">
          No se pudo guardar. Revisa tu conexión y vuelve a intentarlo.
        </Text>
      ) : null}

      {remove.isError ? (
        <Text className="mt-4 text-sm text-destructive" accessibilityLiveRegion="assertive">
          No se pudo quitar el aviso. Revisa tu conexión y vuelve a intentarlo.
        </Text>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy, busy: save.isPending }}
        className={`mt-6 h-12 items-center justify-center rounded-md bg-primary ${
          busy ? 'opacity-60' : 'active:opacity-80'
        }`}
      >
        <Text className="text-base font-medium text-primary-foreground">
          {save.isPending ? 'Guardando…' : 'Guardar aviso'}
        </Text>
      </Pressable>

      {existing ? (
        <Pressable
          onPress={removeReminder}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy: remove.isPending }}
          className="mt-3 h-12 items-center justify-center rounded-md border border-border bg-card active:bg-muted"
        >
          <Text className="text-base font-medium text-destructive">
            {remove.isPending ? 'Quitando…' : 'Quitar aviso'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  )
}
