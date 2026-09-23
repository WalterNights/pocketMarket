# 07 — Rendimiento

El rendimiento en móvil no es una optimización posterior: es un requisito funcional que las
stores y los usuarios miden. Una app que tarda 4 s en abrir se desinstala.

## Presupuestos

Objetivos que un cambio no debe empeorar. Si los supera, es un bloqueante, no una sugerencia:

| Métrica | Objetivo | Se mide con |
|---|---|---|
| Cold start (TTI) hasta primer contenido | < 2 s en gama media | `expo-dev-client` perf monitor / Flashlight |
| Transición entre pantallas | < 300 ms a contenido o skeleton | Percepción + trace |
| Scroll de listas | 60 fps (120 en pantallas ProMotion), 0 frames perdidos sostenidos | Perf Monitor / DevTools |
| Respuesta al tap | Feedback visual < 100 ms | Inspección |
| Tamaño del binario | < 60 MB Android (AAB) | Salida de EAS Build |
| Memoria en lista larga | Plana al hacer scroll, no creciente | Xcode Instruments / Android Profiler |

## Arranque en frío

Es la métrica más visible y la más fácil de arruinar.

1. **No bloquees el splash con trabajo no crítico.** Solo fuentes y sesión. Analytics, remote
   config, precargas y migraciones van después del primer render.
2. **Importa perezosamente lo pesado.** Un `import` de nivel superior a un módulo de 2 MB se
   evalúa en el arranque aunque la pantalla no se visite.
3. **No hagas trabajo síncrono largo en el primer render.** Descifrar, parsear un JSON grande o
   rehidratar un store enorme bloquea el JS thread y retrasa el primer frame.
4. **El caché persistido es tu aliado.** Rehidratar TanStack Query desde MMKV (síncrono, rápido)
   permite pintar contenido real sin esperar a la red.

## Listas

La causa número uno de apps lentas.

```tsx
<FlashList
  data={items}
  renderItem={renderItem}          // definido FUERA del componente, o con useCallback
  keyExtractor={(item) => item.id} // id estable, nunca el índice
  estimatedItemSize={96}
  onEndReachedThreshold={0.5}
  onEndReached={fetchNextPage}
/>
```

- **FlashList** sobre `FlatList`: recicla vistas en vez de montarlas y desmontarlas.
- **`renderItem` estable.** Una función nueva en cada render invalida la memoización de todas
  las filas.
- **Fila memoizada** (`React.memo`) con props primitivas. Si le pasas un objeto o callback nuevo
  por fila, `memo` no sirve de nada.
- **Altura conocida** siempre que se pueda. El reflow por altura variable es caro.
- **Paginar en el servidor.** `.range()` en Supabase + `useInfiniteQuery`. Nunca traer 2000 filas
  "porque son pocas": son pocas hoy.
- **Cero lógica pesada en `renderItem`.** Formateo de fechas y monedas: precalculado o memoizado.

## Re-renders

```tsx
const total = useCartStore((s) => s.total)        // suscripción granular
```

Orden de ataque cuando algo re-renderiza de más:

1. **Mide antes de tocar nada.** React DevTools Profiler → "why did this render". Memoizar a
   ciegas añade coste de comparación sin beneficio.
2. **Sube el estado lo menos posible.** Un `useState` en el componente correcto elimina más
   re-renders que cualquier `memo`.
3. **Selectores** en Zustand y `select` en TanStack Query para suscribirse solo a la porción
   relevante.
4. **`memo` / `useCallback` / `useMemo`** al final, donde el profiler lo justifique.

Con React 19 y el compilador, gran parte de la memoización manual sobra. Aun así, `renderItem`
y las props de filas siguen mereciendo atención explícita.

## Animaciones y gestos

Regla única: **lo que se anima a 60 fps no pasa por el hilo de JS**.

```tsx
const offset = useSharedValue(0)

const pan = Gesture.Pan()
  .onUpdate((e) => { offset.value = e.translationX })   // worklet: corre en el hilo de UI

const style = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }))
```

- `react-native-reanimated` + `react-native-gesture-handler`. No `Animated` de RN para gestos.
- `useSharedValue`, nunca `useState`, para valores que cambian por frame.
- `runOnJS` solo al **final** del gesto (para disparar navegación o una mutación), jamás en cada
  update.
- Anima `transform` y `opacity`. `width`, `height`, `top` y `margin` provocan layout en cada
  frame.
- Transiciones de pantalla: deja que las haga el navegador nativo.

## Imágenes

Segundo consumidor de memoria tras las listas.

- `expo-image` con `cachePolicy="memory-disk"`.
- `contentFit` explícito y **dimensiones explícitas** en el contenedor (evita reflow).
- `placeholder` con blurhash o thumbhash: percepción de velocidad sin coste real.
- Pedir a Supabase Storage la transformación al tamaño de pantalla, no la original.
- `priority="low"` para lo que está fuera de la vista inicial.

## Red

- **Deduplicación y caché**: los da TanStack Query; no reimplementes.
- **`select()` con columnas explícitas** en Supabase.
- **Backoff exponencial** con tope (ya en la config por defecto).
- **Cancelar al desmontar**: pasar el `signal` de la query a la petición.
- **No pollear.** Realtime o refetch al volver a foreground.
- **Batching**: una consulta con `in()` en vez de N consultas en un bucle (el N+1 también existe
  aquí, y en móvil cuesta latencia de radio además de CPU).

## Tamaño del bundle y del binario

- Revisar cada dependencia antes de instalarla (ver skill `vet-dependency`). En móvil una
  librería no solo pesa: puede arrastrar código nativo y bloquear un upgrade de SDK.
- Activar el compilador de Hermes bytecode (por defecto) y ProGuard/R8 en Android release.
- Nada de `moment`, `lodash` completo ni polyfills de web.
- `expo-asset` con carga bajo demanda para recursos grandes.

## Medición — antes de optimizar

| Herramienta | Para qué |
|---|---|
| Perf Monitor (dev menu) | FPS de JS y UI thread en vivo |
| React DevTools Profiler | Qué componente re-renderiza y por qué |
| Flashlight | Puntuación de rendimiento automatizada en Android, comparable entre commits |
| Xcode Instruments / Android Studio Profiler | Memoria, CPU, fugas |
| Sentry Performance | Cold start y transiciones **en producción**, que es donde importa |

**Siempre en build de release y en dispositivo físico de gama media.** El modo desarrollo es
varias veces más lento y un simulador en un portátil moderno no representa a nadie.
