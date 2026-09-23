# 04 — Estado y datos

## La regla de reparto

Antes de crear cualquier estado, responde: **¿quién es el dueño de este dato?**

| Pregunta | Sí → va en |
|---|---|
| ¿Vive en el servidor y puede quedar obsoleto? | **TanStack Query** |
| ¿Es de cliente y debe sobrevivir a cambios de pantalla? | **Zustand** |
| ¿Es de cliente y muere con la pantalla? | `useState` / `useReducer` |
| ¿Es el valor de un formulario? | **React Hook Form** |
| ¿Es un parámetro de navegación (id, filtro compartible)? | **URL / search params de expo-router** |
| ¿Es dependencia estática inyectada (tema, i18n, queryClient)? | **Context** |

El error más caro es duplicar server state dentro de Zustand. Un dato remoto copiado a un store
tiene dos fuentes de verdad que divergen en silencio. **TanStack Query ya es un store**: tiene
caché, deduplicación, invalidación, reintentos y persistencia.

---

## Server state — TanStack Query

### Configuración base

```ts
// shared/lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // móvil: no refetchear al mirar
      gcTime: 24 * 60 * 60_000,   // conservar para arranque offline
      retry: (failureCount, error) => {
        if (isAuthError(error) || isNotFound(error)) return false
        return failureCount < 3
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      refetchOnWindowFocus: false,  // lo gobernamos con AppState, no con "window"
      refetchOnReconnect: true,
      networkMode: 'offlineFirst',  // sirve caché sin red en vez de quedarse en pending
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: 2,
    },
  },
})
```

Diferencias deliberadas respecto a una app web:

- **`staleTime` alto.** En web refetchear al enfocar la pestaña es barato. En móvil cada refetch
  es batería y datos del usuario.
- **`gcTime` de 24 h.** El caché persistido es lo que permite abrir la app en el avión y ver algo.
- **`networkMode: 'offlineFirst'`.** Sin esto, las queries sin red se quedan en `pending` en vez
  de servir lo cacheado.
- **`refetchOnWindowFocus: false`** y en su lugar `focusManager` alimentado por `AppState`
  (ver abajo): el concepto correcto en móvil es foreground/background, no foco de ventana.

### Persistencia del caché

```ts
// shared/lib/query-persister.ts
const storage = new MMKV({ id: 'query-cache' })

export const persister = createSyncStoragePersister({
  storage: {
    getItem: (k) => storage.getString(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  },
})
```

MMKV es síncrono y ~30× más rápido que AsyncStorage: importa porque la rehidratación ocurre en
el arranque, dentro del presupuesto de TTI.

**Nunca persistir queries con datos sensibles.** Filtra con `dehydrateOptions.shouldDehydrateQuery`
y excluye por prefijo de clave (p. ej. todo lo que empiece por `['session']` o `['payment']`).

### Invalidación de caché tras logout

Al cerrar sesión: `queryClient.clear()` **y** borrar el storage del persister. Si no, el
siguiente usuario del dispositivo ve datos del anterior. Es un hallazgo de seguridad, no de estilo.

### AppState → focusManager

```ts
// shared/hooks/useAppStateSync.ts
AppState.addEventListener('change', (status) => {
  focusManager.setFocused(status === 'active')
})
```

Y la conectividad al `onlineManager`, con `@react-native-community/netinfo`. Ambos se montan
una sola vez en el root layout.

---

## Client state — Zustand

Un store **por dominio**, no un store global gigante.

```ts
// features/cart/store/cart-store.ts
type CartState = {
  items: CartItem[]
  addItem: (item: CartItem) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((s) => ({ items: addItemLocally(s.items, item) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'cart',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (s) => ({ items: s.items }),   // no persistir acciones ni estado derivado
      version: 1,
      migrate: (persisted, version) => { /* obligatorio al cambiar la forma */ },
    },
  ),
)
```

**Reglas:**
- La lógica de `addItemLocally` vive en `model/`, pura y testeable. El store solo orquesta.
- Nada de valores derivados en el estado: se calculan con selectores (`useCartStore(selectTotal)`).
- `version` + `migrate` **obligatorios** en cualquier store persistido. Un usuario puede
  actualizar la app con estado de una versión de hace seis meses; sin migración, la app crashea
  al arrancar y el usuario no puede ni entrar a arreglarlo.
- Consumir siempre por selector (patrón 11 de [03](03-patterns.md)).

---

## Offline-first: los tres niveles

| Nivel | Qué garantiza | Cómo |
|---|---|---|
| **1. Lectura offline** | La app abre y muestra el último estado conocido | Caché de Query persistido en MMKV |
| **2. Escritura offline** | Las acciones no se pierden sin red | Mutaciones persistidas + reanudación |
| **3. Sync bidireccional** | Cambios de otros dispositivos llegan | Realtime de Supabase + refetch al volver a foreground |

El nivel 3 **no** se implementa hasta que haya un caso de uso real multidispositivo: un canal
realtime abierto es una conexión WebSocket viva, con su coste de batería.

### Conflictos

Política por defecto: **last-write-wins con marca de servidor** (`updated_at` puesto por un
trigger de Postgres, nunca por el cliente — el reloj del dispositivo puede estar desfasado o
manipulado).

Cuando LWW no sea aceptable (p. ej. un contador de stock), la operación se resuelve **en el
servidor** con una función SQL atómica invocada por RPC, no con un read-modify-write en cliente.

---

## Formularios

React Hook Form + resolver de Zod. El mismo schema de `model/` valida el formulario y la
respuesta del repositorio; una sola definición de la forma del dato.

```ts
const form = useForm<ProductInput>({
  resolver: zodResolver(productInputSchema),
  mode: 'onBlur',        // en móvil, validar en cada tecla es ruidoso y caro
})
```

Consideraciones móviles que un formulario web no tiene:
- `keyboardType` e `inputMode` correctos por campo (numérico, email, teléfono).
- `returnKeyType` + `onSubmitEditing` para encadenar campos.
- `autoComplete` / `textContentType` para que el gestor de contraseñas del SO funcione.
- El teclado tapa el campo: `KeyboardAvoidingView` o `keyboard-controller`.
- Guardar borrador si la app va a background a mitad de un formulario largo.

---

## Tipos generados de Supabase

```bash
pnpm supabase gen types typescript --project-id <id> > src/shared/types/database.types.ts
```

- El archivo **no se edita a mano** y se regenera tras cada migración.
- Los tipos generados describen *la BD*, no *el dominio*. El repositorio traduce de uno a otro.
- Que TypeScript compile no prueba que la fila recibida tenga esa forma en runtime: por eso el
  `.parse()` de Zod en la frontera.
