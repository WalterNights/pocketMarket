---
name: rn-implement
description: Use this skill whenever the user asks to "implementa", "implement", "construye", "build", "crea la pantalla", "añade el feature", "escribe el código", "hazlo", "aplica el plan", "code this", or any request to WRITE code in this React Native app. Enforces the repo's layer rules, patterns and mobile checklist during implementation, and closes with the quality gate. Prefer running rn-plan first for anything non-trivial.
argument-hint: [feature o cambio a implementar]
---

# RN Implement — implementar siguiendo las reglas

A implementar: **$ARGUMENTS**

## Fase 0 — Antes de escribir una línea

1. **¿Hay plan?** Si el cambio es no trivial y no existe plan aprobado, ejecutar `rn-plan`
   primero y esperar aprobación. No implementar a ciegas un feature completo.
2. **Leer `.claude/rules/known-issues.md`** — ¿este cambio toca una trampa ya documentada?
3. **Leer el código existente** de los features afectados. Seguir los patrones que ya hay,
   no inventar unos nuevos en paralelo.
4. **¿Dependencias nuevas?** → `vet-dependency` **antes** de instalar. En móvil una librería
   puede arrastrar código nativo, exigir build nueva y bloquear un upgrade de SDK.

## Fase 1 — Orden de implementación

Siempre de dentro hacia fuera. Cada capa se puede verificar antes de construir la siguiente:

```
1. supabase/migrations/   schema + índices + políticas RLS
2. model/                 tipos, schemas Zod, reglas puras  → testeable ya
3. api/                   repositorio + query keys + queries/mutations
4. store/                 slice Zustand (solo si el estado sobrevive a la pantalla)
5. hooks/                 fachada de presentación
6. components/            UI del feature
7. app/                   ruta (fina: params → props)
8. index.ts               API pública del feature
```

Construir la UI primero y "ya conectaremos los datos" produce componentes que asumen datos que
la capa de datos no puede dar.

Tras cada paso significativo: `pnpm run type-check`. No acumules errores de tipos.

## Fase 2 — Reglas durante la escritura

### Estructura
- Regla de dependencia: `app/ → features/ → shared/`. Nunca al revés, nunca entre features.
- `model/` puro: sin React, sin red, sin `Platform.OS`.
- `supabase` solo en `features/**/api/`.
- `app/` solo compone.
- Nada a `shared/` con menos de tres consumidores.

### Datos
- `select()` con columnas explícitas. Nunca `select('*')`.
- Zod `.parse()` en la frontera del repositorio.
- Query keys desde el factory.
- Paginación en servidor.
- Mutación: optimista + rollback + invalidación, con la regla pura de `model/`.
- Store persistido: `version` + `migrate` + `partialize`.

### La checklist móvil — en cada pantalla que toques
- [ ] **Sin red:** sirve caché o muestra error con reintento
- [ ] **Loading / error / empty / data:** los cuatro, no tres
- [ ] **Background → foreground:** refetch, realtime pausado, temporizadores limpiados
- [ ] **Permisos:** ruta degradada si se deniegan
- [ ] **Safe areas y teclado:** ningún input tapado
- [ ] **Claro y oscuro:** ambos
- [ ] **Área táctil ≥ 44pt** y `accessibilityLabel`/`Role`
- [ ] **Botón atrás de Android** si hay estado sin guardar

### Seguridad
- Tabla nueva → RLS habilitada, política por operación, `WITH CHECK` en insert/update,
  sujeto `auth.uid()`.
- Tokens en `expo-secure-store`.
- Ninguna `EXPO_PUBLIC_*` con algo que no pueda ser público.
- El cliente no decide precios, estados, roles ni timestamps.

### Nativo
- **Nunca editar `ios/` ni `android/`.** Config plugin en `app.config.ts`.
- Todo SDK nativo envuelto en un adapter de `shared/lib/`.
- Si el cambio requiere código nativo nuevo: **no es OTA-able**. Decírselo al usuario
  explícitamente.

### Código
- Inglés en código y comentarios. Textos de usuario en español.
- Sin `any` sin justificación. Sin `console.log`. Sin `catch` silencioso.
- Constantes con nombre. Early returns. Sin abstracción prematura.
- JSDoc en lo que exporte el `index.ts` del feature.

## Fase 3 — Tests

Escribir junto al código, no "después":

- **`model/`** → test unitario de cada regla. Sin mocks; si hace falta uno, la función no es pura.
- **Componente con datos remotos** → los cuatro estados, con MSW. Consultar por rol y texto
  accesible, no por `testID`.
- **Política RLS nueva** → test de acceso denegado.
- **Store persistido** → test de `migrate` desde la versión anterior.
- **E2E** solo si el cambio toca un flujo crítico (máx. ~5 en todo el proyecto).

## Fase 4 — Cierre

1. **Gate obligatorio:**
   ```bash
   pnpm run quality       # type-check + lint + format:check + test
   ```
   No se da por terminado nada con el gate en rojo. Prettier: `pnpm run format:fix` es seguro.
   ESLint: arreglar manualmente, **sin** `--fix` automático.

2. **Autorrevisión** con `rn-review` sobre el propio diff antes de entregar.

3. **Actualizar `known-issues.md`** si apareció y se resolvió un problema no evidente.

4. **Actualizar documentación** si el cambio altera algo descrito en `docs/architecture/`.
   Si contradice un ADR: actualizar el ADR (o crear uno que lo sustituya) **antes** de cerrar.

5. **Informe final:**

```markdown
## Implementado: <nombre>

### Archivos
**Creados:** <lista con enlaces>
**Modificados:** <lista con enlaces y qué cambió>

### Migraciones Supabase
<archivos + políticas RLS creadas, o "ninguna">

### Checklist móvil
| Aspecto | Estado |
|---|---|
| Sin red | ✅ <cómo se resolvió> |
| Cuatro estados | ✅ |
| Background → foreground | ✅ / N/A |
| Permisos | ✅ / N/A |
| Claro y oscuro | ✅ |
| Accesibilidad | ✅ |

### Tests
<qué se añadió y qué cubre>

### Gate
`pnpm run quality` → ✅ verde | ❌ <qué falla>

### ¿OTA-able?
Sí | No — <razón: qué código nativo cambió>

### Pasos manuales pendientes
- <migración a aplicar, secreto a configurar, permiso a declarar en la store…>

### Fuera de alcance
- <lo que deliberadamente no se hizo>
```

## What NOT to do

- ❌ No implementes un feature completo sin plan aprobado.
- ❌ No inventes patrones nuevos cuando el repo ya tiene uno para ese problema.
- ❌ No instales dependencias sin `vet-dependency`.
- ❌ No edites `ios/`, `android/` ni `database.types.ts` a mano.
- ❌ No dejes una pantalla con datos remotos sin resolver los cuatro estados.
- ❌ No hagas commit salvo petición explícita del usuario.
- ❌ No amplíes el alcance por tu cuenta: si ves algo que arreglar fuera del encargo, repórtalo,
  no lo arregles.
- ❌ No declares terminado nada con el gate en rojo. Si algo quedó fuera, dilo explícitamente.
- ❌ No asumas reglas de negocio no definidas. Pregunta.
