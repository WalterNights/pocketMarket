# Feature `reminders` — feature base

Avisos de mercado: modelo de calendario, reconciliación de notificaciones locales y su UI
([03-reminders](../../../docs/domain/03-reminders.md)).

**Es un feature base** ([01-overview](../../../docs/architecture/01-overview.md), opción 2):
otros features pueden importarlo, **solo por su `index.ts`**.

| Depende de él | Para qué |
|---|---|
| `lists` | una lista guardada puede tener un aviso; guardar o borrar una lista resincroniza |

Importa de `auth` (feature base). **No** importa de `lists`: lo que una notificación dice de una
lista sale de la base de datos, así que no hay ciclo.
