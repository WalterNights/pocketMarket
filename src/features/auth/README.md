# Feature `auth` — feature base

Sesión del usuario: inicio de sesión, registro, cierre y el estado `loading / signed-in /
signed-out` ([ADR-0005](../../../docs/adr/0005-autenticacion.md)).

**Es un feature base** ([01-overview](../../../docs/architecture/01-overview.md), "¿Y si dos
features necesitan lo mismo?", opción 2): otros features pueden importarlo, **solo por su
`index.ts`**.

| Depende de él | Para qué |
|---|---|
| `lists` | vaciar el borrador al cerrar sesión |
| `reminders` | qué debe sonar depende de quién tiene la sesión |

`auth` no importa de ningún feature.
