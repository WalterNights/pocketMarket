---
paths:
  - "src/features/**/api/**"
  - "src/features/**/hooks/**"
  - "src/features/**/store/**"
  - "src/shared/lib/**"
---

# Reglas — Estado y datos

Referencia completa: [docs/architecture/04-state-and-data.md](../../docs/architecture/04-state-and-data.md)

## Reparto de estado

| Naturaleza del dato | Dónde va |
|---|---|
| Vive en el servidor | TanStack Query |
| Cliente, sobrevive a la pantalla | Zustand |
| Cliente, muere con la pantalla | `useState` / `useReducer` |
| Valor de formulario | React Hook Form |
| Identidad o filtro compartible | Search params de expo-router |
| Dependencia estática (tema, i18n, queryClient) | Context |

**Prohibido copiar server state dentro de Zustand.** Dos fuentes de verdad que divergen en
silencio. TanStack Query ya es un store.

## TanStack Query

- Query keys **siempre** desde el factory del feature (`productKeys.detail(id)`). Nunca arrays
  literales en línea.
- `queryFn` llama a un repositorio; nunca a `supabase` directamente.
- `networkMode: 'offlineFirst'` (está en los defaults; no sobreescribir sin justificar).
- No reintentar errores 4xx de auth ni 404.
- Propagar el `signal` a la petición para cancelar al desmontar.
- Paginación con `useInfiniteQuery` + `.range()` en servidor. Nunca traer la colección completa.
- Invalidar por nivel del factory (`productKeys.lists()`), no borrar la caché entera.
- Precargar con `prefetchQuery` en `onPressIn` antes de navegar.
- Queries con datos sensibles **excluidas de la persistencia** (`shouldDehydrateQuery`).
- Logout → `queryClient.clear()` **y** limpiar el storage del persister.

## Mutaciones

- Actualización optimista con `onMutate` / rollback en `onError` / `invalidateQueries` en
  `onSettled`.
- La predicción optimista usa la **misma función pura de `model/`** que representa la regla.
- Mutación encolable offline: `mutationKey` + default handler registrado con
  `setMutationDefaults`, payload serializable e idempotencia (o `client_id` UUID de cliente
  deduplicado en servidor).
- Nada de subir binarios en memoria en la cola: guarda la URI y sube después.

## Zustand

- Un store por dominio, dentro de su feature. Sin store global.
- Consumir **siempre por selector**. `useShallow` si el selector devuelve objeto o array nuevo.
- Sin valores derivados en el estado: se calculan con selectores.
- La lógica vive en `model/`; el store orquesta y persiste.
- Store persistido → `version` + `migrate` **obligatorios**, y `partialize` para no persistir
  acciones ni estado derivado.
- Storage: MMKV. Nada sensible.

## Repositorios (`features/**/api/`)

- Única capa que conoce `supabase`.
- `select()` con columnas explícitas. **Nunca `select('*')`.**
- `.parse()` de Zod sobre la respuesta antes de devolverla.
- Devuelve tipos de dominio; lanza errores tipados. No propaga `{ data, error }`.
- Sin lógica de UI, sin `Platform`, sin acceso a stores.
- Consultas por lote con `in()` en vez de N peticiones en bucle.

## Almacenamiento

| Dato | Mecanismo |
|---|---|
| Tokens, refresh tokens, PIN | `expo-secure-store` |
| Preferencias, caché de queries, borradores | MMKV |
| Datos estructurados grandes | SQLite |
| Sensible | Nunca en AsyncStorage plano ni en logs |

El cliente de Supabase se configura con SecureStore como storage de auth, no con el default.

## Sincronización con el ciclo de vida

- `AppState` alimenta el `focusManager` de TanStack Query.
- NetInfo alimenta el `onlineManager`.
- Ambos se montan una sola vez en el root layout.
- Los canales realtime se cierran en background y se reabren en foreground **seguidos de un
  refetch** — los eventos perdidos no se recuperan solos.

## Conflictos

- Por defecto last-write-wins con `updated_at` puesto por **trigger de Postgres**, jamás por el
  reloj del dispositivo.
- Operaciones que no toleran LWW (stock, saldos, contadores) → función SQL atómica vía RPC.
  Nunca read-modify-write en cliente.
