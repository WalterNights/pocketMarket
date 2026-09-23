---
name: rn-analyze
description: Use this skill whenever the user asks to "analiza", "analyze", "investiga", "explica cómo funciona", "revisa la arquitectura", "dónde está", "por qué falla", "entiende este módulo", "explain this code", "architecture review", "deuda técnica", "tech debt", or any request to UNDERSTAND existing code, diagnose a bug, or assess architectural health in this React Native app. Read-only: it reports findings, it does not change code. Use rn-review for diff review, rn-plan for designing new work.
argument-hint: [qué analizar: módulo, síntoma, pregunta]
---

# RN Analyze — entender antes de tocar

Objeto del análisis: **$ARGUMENTS**

Skill de **solo lectura**. Produce entendimiento y diagnóstico, no cambios.

## Elegir el modo

| El usuario pide… | Modo | Salida |
|---|---|---|
| "explica cómo funciona X" | **Comprensión** | Mapa del flujo, capas implicadas, puntos de entrada |
| "por qué falla X" / un stack trace | **Diagnóstico** | Causa raíz con evidencia, no hipótesis |
| "revisa la arquitectura" / "¿cómo vamos de deuda?" | **Salud** | Violaciones de capa, anti-patrones, riesgos priorizados |
| "¿dónde está X?" | **Localización** | Rutas de archivo y por qué están ahí |

## Contexto obligatorio

Antes de analizar, cargar en paralelo:

- `CLAUDE.md` y las reglas de `.claude/rules/` que apliquen al área
- `.claude/rules/known-issues.md` — el síntoma puede estar ya documentado
- El documento de `docs/architecture/` correspondiente al área
- Los ADR relevantes en `docs/adr/`

Para el modo **Diagnóstico**, revisar primero known-issues y las "trampas conocidas del stack":
gran parte de los fallos de este stack son conocidos y no hace falta redescubrirlos.

---

## Modo Comprensión

Traza el flujo completo, de arriba abajo, con rutas reales:

```
Ruta (app/...)
  └─ Componente de feature
       └─ Hook fachada
            └─ Query / mutation
                 └─ Repositorio
                      └─ Supabase (tabla + política RLS)
```

En cada nivel señala: qué estado se toca, qué puede fallar y qué ocurre sin red.

## Modo Diagnóstico

Reglas duras:

1. **Leer el código, no adivinar.** Grep del mensaje de error, leer el archivo, trazar el flujo
   desde el punto de entrada.
2. **Distinguir síntoma de causa.** "El componente re-renderiza" es un síntoma; "el store se
   consume sin selector" es la causa.
3. **Evidencia por afirmación.** Cada punto del diagnóstico cita `archivo:línea`. Sin cita, es
   hipótesis y se marca como tal.
4. **Clasificar la capa** antes de proponer nada:

| Capa | Pistas típicas |
|---|---|
| **JS / lógica** | Reproducible en cualquier dispositivo, con stack trace de JS |
| **Nativo / SDK** | Solo en una plataforma; crash sin stack de JS; aparece tras instalar una librería |
| **Datos / RLS** | Respuesta vacía sin error, o error de permiso de Postgres |
| **Caché / estado** | Se arregla al reiniciar la app o al limpiar datos |
| **Red / offline** | Depende de conectividad; queries en `pending` eternos |
| **Build / config** | Falla en release pero no en dev, o tras `prebuild` |

5. **Reproducir mentalmente el peor caso móvil:** sin red, tras background, con permiso denegado,
   con estado persistido de una versión anterior.

## Modo Salud (arquitectura y deuda)

Checklist de auditoría, en este orden de gravedad:

### Violaciones estructurales (bloqueantes)
- [ ] `shared/` importando de `features/`
- [ ] Un feature importando internos de otro feature (no su `index.ts`)
- [ ] Fetch o lógica de negocio dentro de `app/`
- [ ] `supabase` importado fuera de `features/**/api/`
- [ ] React, red o `Platform.OS` dentro de `model/`

### Anti-patrones (ver `03-patterns.md`)
- [ ] `useEffect` + `setState` para traer datos
- [ ] Server state duplicado en Zustand
- [ ] Query keys literales en vez del factory
- [ ] `ScrollView` + `.map()` sobre datos remotos
- [ ] Store consumido sin selector
- [ ] `select('*')`
- [ ] Vistas sin los cuatro estados
- [ ] `catch` silencioso

### Riesgos móviles
- [ ] Store persistido sin `version`/`migrate`
- [ ] Datos sensibles fuera de SecureStore
- [ ] Permisos sin ruta degradada
- [ ] Suscripciones realtime sin pausa en background
- [ ] Tabla sin RLS o política sin `WITH CHECK`
- [ ] Logout que no limpia caché ni persister

### Salud general
- [ ] Cobertura de `model/` con tests
- [ ] Dependencias sin usar o duplicadas
- [ ] Compatibilidad de librerías con la New Architecture
- [ ] `pnpm run quality` en verde

---

## Formato de salida

```markdown
## Análisis: <objeto>

**Modo:** Comprensión | Diagnóstico | Salud | Localización
**Alcance revisado:** <archivos / módulos leídos>

### Conclusión
<2-4 frases. La respuesta directa a lo que se preguntó, primero.>

### Evidencia
| # | Hallazgo | Ubicación | Evidencia |
|---|---|---|---|
| 1 | ... | [`archivo.ts:42`](archivo.ts#L42) | <qué dice el código> |

### <Flujo | Causa raíz | Hallazgos priorizados>
<según el modo>

### Riesgos
| Severidad | Riesgo | Impacto en móvil |
|---|---|---|
| 🔴 | ... | ... |
| 🟡 | ... | ... |
| 🟢 | ... | ... |

### Recomendaciones
1. <acción concreta> — <coste estimado: bajo/medio/alto>

### Incertidumbres
- <lo que NO se pudo determinar con el código leído, y qué haría falta para cerrarlo>
```

Severidad: 🔴 rompe funcionalidad, seguridad o la regla de dependencia · 🟡 deuda que crecerá ·
🟢 mejora opcional.

## What NOT to do

- ❌ **No modifiques archivos.** Esta skill reporta. Si el usuario quiere el arreglo, se usa
  `rn-implement` después.
- ❌ No presentes hipótesis como hechos. Sin `archivo:línea`, se etiqueta como hipótesis.
- ❌ No audites todo el repo cuando se preguntó por un módulo. Respeta el alcance.
- ❌ No repitas el código verbatim: sintetiza y cita la ubicación.
- ❌ No recomiendes reescribir algo por preferencia estilística. Solo por regla documentada o
  riesgo real.
- ❌ No des por buena una explicación que no cubra el caso móvil (sin red, background, permiso
  denegado). Si el análisis no lo contempla, está incompleto.
