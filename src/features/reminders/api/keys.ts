/** Query key factory (03-patterns.md). */
export const reminderKeys = {
  all: ['reminders'] as const,
  forList: (listId: string) => [...reminderKeys.all, 'list', listId] as const,
  permission: () => [...reminderKeys.all, 'permission'] as const,
}
