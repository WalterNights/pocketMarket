---
name: rn-perf-audit
description: Use this skill whenever the user asks about "performance", "rendimiento", "va lento", "la app tarda", "lag", "se traba", "scroll lento", "arranque lento", "cold start", "TTI", "consume batería", "consume memoria", "optimiza", "optimize", "por qué re-renderiza", "janky", or any concern about speed, smoothness, memory, battery or bundle size in this React Native app. Audits against the project's performance budgets (docs/architecture/07-performance.md) covering cold start, lists, re-renders, animations, images, network and binary size, and reports findings ranked by measured or expected impact.
argument-hint: [pantalla, flujo o síntoma]
---

# RN Perf Audit — auditoría de rendimiento móvil

Objeto: **$ARGUMENTS**

Referencia: [`docs/architecture/07-performance.md`](../../../docs/architecture/07-performance.md)

## Regla número uno

> **Medir antes de tocar.** Una optimización sin medición previa es una suposición que añade
> complejidad. Si no se puede medir, decirlo explícitamente en el informe y marcar el hallazgo
> como *esperado*, no *confirmado*.

Y siempre: **build de release, dispositivo físico de gama media**. El modo desarrollo es varias
veces más lento y un simulador en un portátil moderno no representa a ningún usuario.

## Presupuestos

| Métrica | Objetivo |
|---|---|
| Cold start hasta primer contenido | < 2 s en gama media |
| Transición entre pantallas | < 300 ms a contenido o skeleton |
| Scroll de listas | 60 fps (120 en ProMotion), sin frames perdidos sostenidos |
| Respuesta al tap | Feedback visual < 100 ms |
| Binario Android (AAB) | < 60 MB |
| Memoria en lista larga | Plana durante el scroll, no creciente |

Un cambio que empeora un presupuesto es **bloqueante**, no una sugerencia.

## Clasificar el síntoma primero

| Síntoma | Sospechosos habituales |
|---|---|
| **Arranque lento** | Trabajo síncrono antes del primer frame; imports pesados de nivel superior; rehidratación grande; splash bloqueado por red |
| **Scroll con tirones** | `ScrollView` + `.map()`; `renderItem` inestable; filas sin memo; altura variable; imágenes sin dimensionar; trabajo en `renderItem` |
| **Gesto/animación a saltos** | `useState` en vez de worklets; `runOnJS` en cada update; animar `width`/`height`/`top`; trabajo en el JS thread durante el gesto |
| **Pantalla lenta al abrir** | Sin prefetch; consulta sin índice; N+1; sin skeleton |
| **Re-renders excesivos** | Store sin selector; Context para estado que cambia seguido; objetos nuevos como props; `key` inestable |
| **Memoria creciente** | Listas sin reciclar; imágenes sin caché limitada; listeners sin limpiar; suscripciones sin cerrar |
| **Batería** | Polling; realtime abierto en background; trabajo periódico sin pausar; geolocalización continua |
| **Binario grande** | Dependencias pesadas; assets sin optimizar; sin R8/ProGuard |

## Herramientas

| Herramienta | Para qué | Cuándo |
|---|---|---|
| Perf Monitor (dev menu) | FPS de JS y UI thread en vivo | Primer vistazo |
| React DevTools Profiler | Qué re-renderiza y **por qué** | Sospecha de re-renders |
| Flashlight | Puntuación automatizada en Android, comparable entre commits | Regresiones |
| Xcode Instruments / Android Profiler | Memoria, CPU, fugas | Memoria o crash por OOM |
| Sentry Performance | Cold start y transiciones **en producción** | Lo que de verdad viven los usuarios |
| Salida de EAS Build | Tamaño del binario | Cada release |

Si no hay acceso a dispositivo o medición en esta sesión, decirlo y limitar el informe a
hallazgos estáticos identificables por lectura de código.

## Auditoría estática

### Arranque
- [ ] ¿Hay trabajo síncrono largo antes del primer render? (descifrado, parseo de JSON grande)
- [ ] ¿El splash espera algo que no sea fuentes y sesión?
- [ ] ¿Hay imports de nivel superior a módulos pesados que la pantalla inicial no usa?
- [ ] ¿Analytics, remote config y precargas ocurren **después** del primer render?
- [ ] ¿Se rehidrata el caché de Query desde MMKV (síncrono) en vez de esperar a la red?

### Listas
- [ ] `FlashList`, no `FlatList` ni `ScrollView` + `.map()`
- [ ] `estimatedItemSize` presente y realista
- [ ] `renderItem` estable; fila con `React.memo` y props primitivas
- [ ] `keyExtractor` con id estable
- [ ] Paginación en servidor (`.range()`), no colección completa
- [ ] Sin formateo de fechas/monedas dentro de `renderItem`

### Re-renders
- [ ] Zustand consumido con selector (`useShallow` si devuelve objeto)
- [ ] `select` en queries para suscribirse solo a la porción usada
- [ ] Context solo para dependencias estáticas, no para estado que cambia
- [ ] Estado al nivel más bajo posible
- [ ] Memoización solo donde el profiler la justifica

### Animación
- [ ] Reanimated worklets; `useSharedValue`, no `useState`
- [ ] `runOnJS` solo al final del gesto
- [ ] Solo `transform` y `opacity`
- [ ] Transiciones de pantalla delegadas al navegador nativo
- [ ] `useReducedMotion()` respetado

### Imágenes
- [ ] `expo-image` con `cachePolicy="memory-disk"`
- [ ] `contentFit` y dimensiones explícitas del contenedor
- [ ] `placeholder` (blurhash)
- [ ] Transformación de tamaño pedida a Supabase Storage, no la original
- [ ] `priority="low"` fuera de la vista inicial

### Red
- [ ] Sin `select('*')`
- [ ] Sin N+1 (usar `in()`)
- [ ] Sin polling; `refetchInterval` + focus donde haga falta
- [ ] `signal` propagado para cancelar al desmontar
- [ ] `staleTime` razonable (no refetchear al mirar)
- [ ] Prefetch en `onPressIn` antes de navegar

### Ciclo de vida y batería
- [ ] Realtime cerrado en background
- [ ] Listeners y temporizadores limpiados en el cleanup del efecto
- [ ] Trabajo periódico pausado fuera de foreground

### Bundle y binario
- [ ] Dependencias justificadas (pasadas por `vet-dependency`)
- [ ] Sin `moment`, sin `lodash` completo, sin polyfills de web
- [ ] Assets grandes con carga bajo demanda
- [ ] R8/ProGuard activo en release de Android

---

## Formato de salida

```markdown
## Auditoría de rendimiento: <objeto>

**Condiciones de medición:** <dispositivo, build, herramienta> | "Sin medición — análisis estático"

### Veredicto
<2-3 frases: dónde está el coste real y qué lo causa>

### Mediciones
| Métrica | Presupuesto | Medido | Estado |
|---|---|---|---|
| ... | ... | ... | ✅ / ⚠️ / ❌ |

### Hallazgos, por impacto

#### 1. <título> — 🔴 Alto | 🟡 Medio | 🟢 Bajo
**Dónde:** [`archivo.tsx:42`](archivo.tsx#L42)
**Coste:** <medido, o estimado y marcado como tal>
**Causa:** <mecanismo concreto — por qué esto cuesta>
**Arreglo:**
```tsx
<antes → después>
```
**Verificación:** <cómo confirmar que mejoró>

### Descartado
<lo que parecía problema y no lo es, con la razón — evita que alguien lo "optimice" después>

### Siguiente medición
<qué medir después de aplicar los arreglos, y con qué herramienta>
```

Ordenar los hallazgos por **impacto**, nunca por facilidad de arreglo.

## What NOT to do

- ❌ No optimices sin medir. Y si no mediste, dilo.
- ❌ No memoices a ciegas: `memo`/`useMemo` tienen coste de comparación y complican el código.
- ❌ No saques conclusiones de una build de desarrollo o de un simulador.
- ❌ No reportes microoptimizaciones junto a problemas reales: entierran lo que importa.
- ❌ No propongas cambios de arquitectura como "optimización" sin datos que los respalden.
- ❌ No edites archivos salvo que el usuario pida aplicar los arreglos.
- ❌ No ignores el coste de batería y datos móviles: no salen en un profiler de FPS, pero el
  usuario los paga.
