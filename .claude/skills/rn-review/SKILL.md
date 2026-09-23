---
name: rn-review
description: Use this skill whenever the user asks to "revisa el código", "review", "code review", "limpia el código", "clean code", "revisa lo cambiado", "revisa el PR", "revisa la calidad", "quality check", "está listo para commit", "review changes", or any request to audit code quality in this React Native app. Reviews the pending git diff against the repo's architecture rules, React Native standards and mobile-specific pitfalls (offline, lifecycle, permissions, RLS, performance, a11y), reporting findings with severity and file:line. Trigger proactively before commits, before PRs, and whenever the user mentions "calidad", "lint", "robustez" or "mantenibilidad".
---

# RN Review — revisión del diff pendiente

Audita **solo lo cambiado en la rama actual** contra los estándares del repo.

## Alcance

```bash
git status                        # untracked + modificados
git diff                          # sin stage
git diff --cached                 # en stage
git diff <main>...HEAD            # commits por delante de main
```

Rama principal: `git symbolic-ref refs/remotes/origin/HEAD`, con fallback a `main`/`master`.

Revisar los **hunks del diff**, leyendo el contexto circundante suficiente para juzgar
corrección. No auditar archivos que el diff no toca.

Antes de empezar, cargar `.claude/rules/` aplicables al área tocada y
`.claude/rules/known-issues.md`.

---

## Checklist

### 1. Arquitectura — 🔴 si falla

- [ ] Regla de dependencia respetada: `app/ → features/ → shared/`
- [ ] Ningún feature importa internos de otro (solo su `index.ts`)
- [ ] `app/` solo compone: sin fetch, sin lógica de negocio
- [ ] `model/` puro: sin React, sin red, sin `Platform.OS`
- [ ] `supabase` solo dentro de `features/**/api/`
- [ ] Archivos en la carpeta correcta según `02-folder-structure.md`
- [ ] Nada promovido a `shared/` con menos de tres consumidores

### 2. TypeScript

- [ ] Sin `any` (o con `eslint-disable` **y justificación** en la línea anterior)
- [ ] Sin `unknown` usado sin type guard o `.parse()`
- [ ] Sin `as X` para callar al compilador
- [ ] `database.types.ts` no editado a mano
- [ ] Zod en toda frontera: respuesta de red, params de ruta, deep link, env

### 3. Datos y estado

- [ ] Datos remotos en TanStack Query, no en `useEffect` + `setState`
- [ ] Server state **no** duplicado en Zustand
- [ ] Query keys desde el factory del feature, no literales
- [ ] `queryFn` llama a repositorio, no a `supabase` directamente
- [ ] `select()` con columnas explícitas — **nunca `select('*')`**
- [ ] Paginación en servidor (`.range()` + `useInfiniteQuery`)
- [ ] Mutaciones: optimista + rollback + `invalidateQueries`
- [ ] Store de Zustand consumido por selector (`useShallow` si devuelve objeto)
- [ ] Store persistido con `version`, `migrate` y `partialize`

### 4. Específico de móvil — la parte que un review de web no hace

- [ ] **Sin red:** ¿qué muestra esta pantalla? ¿La mutación se pierde?
- [ ] **Background → foreground:** ¿refetch? ¿realtime pausado? ¿temporizadores limpiados?
- [ ] **Proceso matado:** ¿el estado importante estaba persistido?
- [ ] **Permiso denegado:** ¿hay ruta degradada o la pantalla queda rota?
- [ ] Acceso a API del sistema **vía adapter** en `shared/lib/`, no directo
- [ ] Botón atrás de Android gestionado si hay estado sin guardar
- [ ] Sin `setInterval` para refrescar
- [ ] Deep link: parámetros validados, y **ninguna acción con efecto** disparada por el link

### 5. Rendimiento

- [ ] `FlashList` para colecciones remotas; nunca `ScrollView` + `.map()`
- [ ] `keyExtractor` con id estable, no índice
- [ ] `renderItem` estable (fuera del componente o `useCallback`) y fila memoizada
- [ ] **Sin `estimatedItemSize`** — FlashList v2 lo eliminó y pasarlo da error de tipos
- [ ] `expo-image` con `cachePolicy`, dimensiones explícitas, imagen dimensionada en origen
- [ ] Animaciones con worklets de Reanimated; `useSharedValue`, no `useState`
- [ ] Sin trabajo pesado añadido al arranque
- [ ] Sin N+1 de consultas en bucle (usar `in()`)

### 6. UI y accesibilidad

- [ ] Primitivos de `shared/ui`, no `Text`/`Pressable` crudos con estilo
- [ ] Tokens, sin colores ni espaciados literales
- [ ] Funciona en claro **y** oscuro
- [ ] Área táctil ≥ 44pt
- [ ] `accessibilityLabel` / `accessibilityRole` / `accessibilityState`
- [ ] Safe areas e insets; teclado no tapa inputs
- [ ] Los **cuatro estados** (loading / error / empty / data), con reintento en error

### 7. Seguridad — 🔴 si falla

- [ ] Ninguna `EXPO_PUBLIC_*` contiene algo que no pueda ser público
- [ ] `service_role` ausente del código de la app
- [ ] Tokens y datos sensibles en `expo-secure-store`
- [ ] Tabla nueva → RLS habilitada, política **por operación**, `WITH CHECK` en insert/update
- [ ] Sujeto de la política = `auth.uid()`, no un `user_id` del payload
- [ ] El cliente no decide precios, estados, roles ni timestamps
- [ ] Logout limpia caché, persister y stores
- [ ] Sin `console.log` que pueda filtrar datos

### 8. Diseño — SOLID donde sí aplica

SOLID nació para jerarquías de clases y este repo es funcional, así que se traduce. No se
citan las siglas en un hallazgo: se cita la consecuencia concreta.

- [ ] **Responsabilidad única.** Un hook, una razón para cambiar. `useProductScreen()` que
      hace nueve cosas no es un hook, es una pantalla mal partida. Señal: el nombre lleva "y",
      o el archivo pasa de ~150 líneas sin una razón clara.
- [ ] **Abierto/cerrado.** Añadir una tienda = un adaptador nuevo. **Si obliga a tocar
      `ingestion/core/`, la interfaz está mal.** Es la prueba más concreta del repo.
- [ ] **Sustitución.** Todo `StoreAdapter` se comporta igual ante el pipeline: `normalize()`
      pura, `fetchCatalog()` iterable, errores del mismo tipo. Un repositorio que a veces
      lanza y a veces devuelve `null` no es sustituible.
- [ ] **Segregación de interfaces.** Props que el componente no usa, o campos opcionales que
      solo llena un caso. Un componente que hace fetch **y** recibe diez props de
      presentación son dos componentes.
- [ ] **Inversión de dependencias.** El feature depende del **repositorio**, nunca de
      `supabase`. Es la regla 4 del repo y ya se verifica en la sección 1; aquí se mira la
      versión sutil: un hook que conoce la forma de la fila de Postgres en vez del tipo del
      dominio.

⚠️ **No conviertas esto en dogma.** Partir un módulo de 40 líneas "por SRP" o inventar una
interfaz para un solo implementador es peor que el problema. La regla del repo manda: se
abstrae en la **tercera** repetición, no en la primera.

### 9. Errores — 🟡 casi siempre, 🔴 si se pierde el dato

- [ ] **Ningún `catch` silencioso.** Si no se puede manejar, se relanza o se reporta. Un
      `catch {}` vacío convierte un fallo en un comportamiento raro sin explicación.
- [ ] **Errores tipados por capa** (`RepositoryError`, `CartLimitError`), no strings ni
      `{ data, error }` de Supabase propagado hacia arriba.
- [ ] **El error conserva la causa.** `throw new Error(msg)` sin `{ cause }` pierde el stack
      original. En TS 6 hace falta `override readonly cause` al declararlo en una subclase.
- [ ] **Los errores asíncronos van al estado `error` de la query**, no a un error boundary.
      Un boundary no captura un rechazo de promesa.
- [ ] **Error boundary** en la raíz, por ruta y alrededor de widgets de terceros.
- [ ] **Todo estado de error ofrece reintento.** Una pantalla de error sin salida es un
      callejón sin salida.
- [ ] **Mensaje de usuario accionable y en español**; el detalle técnico va al log, en
      inglés. Nunca mostrar `duplicate key value violates unique constraint`.
- [ ] **Una escritura fallida no se pierde en silencio.** Si la mutación optimista revierte,
      el usuario tiene que enterarse.
- [ ] **Lo que falla parcialmente se reporta parcialmente.** En la ingesta: distinguir
      "agotado" (rutina) de "ilegible" (la fuente cambió). Contarlos juntos hace que la
      alarma no mida nada — `ING-004`.
- [ ] **Bloqueado por RLS no lanza error.** UPDATE y DELETE afectan 0 filas en silencio: hay
      que **contar filas afectadas**, no esperar excepción.

### 10. Limpieza

- [ ] Comentarios y código en inglés; sin comentarios redundantes ni "added for X flow"
- [ ] JSDoc en la API pública del feature
- [ ] Constantes con nombre en lugar de valores mágicos
- [ ] Early returns; anidamiento ≤ 2-3 niveles
- [ ] Sin código muerto, sin `_unused`, sin shims de compatibilidad
- [ ] Sin `catch` silencioso
- [ ] Sin abstracción prematura (se extrae en la tercera repetición)
- [ ] Cada función hace completamente lo que su nombre promete

### 11. Tests

- [ ] Lógica nueva en `model/` tiene test unitario
- [ ] Política RLS nueva tiene test de acceso denegado
- [ ] Componente nuevo con datos remotos: los cuatro estados cubiertos
- [ ] Sin snapshots de árboles grandes

---

## Formato de hallazgo

```
<emoji> <severidad> — [<archivo>:<línea>](<archivo>#L<línea>)

**Problema:** <una frase>
**Regla:** <la regla concreta que incumple, con enlace al doc>

**Antes:**
```tsx
<código original>
```

**Después:**
```tsx
<código corregido>
```
```

### Severidad

- 🔴 **Crítico** — rompe build, tipos, seguridad, o la regla de dependencia. Bloquea el commit.
- 🟡 **Importante** — incumple un estándar documentado o introduce un riesgo móvil real.
- 🟢 **Sugerencia** — legibilidad o estilo. Opcional.

## Gate de calidad

Tras la revisión manual, ejecutar el gate objetivo:

```bash
pnpm run quality        # type-check + lint + format:check + test
```

Si no existe el script combinado, ejecutar los cuatro por separado. Reportar el resultado como
parte de la revisión.

- **Prettier**: aplicar `pnpm run format:fix` es seguro y esperado — ofrécelo como el arreglo.
- **ESLint**: **no** ejecutar `--fix` automáticamente (puede eliminar aserciones necesarias).
  Reportar la violación y el arreglo manual concreto.

## Resumen final

```markdown
## Resumen
- 🔴 Crítico: <n>
- 🟡 Importante: <n>
- 🟢 Sugerencia: <n>

**Gate (`pnpm run quality`):** ✅ verde | ❌ <qué falla>

**Veredicto:** "Listo para commit" | "Corrige los críticos antes de commit" | "Necesita refactor mayor"
```

## Puente con otras skills

- Si el diff toca RLS, auth, secretos, deep links o dependencias nuevas → recomendar
  `security-audit` (o marcarlo 🔴 inline si es evidente).
- Si el diff añade una dependencia → `vet-dependency` **antes** de aprobar.
- Si el diff toca listas, imágenes, animaciones o arranque → recomendar `rn-perf-audit`.

## What NOT to do

- ❌ No revises archivos fuera del diff.
- ❌ No re-marques problemas que ya existían en `main` y no introduce este diff.
- ❌ No edites archivos salvo que el usuario pida explícitamente "revisa **y** corrige".
- ❌ No pidas tests, docs ni refactors que el diff no requiere.
- ❌ No ejecutes `eslint --fix` automáticamente.
- ❌ No conviertas preferencias personales en hallazgos. Cada hallazgo cita una regla documentada.
- ❌ No apruebes un diff con datos remotos que no resuelva los cuatro estados ni el caso sin red.
