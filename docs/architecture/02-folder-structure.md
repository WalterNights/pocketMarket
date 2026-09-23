# 02 — Estructura de carpetas

## Árbol completo

```
pocket-market/
├── app/                          # RUTAS (expo-router). Ver 05-navigation.md
│   ├── _layout.tsx               # root: providers, fuentes, splash, error boundary
│   ├── +not-found.tsx
│   ├── +html.tsx                 # (solo si habilitamos web)
│   ├── (auth)/                   # grupo: sesión no iniciada
│   │   ├── _layout.tsx           # redirige a (tabs) si ya hay sesión
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/                   # grupo: app autenticada
│   │   ├── _layout.tsx           # <Tabs> + guard de sesión
│   │   ├── index.tsx
│   │   ├── search.tsx
│   │   └── profile.tsx
│   └── product/
│       └── [id].tsx              # ruta dinámica
│
├── src/
│   ├── features/                 # verticales de producto
│   │   ├── catalog/              # búsqueda de productos, ficha, precio por tienda
│   │   ├── lists/                # listas, ítems, totales por tienda
│   │   ├── reminders/            # recordatorios periódicos
│   │   ├── auth/                 # sesión (del que dependen los demás)
│   │   └── <feature>/
│   │       ├── api/
│   │       ├── model/
│   │       ├── hooks/
│   │       ├── components/
│   │       ├── store/
│   │       └── index.ts
│   │
│   └── shared/                   # horizontal, sin conocimiento de features
│       ├── ui/                   # design system: Button, Text, Screen, Sheet…
│       │   └── theme/            # tokens, dark mode
│       ├── lib/
│       │   ├── supabase.ts       # cliente único
│       │   ├── query-client.ts   # QueryClient + persister MMKV
│       │   ├── storage.ts        # MMKV (no sensible) + SecureStore (sensible)
│       │   ├── analytics.ts
│       │   └── logger.ts
│       ├── hooks/                # useAppState, useDebounce, useOnlineStatus…
│       ├── config/               # env.ts (validado con Zod), constants.ts
│       ├── types/                # database.types.ts (generado por Supabase CLI)
│       └── utils/                # funciones puras
│
├── ingestion/                    # PIPELINE DE PRECIOS — no es la app, no corre en el móvil
│   ├── adapters/                 # un archivo por tienda: exito.ts, d1.ts…
│   │   └── __fixtures__/         # respuestas reales, contrato con cada fuente
│   ├── core/
│   │   ├── pipeline.ts           # orquestación común (fetch→normalize→upsert→snapshot)
│   │   ├── normalize.ts          # unidades, marcas, categorías
│   │   └── schemas.ts            # Zod del producto normalizado — lo único compartido con la app
│   └── runners/
│       ├── edge/                 # entrypoints Deno
│       └── node/                 # entrypoints para GitHub Actions
│
├── assets/                       # fuentes, imágenes, splash, iconos
├── supabase/                     # migraciones SQL, políticas RLS, edge functions
│   ├── migrations/
│   └── functions/
├── .github/workflows/
│   ├── quality.yml
│   └── ingest.yml                # cron de scraping
├── e2e/                          # flows Maestro (.yaml)
├── docs/
│   ├── architecture/
│   ├── adr/
│   └── logs/
├── .claude/
│   ├── skills/
│   └── rules/
├── app.config.ts                 # config dinámica + config plugins (CNG)
├── eas.json                      # perfiles de build/submit/update
├── CLAUDE.md
└── package.json
```

## Por qué `app/` fuera de `src/`

Convención de expo-router: el directorio de rutas se resuelve desde la raíz por defecto.
Se puede mover a `src/app`, pero no ganamos nada y perdemos alineación con toda la documentación
y ejemplos del ecosistema. Mantenerlo en raíz hace obvio que `app/` **es** el enrutador y no
código de aplicación.

## `app/` es composición, no implementación

Una ruta debería caber en una pantalla de editor. Si crece, la implementación pertenece a un
feature.

```tsx
// app/product/[id].tsx  ✅
import { useLocalSearchParams } from 'expo-router'
import { ProductDetailScreen } from '@/features/products'

export default function ProductDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ProductDetailScreen productId={id} />
}
```

```tsx
// app/product/[id].tsx  ❌
export default function ProductDetailRoute() {
  const { id } = useLocalSearchParams()
  const [product, setProduct] = useState(null)
  useEffect(() => { supabase.from('products')... }, [id])   // datos en la ruta
  ...200 líneas de JSX y StyleSheet
}
```

La ruta traduce *parámetros de navegación* a *props de un componente de feature*. Nada más.

## Alias de importación

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- `@/features/cart` — API pública de un feature
- `@/shared/ui` — design system
- Imports **relativos** solo dentro del mismo feature (`./model/types`, `../hooks/useCart`)

Esto hace que un import relativo que sube más de un nivel (`../../`) sea una señal visible de
violación de capa en el diff.

## Convenciones de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | `PascalCase.tsx` | `ProductCard.tsx` |
| Hooks | `camelCase.ts` con prefijo `use` | `useProducts.ts` |
| Módulos no-React | `kebab-case.ts` | `query-client.ts`, `format-money.ts` |
| Tipos/interfaces | `PascalCase`, sin prefijo `I` | `Product`, no `IProduct` |
| Schemas Zod | `camelCase` + sufijo `Schema` | `productSchema` |
| Constantes | `SCREAMING_SNAKE_CASE` | `MAX_CART_ITEMS` |
| Query keys | factory por feature | `productKeys.detail(id)` |
| Rutas expo-router | `kebab-case` | `sign-in.tsx`, `order-history.tsx` |
| Tests | junto al archivo, `.test.ts(x)` | `format-money.test.ts` |

## Dónde va cada cosa — tabla de decisión

| Estoy escribiendo… | Va en… |
|---|---|
| Una pantalla nueva accesible por URL | `app/` (ruta fina) + `features/<f>/components/<X>Screen.tsx` |
| Un botón que usarán 3 features | `shared/ui/` |
| Un botón que solo usa checkout | `features/checkout/components/` |
| El cálculo del total del carrito | `features/cart/model/` (función pura) |
| La llamada a Supabase para listar productos | `features/products/api/` |
| El token de sesión | `shared/lib/storage.ts` → SecureStore |
| El filtro activo de la lista | `features/products/store/` o `useState` si no sobrevive |
| Un tipo generado de la BD | `shared/types/database.types.ts` (no editar a mano) |
| Una variable de entorno | `shared/config/env.ts`, validada con Zod |
| Un `Platform.OS === 'ios'` | Capa de UI (`components/`, `shared/ui/`). Nunca en `model/` |
| El parseo del catálogo de una tienda | `ingestion/adapters/<slug>.ts`. **Nunca en `src/`** |
| El cálculo del total de una lista | Vista SQL en servidor, consumida por `features/lists/api/` |
| El formateo de `$ 12.450` para mostrar | `shared/utils/` (función pura) |

## `src/` e `ingestion/` son dos mundos

`ingestion/` **no es la app**: corre en Deno (Edge Functions) o en Node (GitHub Actions), nunca
en el dispositivo. Reglas:

- La app **nunca** importa de `ingestion/`, salvo los tipos derivados de
  `ingestion/core/schemas.ts`.
- El pipeline **nunca** importa de `src/`.
- `SUPABASE_SERVICE_ROLE_KEY` solo existe en el lado de `ingestion/`. Si aparece en cualquier
  archivo bajo `src/`, es un incidente de seguridad, no un error de estilo.

Viven en el mismo repo únicamente porque comparten los schemas Zod del producto normalizado.
Ver [ADR-0003](../adr/0003-ingesta-centralizada.md).
