---
name: rn-plan
description: Use this skill whenever the user asks to "planifica", "haz un plan", "plan", "cómo implementamos", "cómo hacemos", "diseña", "propón", "antes de implementar", "analiza el alcance", "plan the feature", "design this", or any request to think through a feature BEFORE writing code in this React Native app. Produces a structured implementation plan mapped to the project's layers, patterns and mobile constraints (offline, permissions, lifecycle, RLS, performance budgets). Writes NO code. Trigger this proactively at the start of any non-trivial feature, refactor or migration.
argument-hint: [feature o cambio a planificar]
---

# RN Plan — plan antes de código

Tarea a planificar: **$ARGUMENTS**

Esta skill **no escribe código**. Produce un plan que el usuario aprueba antes de implementar.

## Fase 0 — Cargar contexto (obligatorio)

En paralelo:

1. `.claude/rules/known-issues.md` — ¿este cambio toca alguna trampa ya documentada?
2. Los documentos de arquitectura relevantes según lo que toque el cambio:

| Si el cambio toca… | Leer |
|---|---|
| Estructura, nuevos módulos | `docs/architecture/01-overview.md`, `02-folder-structure.md` |
| Datos remotos, caché, offline | `04-state-and-data.md` |
| Pantallas, rutas, deep links | `05-navigation.md` |
| UI, componentes, tema | `06-design-system.md` |
| Listas, animación, arranque | `07-performance.md` |
| Auth, datos de usuario, tablas | `08-security.md` |
| Cualquier cosa no trivial | `03-patterns.md` |

3. Código existente de los features afectados — **leer antes de proponer**. Nunca planificar
   sobre una suposición de cómo está escrito algo.

Si hay un ADR que cubre el área, léelo. Si el plan lo contradice, dilo explícitamente: se
actualiza el ADR primero.

## Fase 1 — Las siete preguntas móviles

Todo plan debe responderlas explícitamente. Si alguna no aplica, decir por qué.

| # | Pregunta | Qué hay que concretar |
|---|---|---|
| 1 | **¿Qué pasa sin red?** | Qué se sirve de caché, qué se encola, qué se bloquea |
| 2 | **¿Qué pasa si el SO mata el proceso?** | Qué estado se persiste y cuándo; migración si hay store |
| 3 | **¿Qué permisos hace falta pedir?** | Cuándo se piden, con qué explicación, y la **ruta degradada** si se deniegan |
| 4 | **¿Quién puede ver o modificar estos datos?** | Políticas RLS concretas por operación |
| 5 | **¿Cuánto cuesta en rendimiento?** | Listas, imágenes, arranque, animaciones; presupuestos de `07` |
| 6 | **¿Cómo se comporta al volver de background?** | Refetch, realtime, temporizadores |
| 7 | **¿Se puede enviar por OTA?** | ¿Requiere código nativo → build nueva? ¿Necesita feature flag? |

## Fase 2 — Mapear a las capas

Para cada pieza del cambio, decir **dónde va** y **por qué**:

```
app/                    rutas nuevas o modificadas (solo composición)
features/<f>/model/     tipos, schemas Zod, reglas puras
features/<f>/api/       repositorio, query keys, queries/mutations
features/<f>/hooks/     fachadas de presentación
features/<f>/components/ UI del feature
features/<f>/store/     slice Zustand (solo si el estado sobrevive a la pantalla)
shared/                 solo si lo consumen ≥3 features
supabase/migrations/    cambios de schema + políticas RLS
```

Verificar contra la regla de dependencia: ¿este plan hace que un feature importe de otro?
¿Que `shared/` conozca un feature? Si sí, rediseñar antes de continuar.

## Fase 3 — Producir el plan

Formato de salida:

```markdown
## Plan: <nombre del cambio>

**Complejidad:** Baja | Media | Alta
**¿OTA-able?:** Sí | No (requiere build nueva porque <razón>)

### Resumen
<2-3 frases: qué se construye y cuál es la decisión de diseño principal>

### Decisiones de diseño
| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| ... | ... | ... |

### Las siete preguntas móviles
1. **Sin red:** ...
2. **Proceso matado:** ...
3. **Permisos:** ...
4. **Autorización (RLS):** ...
5. **Rendimiento:** ...
6. **Background → foreground:** ...
7. **OTA:** ...

### Archivos

**Crear**
- [ ] `src/features/<f>/model/<x>.ts` — <qué contiene>
- [ ] ...

**Modificar**
- [ ] [`ruta`](ruta) — <qué cambia y por qué>

**Migraciones Supabase**
- [ ] `supabase/migrations/<fecha>_<nombre>.sql` — tablas, índices, políticas RLS

### Patrones aplicados
- <patrón de 03-patterns.md> — <dónde y para qué>

### Orden de implementación
1. <paso> — verificable con: <cómo se comprueba que funciona>
2. ...

Cada paso debe dejar el repo en verde (`pnpm run quality`).

### Tests
- **Unidad** (`model/`): <casos concretos>
- **Componente**: <los cuatro estados + interacción principal>
- **RLS**: <test de acceso denegado>
- **E2E**: <solo si toca un flujo crítico>

### Riesgos y trampas conocidas
| Riesgo | De known-issues | Mitigación |
|---|---|---|
| ... | `SB-003` o "trampa conocida: ..." | ... |

### Fuera de alcance
- <lo que deliberadamente NO se hace en este cambio>

### Preguntas abiertas
- <decisiones que necesitan respuesta del usuario antes de implementar>
```

Terminar con: **"¿Apruebas el plan o ajustamos algo antes de implementar?"**

## Calibrar la profundidad

| Tamaño | Qué produce |
|---|---|
| Cambio trivial (texto, estilo, constante) | No uses esta skill. Hazlo directamente |
| Cambio pequeño (1-2 archivos, sin datos nuevos) | Plan corto: resumen, archivos, tests. Omite secciones vacías |
| Feature (pantalla + datos + estado) | Plan completo |
| Migración / refactor estructural | Plan completo + ADR propuesto en `docs/adr/` |

## What NOT to do

- ❌ **No escribas código.** Ni un snippet de implementación. Firmas y tipos, como mucho.
- ❌ No planifiques sin leer el código existente de los features afectados.
- ❌ No propongas abstracciones para un solo caso de uso. Se extrae en la tercera repetición.
- ❌ No omitas las siete preguntas móviles porque "esta feature es simple". Justo ahí se cuelan.
- ❌ No propongas nuevas dependencias sin marcarlas para pasar por `vet-dependency` primero.
- ❌ No contradigas un ADR en silencio. Dilo y propón actualizarlo.
- ❌ No inventes el dominio de negocio. Si el plan depende de reglas de producto no definidas,
  pregúntalas en "Preguntas abiertas" en vez de asumirlas.
