# 03 — Patrones de diseño

Catálogo de los patrones que **sí** usamos, con el problema móvil concreto que resuelven.
Un patrón sin problema asociado es deuda: no se aplica "porque es buena práctica".

---

## 1. Repository — aislar Supabase

**Problema:** si `supabase.from('products')` aparece en 40 componentes, cambiar el backend,
añadir caché o testear sin red es imposible.

```ts
// features/products/api/product-repository.ts
import { supabase } from '@/shared/lib/supabase'
import { productSchema, type Product } from '../model/product'

export const productRepository = {
  async list(params: ListParams): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, brand, unit_value, unit_measure, image_url')
      .order('created_at', { ascending: false })
      .range(params.offset, params.offset + params.limit - 1)

    if (error) throw new RepositoryError('products.list', error)
    return productSchema.array().parse(data)
  },
}
```

**Reglas:**
- El repositorio **valida con Zod** en la frontera. La BD puede cambiar; el tipo generado miente
  si alguien alteró el schema sin regenerar.
- Devuelve tipos de dominio, no filas crudas (el mapeo de columnas a `Product` vive aquí o en `model/`).
- Dinero en **`integer` COP**. Nunca float ni decimal.
- Lanza errores tipados; no propaga `{ data, error }` hacia arriba.
- **Nunca** `select('*')`: cada columna extra es batería y datos móviles del usuario.

---

## 2. Custom hook como fachada

**Problema:** el componente no debe saber si el dato viene de caché, red o store.

```ts
// features/products/hooks/useProducts.ts
export function useProducts(filters: ProductFilters) {
  return useInfiniteQuery({
    queryKey: productKeys.list(filters),
    queryFn: ({ pageParam }) => productRepository.list({ ...filters, offset: pageParam }),
    getNextPageParam: (last, all) => (last.length < PAGE_SIZE ? undefined : all.flat().length),
    initialPageParam: 0,
  })
}
```

El componente consume `useProducts()`. Si mañana añadimos caché local SQLite, cambia el hook y
ningún componente se entera.

---

## 3. Container / Presentational (screen vs view)

**Problema:** los componentes que hacen fetch no se pueden testear ni reutilizar.

- `ProductListScreen` — *container*: llama hooks, decide estados (loading/error/empty/data).
- `ProductListView` — *presentational*: recibe props, cero hooks de datos, trivial de testear
  y de mostrar en cualquier estado.

No se aplica a todo: un componente de presentación con un `useState` de UI no necesita partirse.
Se aplica cuando hay **datos remotos** de por medio.

---

## 4. Los cuatro estados, siempre

**Problema:** en móvil el estado "sin red y sin caché" es cotidiano, no un caso borde.

Toda vista con datos remotos resuelve explícitamente:

| Estado | Qué muestra |
|---|---|
| `loading` | Skeleton con la forma del contenido real (no spinner centrado) |
| `error` | Mensaje accionable + **botón de reintento** |
| `empty` | Icono de línea + frase + acción primaria ("Añade tu primer producto") |
| `data` | El contenido |

Un `if (isLoading) return <Spinner />` seguido de `data.map()` sin ramas de error ni vacío es
un hallazgo de review.

---

## 5. Compound components — UI compuesta sin prop drilling

**Problema:** `<Card title icon subtitle badge onPress footerAction ... />` con 14 props.

```tsx
<Card onPress={open}>
  <Card.Media source={product.image} />
  <Card.Body>
    <Card.Title>{product.name}</Card.Title>
    <Card.Price value={product.price} />
  </Card.Body>
</Card>
```

Estado compartido por Context **local al componente** (ese sí es su caso de uso legítimo).

---

## 6. Adapter — envolver todo SDK nativo

**Problema:** las librerías nativas rompen entre versiones de SDK, cambian de nombre o se
abandonan. Si `expo-image-picker` se llama en 12 sitios, migrar es un refactor de 12 archivos.

```ts
// shared/lib/media.ts — única superficie que conoce el SDK
export async function pickImage(): Promise<PickedImage | null> { ... }
```

Aplica a: cámara, ubicación, notificaciones, biometría, share, ficheros, analytics, compras.
Además el adapter es el lugar natural donde vive la **degradación por permiso denegado**.

---

## 7. Strategy por plataforma

**Problema:** iOS y Android divergen en haptics, gesto de retroceso, densidad, permisos, fuentes.

```ts
const impact = Platform.select({
  ios: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  android: () => Vibration.vibrate(10),
})
```

Para divergencias grandes, archivos separados: `Picker.ios.tsx` / `Picker.android.tsx`.
Metro resuelve la extensión automáticamente. **Nunca** `Platform.OS` dentro de `model/`.

---

## 8. Optimistic update + rollback

**Problema:** una red móvil de 400 ms hace que la UI se sienta rota si espera al servidor.

```ts
useMutation({
  mutationFn: cartRepository.addItem,
  onMutate: async (item) => {
    await queryClient.cancelQueries({ queryKey: cartKeys.current() })
    const previous = queryClient.getQueryData(cartKeys.current())
    queryClient.setQueryData(cartKeys.current(), (old) => addItemLocally(old, item))
    return { previous }                                    // contexto para rollback
  },
  onError: (_err, _item, ctx) => {
    queryClient.setQueryData(cartKeys.current(), ctx?.previous)
    toast.error('No se pudo añadir. Reintenta.')
  },
  onSettled: () => queryClient.invalidateQueries({ queryKey: cartKeys.current() }),
})
```

`addItemLocally` es una **función pura de `model/`** — la misma regla que aplicará el servidor.
Duplicar la regla en cliente y servidor es intencional: el cliente la usa para *predecir*, el
servidor para *decidir*.

---

## 9. Cola de mutaciones offline

**Problema:** el usuario pulsa "guardar" en el metro. La app no puede perder ese dato.

Usamos la persistencia de mutaciones de TanStack Query: las mutaciones se serializan a MMKV y se
reanudan al recuperar conectividad. Requisitos:

- Toda mutación encolable tiene `mutationKey` y un **default handler registrado**
  (`queryClient.setMutationDefaults`), o no se puede rehidratar tras reinicio del proceso.
- El payload debe ser serializable (nada de `File` en memoria: guarda la URI y sube después).
- Las operaciones deben ser **idempotentes** o llevar un `client_id` (UUID generado en cliente)
  deduplicado en el servidor con un índice único.

---

## 10. Query key factory

**Problema:** claves de caché escritas a mano provocan invalidaciones que no invalidan.

```ts
// features/products/api/keys.ts
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (f: ProductFilters) => [...productKeys.lists(), f] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
}
```

`invalidateQueries({ queryKey: productKeys.lists() })` invalida todas las listas y ninguna ficha.
Claves literales en línea = hallazgo de review.

---

## 11. Selector-based subscription (Zustand)

**Problema:** suscribirse al store entero re-renderiza toda la pantalla ante cualquier cambio.

```ts
const total = useCartStore((s) => s.total)          // re-render solo si cambia total
const { total } = useCartStore()                    // re-render ante CUALQUIER cambio
```

Para selectores que devuelven objetos o arrays nuevos, usar `useShallow`.

---

## 12. Error boundary por zona

**Problema:** en RN una excepción no capturada durante el render **cierra la app**. No hay
"pestaña rota"; hay crash y una reseña de una estrella.

Tres niveles:
1. **Root** (`app/_layout.tsx`) — última red, reporta a Sentry, ofrece reiniciar.
2. **Por ruta** — expo-router admite un `ErrorBoundary` exportado desde el layout del grupo.
3. **Por widget de riesgo** — un carrusel de terceros que falle no debe tumbar el checkout.

Los errores **asíncronos** (fetch) no los captura un error boundary: se manejan en el estado
`error` de la query (patrón 4).

---

## 13. AppState como parte del modelo

**Problema:** la app pasa a background y vuelve horas después mostrando datos rancios;
o sigue consumiendo batería con una suscripción realtime mientras está oculta.

```ts
// shared/hooks/useAppState.ts — conecta AppState al focusManager de TanStack Query
// y a la pausa/reanudación de canales realtime
```

Regla: **toda suscripción realtime se cierra en background y se reabre en foreground**,
seguida de un refetch (los eventos perdidos no se recuperan solos).

---

## Anti-patrones — hallazgo automático en review

| Anti-patrón | Por qué duele en móvil |
|---|---|
| `useEffect` + `setState` para traer datos | Race conditions, sin caché, sin reintento, sin dedupe. Usa TanStack Query. |
| Context para estado que cambia seguido | Re-renderiza todo el subárbol. Usa Zustand con selector. |
| `ScrollView` + `.map()` sobre lista remota | Monta N elementos en memoria. Usa FlashList. |
| `<Text>` de RN en vez del componente del DS | Rompe theming y el escalado de fuente del sistema (a11y). |
| Token de sesión en AsyncStorage/MMKV plano | Legible en dispositivo rooteado o vía backup. Usa SecureStore. |
| Secreto de servicio en `EXPO_PUBLIC_*` | Va dentro del bundle. Es público. Siempre. |
| `setInterval` para refrescar | Drena batería y sigue corriendo en background. Usa `refetchInterval` + focus. |
| Animar con `useState` en `onGestureEvent` | Cruza el puente en cada frame. Usa worklets de Reanimated. |
| `select('*')` | Transfiere columnas que nadie usa, con datos móviles del usuario. |
| Índice del array como `key` en listas mutables | Estado de fila desalineado al reordenar o eliminar. |
| Área táctil < 44pt | Inaccesible. Usa `hitSlop` o padding. |
| `try/catch` que traga el error en silencio | Fallo invisible en producción, imposible de diagnosticar. |
