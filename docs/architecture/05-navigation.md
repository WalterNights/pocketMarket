# 05 — Navegación

`expo-router` v4: enrutado por ficheros sobre React Navigation, con las convenciones del App
Router de Next. Lo que ya sabes de Next aplica; lo que cambia es que aquí **la navegación tiene
memoria y pila**, y el sistema operativo participa en ella.

## Convenciones de fichero

| Fichero | Significado |
|---|---|
| `app/index.tsx` | Ruta `/` |
| `app/product/[id].tsx` | Ruta dinámica `/product/123` |
| `app/product/[...rest].tsx` | Catch-all |
| `app/(tabs)/_layout.tsx` | Layout de grupo; el paréntesis **no** aparece en la URL |
| `app/_layout.tsx` | Layout raíz: providers, fuentes, splash |
| `app/+not-found.tsx` | 404 |
| `app/+native-intent.ts` | Normaliza deep links entrantes antes de resolver la ruta |

Los **grupos** `(auth)` y `(tabs)` son la herramienta principal: separan áreas con layout y
reglas de acceso distintas sin ensuciar la URL.

## Guard de sesión

> **En este proyecto** ([ADR-0005](../adr/0005-autenticacion.md)) el catálogo es público y
> solo están detrás del guard las rutas de `app/(private)/` (mis listas, cuenta). El grupo
> `(auth)` tiene inicio de sesión y registro. Al redirigir a login se pasa `redirectTo`, que se
> valida con Zod como ruta interna antes de usarla: nunca un `//host` ni un esquema externo.

El guard va en el `_layout.tsx` del grupo, no en cada pantalla:

```tsx
// app/(tabs)/_layout.tsx
export default function TabsLayout() {
  const { status } = useSession()

  if (status === 'loading') return <SplashKeeper />      // no parpadear hacia login
  if (status === 'signed-out') return <Redirect href="/(auth)/sign-in" />

  return <Tabs>{/* ... */}</Tabs>
}
```

El estado `loading` importa: leer la sesión de SecureStore es asíncrono. Sin ese tercer estado,
todo usuario autenticado ve un destello de la pantalla de login en cada arranque.

Simétricamente, `(auth)/_layout.tsx` redirige a la app si ya hay sesión, para que el botón
"atrás" no devuelva al login tras entrar.

## Parámetros: qué viaja por la URL

```tsx
router.push(`/product/${id}`)                       // identidad → URL
router.push({ pathname: '/search', params: { q } }) // estado compartible → URL
```

- **Sí por URL:** identificadores, filtros, pestaña activa, cualquier cosa que quieras que
  funcione como deep link o sobreviva a un cold start.
- **No por URL:** objetos completos. Pasar el producto serializado para "ahorrar un fetch"
  rompe el deep link (`/product/123` abierto desde fuera no trae el objeto) y muestra datos
  rancios. Pasa el `id` y deja que la query sirva del caché — es instantáneo si está cacheado.

`useLocalSearchParams` devuelve `string | string[]`. Valídalo con Zod, no lo castees: un deep
link es entrada externa no confiable.

## Deep links y universal links

Configurados en `app.config.ts` (`scheme`, `associatedDomains` en iOS, `intentFilters` en Android).

Tres exigencias, todas verificables en review:

1. **Validar todo parámetro entrante.** Un deep link lo construye cualquiera.
2. **Nunca ejecutar una acción con efecto desde un link.** `pocketmarket://delete-account` o
   un link que confirme un pago es una vulnerabilidad. Un deep link **navega**; el usuario
   confirma.
3. **Resolver el estado de sesión antes de navegar.** Un link a una pantalla privada con la app
   cerrada debe llevar a login y **retomar el destino** después (guardar el `redirectTo`).

## Navegación y datos

Precarga al intención, no al montar:

```tsx
<Pressable
  onPressIn={() => queryClient.prefetchQuery(productQuery(id))}
  onPress={() => router.push(`/product/${id}`)}
/>
```

Los ~120 ms entre `onPressIn` y la transición suelen bastar para que la pantalla destino abra
con datos ya en caché.

## Modales y hojas

```tsx
// app/_layout.tsx
<Stack>
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="filters" options={{ presentation: 'modal' }} />
</Stack>
```

Usar `presentation: 'modal'` / `formSheet` en vez de un `<Modal>` manual: el router mantiene la
pila coherente, el gesto de cierre nativo funciona y el botón atrás de Android hace lo esperado.

## Botón atrás de Android

No es opcional. En cada pantalla que capture el retroceso (formulario con cambios sin guardar,
flujo de varios pasos) hay que gestionarlo explícitamente; si no, Android sale de la app y el
usuario pierde el trabajo.

## Reglas

- ❌ Nada de lógica de negocio ni fetch en ficheros de `app/`.
- ❌ No navegar con strings sueltos repartidos por el código: centraliza las rutas en un módulo
  de `shared/config/routes.ts` o usa rutas tipadas.
- ✅ `router.replace()` tras login y tras logout, para no dejar pantallas huérfanas en la pila.
- ✅ Toda pantalla accesible por deep link debe poder montarse **sin** estado previo en memoria.
- ✅ Precargar fuentes y sesión antes de ocultar el splash (`SplashScreen.preventAutoHideAsync()`).
