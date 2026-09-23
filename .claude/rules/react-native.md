---
paths:
  - "app/**/*.tsx"
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# Reglas — React Native / TypeScript

## Arquitectura

- Regla de dependencia: `app/ → src/features/ → src/shared/`. Nunca al revés, nunca entre features.
- Un feature se consume solo por su `index.ts`. No importar rutas internas de otro feature.
- Imports relativos únicamente dentro del mismo feature. `../../` hacia fuera = violación de capa.
- `app/` solo compone: traduce params de navegación a props de un componente de feature.
- `model/` es puro: sin React, sin red, sin `Platform.OS`, sin acceso a storage.

## TypeScript

- Sin `any`. Si es inevitable:
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <razón concreta>`.
- `unknown` requiere type guard o `.parse()` de Zod antes de usarse.
- Sin prefijo `I` en interfaces. `Product`, no `IProduct`.
- `as const` para objetos de configuración y factories de query keys.
- Tipos derivados (`Pick`, `Omit`, `z.infer`) antes que redefinir formas a mano.
- `src/shared/types/database.types.ts` es generado: no se edita a mano.
- Sin aserciones `as X` para silenciar al compilador. Si el tipo no encaja, el problema es el
  tipo o el dato, no el compilador.

## Componentes

- Function components con nombre. Sin `React.FC`.
- Props tipadas con `type` local exportada solo si la consume otro archivo.
- Un componente que hace fetch no recibe además 10 props de presentación: sepáralo
  (container / presentational).
- Toda vista con datos remotos resuelve **loading, error, empty y data**. El estado de error
  incluye acción de reintento.
- Listas: `FlashList` con `keyExtractor` de id estable. Nunca el índice del array.
- `renderItem` definido fuera del componente o con `useCallback`, y fila memoizada.

## Hooks

- Reglas de hooks sin excepciones; nada de llamadas condicionales.
- `useEffect` **no** es para traer datos. Datos remotos → TanStack Query.
  `useEffect` legítimo: suscripciones, listeners, sincronización con APIs externas.
- Todo `useEffect` con suscripción o listener devuelve función de limpieza.
- Dependencias completas y honestas. Si hay que "engañar" al array, el diseño está mal.
- Funciones usadas en deps se declaran antes del `useEffect`.
- Un hook por responsabilidad. `useProductScreen()` que hace nueve cosas no es un hook, es una
  pantalla mal partida.

## Específico de móvil

- `Platform.select` / archivos `.ios.tsx` / `.android.tsx` solo en la capa de UI.
- Todo acceso a API del sistema (cámara, ubicación, notificaciones, biometría, share, ficheros)
  pasa por un adapter en `shared/lib/`, con ruta degradada si el permiso se deniega.
- Suscripciones realtime y trabajo periódico se pausan en background y se reanudan en foreground.
- Sin `setInterval` para refrescar datos.
- Área táctil ≥ 44pt; usar `hitSlop` cuando el visual sea menor.
- El botón atrás de Android se gestiona explícitamente en pantallas con estado sin guardar.
- Animaciones y gestos con Reanimated worklets. `useSharedValue`, no `useState`.
  `runOnJS` solo al finalizar el gesto.

## Errores

- Errores tipados por capa (`RepositoryError`, `CartLimitError`), no strings.
- Prohibido el `catch` silencioso. Si no se puede manejar, se relanza o se reporta.
- Error boundary en root, por ruta y alrededor de widgets de terceros.
- Los errores asíncronos se manejan en el estado `error` de la query, no en error boundaries.
- Mensajes de usuario accionables y en español; logs técnicos en inglés.

## Comentarios y documentación

- Código y comentarios en **inglés**. `docs/` en español.
- JSDoc en la API pública de cada feature (`index.ts`) y en utilidades de `shared/`.
- Sin comentarios que repitan el código, sin "added for X flow", sin "fix issue #123" —
  eso va en el mensaje de commit.
- Sin código muerto, sin variables `_unused`, sin shims de compatibilidad hacia atrás:
  se borra.

## Limpieza

- Constantes con nombre en vez de números y strings mágicos.
- Early returns antes que anidar más de 2-3 niveles.
- DRY a partir de la **tercera** repetición, no de la segunda.
- Sin `console.log` en código que se mergea.
- Cada función hace completamente lo que su nombre dice. Nada de implementaciones a medias.
