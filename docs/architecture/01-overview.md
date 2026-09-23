# 01 — Visión general y capas

## Qué cambia respecto a web (Next/React)

Vienes de Next, Nest y Angular. La tentación es tratar RN como "React con otros tags". No lo es.
Estas son las diferencias que **obligan** a decisiones arquitectónicas distintas:

| Restricción del móvil | Consecuencia arquitectónica |
|---|---|
| El proceso puede ser **matado** por el SO en background sin aviso | El estado importante se persiste al escribirlo, no al salir. No hay `beforeunload`. |
| Conectividad **intermitente** (metro, ascensor, roaming) | Offline-first no es una feature: es el modo base. Caché + cola de mutaciones. |
| Memoria y CPU **limitadas y compartidas** | Listas virtualizadas siempre; imágenes dimensionadas; nada de cargar colecciones completas. |
| **Arranque en frío** medido por el usuario y por las stores | Lazy loading de rutas pesadas, splash controlado, trabajo diferido post-TTI. |
| La **batería** es un recurso del usuario | Polling prohibido por defecto; backoff exponencial; suscripciones realtime solo en foreground. |
| El **release tarda días** (revisión de store) | Feature flags y OTA para JS. Un bug nativo cuesta una semana. |
| Las **APIs del sistema requieren permiso** y pueden ser denegadas para siempre | Todo acceso a cámara/ubicación/notificaciones necesita ruta degradada. |
| El usuario **cambia de app** constantemente | `AppState` es parte del modelo: refetch al volver, pausar trabajo al salir. |
| Pantalla pequeña, **gestos**, teclado que tapa contenido | Safe areas, `KeyboardAvoidingView`/`keyboardAvoidingBehavior`, hit-slop ≥ 44pt. |
| **Dos plataformas** con comportamiento divergente | `Platform.select` en la capa de UI, nunca en la de dominio. |

> Si un diseño no responde "¿qué pasa sin red?", "¿qué pasa si el SO mata el proceso?" y
> "¿qué pasa si el permiso se deniega?", el diseño está incompleto.

## Capas y regla de dependencia

```
┌─────────────────────────────────────────────────────────────┐
│  app/                    rutas expo-router                   │
│  Solo composición: layout, params, guards, <Suspense>.       │
│  Prohibido: fetch, lógica de negocio, estilos complejos.     │
└───────────────────────────┬─────────────────────────────────┘
                            │ importa
┌───────────────────────────▼─────────────────────────────────┐
│  src/features/<feature>/                                     │
│  Una vertical completa: UI + hooks + acceso a datos + modelo │
│  Un feature NO importa de otro feature.                      │
└───────────────────────────┬─────────────────────────────────┘
                            │ importa
┌───────────────────────────▼─────────────────────────────────┐
│  src/shared/                                                 │
│  Design system, clientes (supabase/query/mmkv), utils, tipos │
│  NO conoce ningún feature. Cero imports hacia arriba.        │
└─────────────────────────────────────────────────────────────┘
```

**Regla de dependencia (única regla dura):** las flechas apuntan hacia abajo y nunca al revés.
`shared/` no importa de `features/`. `features/a` no importa de `features/b`.

### ¿Y si dos features necesitan lo mismo?

En orden de preferencia:

1. **Promover a `shared/`** — si es genuinamente genérico (un `<Money>`, un formateador).
2. **Extraer a un tercer feature** del que ambos dependan — si tiene modelo propio
   (p. ej. `features/auth` del que dependen `cart` y `profile`). Esta es la **única** excepción
   permitida al "feature no importa feature", y debe declararse en el README del feature.
3. **Comunicar por store o evento** — si es coordinación, no código compartido.

Duplicar dos veces está bien. Se extrae en la tercera repetición, no antes.

## Dentro de un feature

```
features/<name>/
├── api/         acceso a datos: queries, mutations, repositorio Supabase
├── model/       tipos, schemas Zod, reglas de negocio PURAS (sin React, sin red)
├── hooks/       lógica de presentación; compone api/ + model/ + store/
├── components/  UI del feature
├── store/       slice Zustand (solo si hay estado cliente que sobreviva a la pantalla)
└── index.ts     API pública del feature — lo único que app/ puede importar
```

`model/` es el corazón: funciones puras, testeables sin renderizar ni mockear red.
Si una regla de negocio necesita `useState` para existir, está en la capa equivocada.

### `index.ts` como frontera

Cada feature expone explícitamente qué es público:

```ts
// features/cart/index.ts
export { CartScreen } from './components/CartScreen'
export { useCart } from './hooks/useCart'
export type { CartItem } from './model/types'
// todo lo demás es privado del feature
```

Esto permite refactorizar el interior sin romper consumidores, y hace visible el acoplamiento
en el diff cuando alguien amplía la superficie pública.

## Flujo de una lectura, de punta a punta

```
Pantalla (app/(tabs)/products.tsx)
  └─ <ProductList />                        features/products/components
       └─ useProducts()                     features/products/hooks
            └─ useQuery({ queryKey, queryFn })   features/products/api
                 └─ productRepository.list()      features/products/api
                      └─ supabase.from('products')…   shared/lib/supabase
                           └─ Postgres + RLS
```

Cada capa puede sustituirse sin tocar las de arriba. El componente no sabe que existe Supabase;
sabe que existe `useProducts()`.

## Flujo de una escritura

```
Acción de UI
  └─ useCreateProduct()                     hook con useMutation
       ├─ validación Zod                    model/  (falla rápido, sin red)
       ├─ onMutate: update optimista        cache de TanStack Query
       ├─ productRepository.create()        api/
       └─ onError: rollback + toast | onSettled: invalidate
```

Detalle en [04-state-and-data.md](04-state-and-data.md).

## Cómo se sitúa esto frente a los estándares del mercado

Hay tres arquitecturas que aparecen una y otra vez en proyectos serios de React Native. Lo que
usamos aquí no es una cuarta: es **feature-first con regla de dependencia explícita**, que se
sitúa entre las dos primeras.

| Enfoque | Qué propone | Dónde domina |
|---|---|---|
| **Feature-first / modular** | Agrupar por vertical de producto; fronteras por módulo | El estándar de facto en React Native |
| **Feature-Sliced Design (FSD)** | Metodología formal: capas `app / pages / widgets / features / entities / shared`, cada una en slices y segments, con importación solo hacia abajo | Frontend web de equipos grandes; adopción creciente en RN |
| **Clean Architecture / MVVM** | `domain / application / infrastructure`, use cases y puertos-adaptadores; ViewModel por pantalla | Mobile nativo (Android, iOS); equipos que vienen de backend |

### Qué tomamos de cada uno

- **De feature-first:** la organización por vertical. Es lo que hace que un cambio de producto
  toque una carpeta y no seis.
- **De FSD:** la idea central, que es la que de verdad importa — **las capas se ordenan y las
  importaciones van en un solo sentido**. Nuestra regla `app/ → features/ → shared/` es FSD
  reducido a su esencia. Lo que **no** tomamos son sus capas intermedias (`widgets`, `entities`,
  `processes`) ni su vocabulario de slices y segments: con un solo desarrollador, esa ceremonia
  cuesta más de lo que ordena.
- **De Clean Architecture:** el núcleo puro. Nuestro `model/` es el `domain` de Clean: funciones
  sin React, sin red y sin plataforma. Lo que **no** tomamos son los use cases como clases, los
  puertos y adaptadores para todo, ni la inversión de dependencias ceremonial. Esta es una app
  cliente, no un monolito de dominio: el coste de indirección superaría al beneficio.

### Por qué esta combinación y no una de las tres puras

> *"La forma más rápida de arruinar un código base de React Native es confundir estructura de
> carpetas con arquitectura. Las carpetas te ayudan a orientarte. La arquitectura decide quién
> puede depender de quién."*

Esa distinción es la razón de que aquí solo haya **una regla dura** — la de dependencia — y que
todo lo demás sean convenciones. FSD completo y Clean ortodoxa aciertan en el principio y se
pasan en la ceremonia para un proyecto de este tamaño. Feature-first a secas acierta en el
tamaño y se queda corto en el principio: sin una regla explícita de quién importa a quién, los
features acaban importándose entre sí y en un año hay un grafo, no capas.

### El patrón de fondo del dominio

Más allá de la organización de carpetas, este proyecto tiene una forma reconocible:

```
   Catálogo (lectura)              Datos de usuario (escritura)
   decenas de miles de filas       docenas de filas
   escribe solo el pipeline        escribe solo el dueño
   cacheable agresivamente         debe persistir y sincronizar
```

Es una **separación de lectura y escritura** en el sentido de CQRS, y no es accidental: el
catálogo y las listas tienen dueños distintos, volúmenes distintos, políticas RLS distintas y
estrategias de caché distintas. Por eso `current_price` es una vista materializada y por eso la
app no tiene ninguna política de escritura sobre el catálogo.

El resto de patrones aplicados —Repository, fachada por hook, optimistic update, cola offline—
está catalogado en [03-patterns.md](03-patterns.md), cada uno atado al problema móvil concreto
que resuelve.

### Cuándo reabrir esta decisión

- **Si entra más gente al proyecto** y aparecen conflictos de propiedad sobre el código →
  evaluar FSD completo, cuyo vocabulario existe precisamente para coordinar equipos.
- **Si `features/` pasa de ~10 verticales** y empiezan a compartir demasiado → introducir una
  capa `entities/` entre `features/` y `shared/`.
- **Si la lógica de negocio crece** hasta necesitar orquestación entre varios repositorios →
  introducir use cases explícitos en `model/`.

Ninguna de las tres condiciones se cumple hoy. Adoptar la estructura por adelantado sería
pagar el coste sin recibir el beneficio.

## Qué NO hacemos

- ❌ **Clean Architecture ortodoxa** con `domain/application/infrastructure` y puertos/adaptadores
  para todo. Es una app cliente, no un monolito de dominio: el coste de indirección supera al
  beneficio. Nos quedamos con la regla de dependencia y `model/` puro.
- ❌ **Provider hell.** En `dashboard-front` hay 20 Context providers anidados en `layout.tsx` con
  orden significativo. En móvil eso es re-render global y arranque lento. Aquí el estado va a
  Zustand (suscripción granular) o a TanStack Query. Context se reserva para lo que de verdad es
  inyección de dependencias estática: tema, i18n, cliente de query.
- ❌ **Barrel files globales** (`src/index.ts` reexportando todo). Rompen tree-shaking y
  crean ciclos. Barrels solo a nivel de feature.
- ❌ **Estado global por defecto.** Si el estado no sobrevive a la pantalla, es `useState`.
