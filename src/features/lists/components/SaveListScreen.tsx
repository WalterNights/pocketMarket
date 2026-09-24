import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { z } from 'zod'

import {
  DEFAULT_DRAFT,
  explainPermission,
  ReminderPicker,
  toReminder,
  useSaveReminder,
} from '@/features/reminders'
import { formatCop } from '@/shared/utils/format-money'

import { ListError } from '../api/list-repository'
import { useSaveList } from '../hooks/useSavedLists'
import { listNameSchema, saveListErrorMessage, toSavePayload } from '../model/saved-list'
import { grandTotalOf } from '../model/totals'
import { selectEditing, useDraftListStore } from '../store/draft-list-store'

const MUTED = '#78726B'
const PRIMARY = '#1F1D1B'

const formSchema = z.object({ name: listNameSchema })
type FormInput = z.input<typeof formSchema>
type FormOutput = z.output<typeof formSchema>

type SaveListScreenProps = {
  onSaved: (listId: string) => void
}

/**
 * Names the draft and saves it — or, in edit mode, confirms the changes to a
 * saved list. The reminder is offered only for a new list; a saved list's
 * reminder is changed from the list itself, where it is visible.
 */
export function SaveListScreen({ onSaved }: SaveListScreenProps) {
  const insets = useSafeAreaInsets()
  const items = useDraftListStore((s) => s.items)
  const editing = useDraftListStore(selectEditing)
  const clear = useDraftListStore((s) => s.clear)

  const saveList = useSaveList()
  const saveReminder = useSaveReminder()

  const [remind, setRemind] = useState(false)
  const [reminderDraft, setReminderDraft] = useState(DEFAULT_DRAFT)

  const list = useMemo(() => Object.values(items), [items])
  const total = useMemo(() => grandTotalOf(list), [list])

  const { control, handleSubmit, formState } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: editing?.name ?? '' },
  })

  const busy = saveList.isPending || saveReminder.isPending

  const submit = handleSubmit(async ({ name }) => {
    let listId: string
    try {
      listId = await saveList.mutateAsync({
        listId: editing?.listId ?? null,
        name,
        items: toSavePayload(list, editing?.kept),
      })
    } catch {
      // Shown below from saveList.error; the draft is untouched.
      return
    }

    if (remind && editing === null) {
      try {
        const { permission } = await saveReminder.mutateAsync(
          toReminder(reminderDraft, listId, new Date()),
        )
        explainPermission(permission)
      } catch {
        Alert.alert(
          'La lista se guardó, el aviso no',
          'Puedes añadir el aviso desde la lista cuando tengas conexión.',
        )
      }
    }

    // Navigate first, then clear: clearing first would flash the empty state
    // ("No hay nada que guardar") for a frame before the screen goes away.
    onSaved(listId)
    clear()
  })

  if (list.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center text-base text-foreground">No hay nada que guardar</Text>
        <Text className="mt-1 text-center text-sm text-muted-foreground">
          Añade productos a tu lista y vuelve aquí.
        </Text>
      </View>
    )
  }

  const serverError = saveList.isError
    ? saveListErrorMessage(saveList.error instanceof ListError ? saveList.error.code : undefined)
    : null

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        className="px-4"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}
      >
        <Text className="text-sm text-muted-foreground">
          {list.length} {list.length === 1 ? 'producto' : 'productos'} · {formatCop(total)} hoy
        </Text>

        <Text className="mb-1.5 mt-4 text-sm font-medium text-foreground">Nombre</Text>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder="Mercado de la quincena"
              placeholderTextColor={MUTED}
              accessibilityLabel="Nombre de la lista"
              autoFocus={editing === null}
              returnKeyType="done"
              maxLength={80}
              className={`h-12 rounded-md border bg-card px-3 text-base text-foreground ${
                formState.errors.name ? 'border-destructive' : 'border-input'
              }`}
            />
          )}
        />
        {formState.errors.name ? (
          <Text className="mt-1 text-sm text-destructive">{formState.errors.name.message}</Text>
        ) : null}

        {editing === null ? (
          <View className="mt-6 rounded-lg border border-border bg-card p-4">
            <View className="flex-row items-center">
              <View className="flex-1 pr-3">
                <Text className="text-base text-foreground">Avisarme para hacer mercado</Text>
                <Text className="mt-0.5 text-xs text-muted-foreground">
                  Opcional. Puedes cambiarlo después.
                </Text>
              </View>
              <Switch
                value={remind}
                onValueChange={setRemind}
                accessibilityLabel="Avisarme para hacer mercado"
                trackColor={{ true: PRIMARY }}
              />
            </View>

            {remind ? (
              <View className="mt-4">
                <ReminderPicker value={reminderDraft} onChange={setReminderDraft} />
              </View>
            ) : null}
          </View>
        ) : null}

        {serverError ? (
          <View className="mt-4 rounded-md border border-destructive bg-card p-3">
            <Text className="text-sm text-destructive" accessibilityLiveRegion="assertive">
              {serverError}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          className={`mt-6 h-12 items-center justify-center rounded-md bg-primary ${
            busy ? 'opacity-60' : 'active:opacity-80'
          }`}
        >
          <Text className="text-base font-medium text-primary-foreground">
            {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar lista'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
