/**
 * Public API of the reminders feature.
 *
 * Depends on `auth` only (who is signed in decides what should ring). It does
 * NOT import `lists`: what a notification says about a list comes from the
 * database, so `lists` can depend on this feature without a cycle
 * (01-overview.md).
 */
export { ReminderCard } from './components/ReminderCard'
export { ReminderEditorScreen, explainPermission } from './components/ReminderEditorScreen'
export { ReminderPicker } from './components/ReminderPicker'
export { useListReminder, useRemoveReminder, useSaveReminder } from './hooks/useListReminder'
export {
  syncReminders,
  useOpenListFromNotification,
  useReminderSync,
} from './hooks/useReminderSync'
export { DEFAULT_DRAFT, describeReminder, draftOf, toReminder } from './model/reminder'
export type { Reminder, ReminderDraft } from './model/reminder'
