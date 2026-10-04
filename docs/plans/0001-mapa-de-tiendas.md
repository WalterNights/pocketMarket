# Plan 0001 — Mapa de tiendas con las más cercanas

**Estado:** ✅ implementado (2026-10-04) · **Complejidad:** alta · **¿OTA-able?:** no
**Escrito:** 2026-09-24 · **Aprobado:** 2026-10-04 (preguntas respondidas al final)

---

## Qué se pide

Un mapa que muestre **solo tiendas** — nunca productos — indique las más cercanas a la
ubicación de la persona, y admita cadenas nuevas en el futuro (Metro, Homecenter, Falabella).

## Resumen

Una tabla nueva de **sucursales** (`store_branch`) con coordenadas, una consulta que devuelve
las más cercanas a un punto, y una pantalla que pide la ubicación *cuando la abres*, no al
arrancar.

La decisión estructural: las sucursales son **catálogo público con su propio ritmo**. Los
precios cambian a diario; las sucursales casi nunca. Van por un pipeline aparte que corre una
vez al mes, no en el cron diario.

> **Implementado el 2026-10-04.** Queda: la carga mensual de sucursales en CI (necesita el
> Supabase remoto) y probar la navegación en la calle. El recorrido completo está en la
> [bitácora](../BITACORA.md); las decisiones nuevas, en [ADR-0006](../adr/0006-mapa-maplibre.md)
> (MapLibre) y [ADR-0007](../adr/0007-rutas-openrouteservice.md) (rutas y navegación).

## Actualización 2026-10-04 — lo que cambió desde que se escribió

- **Ya hay development build con EAS** (`guias/probar-avisos.md`), así que perder Expo Go dejó de
  ser el freno: el orden de pasos de abajo se mantiene por el dato, no por la build.
- **"Solo tiendas, ningún otro negocio"** tiene dos mitades: nuestros marcadores son solo
  sucursales de las cadenas, **y** el mapa base no muestra negocios (restaurantes, bancos…).
- **Proveedor: MapLibre + OpenFreeMap** ([ADR-0006](../adr/0006-mapa-maplibre.md)). Se empezó
  con Google Maps, pero exige una cuenta de facturación en Google Cloud que no hay. El estilo
  `positron` de OpenFreeMap **no tiene capa de negocios**, así que la segunda mitad sale de
  fábrica. Sin key, sin cuenta, mismo motor en Android e iOS.
- **Radio:** resuelto en la consulta: *las 30 más cercanas, nunca a más de 25 km*. Se adapta solo
  entre Bogotá y un pueblo, sin radio por ciudad.
- **Fuentes de sucursales** (investigadas con llamadas reales el 2026-10-04):

| Cadena | Fuente | Coste por corrida | Notas |
|---|---|---|---|
| Ara | `aratiendas.com/wp-json/map-ara/v1/stores` | 1 llamada | 1.657 tiendas, coordenadas como texto |
| Dollarcity | `dollarcity.com/ubicaciones/locations/GetDataByCoordinates` (POST) | ~10 llamadas | tope ~160 km por punto; GeoJSON `[lng, lat]` |
| Éxito | VTEX `www.exito.com/api/checkout/pub/pickup-points` | cuadrícula de ciudades | cada tienda sale con dos ids (`1_ptorecogida_0094` / `exitocol094_…`): se unifican por el número |
| D1 | VTEX `www.d1.com.co/api/checkout/pub/pickup-points` | cientos de llamadas | tope de 300 por punto: cuadrícula densa en ciudades grandes |

  Descartados: Google Places (cobra y prohíbe guardar resultados) y OpenStreetMap como fuente
  principal (cubre el 25–30 %).

## La restricción que decide el orden de todo

Hoy se prueba en Expo Go. **Ninguna librería de mapas funciona ahí** — ni `react-native-maps`
ni `expo-maps`. En cuanto se añada una, Expo Go deja de abrir el proyecto y hace falta un
*development build* instalado por EAS. Es un cambio de flujo de trabajo, no un detalle.

| | Expo Go (hoy) | Development build |
|---|---|---|
| Instalar | escanear QR | `eas build` e instalar el binario una vez |
| Cambios JS | recarga inmediata | igual de inmediata |
| Añadir librería nativa | imposible | build nueva (~15 min) |
| Splash crema propio | no se ve | se ve |

Por eso el plan **separa los datos del mapa**: los pasos 1–4 son SQL y datos, se verifican sin
tocar la app y no quitan Expo Go. Solo el paso 5 obliga al dev build.

## Decisiones de diseño

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Tabla `store_branch` separada de `store` | Añadir lat/lng a `store` | `store` es la cadena (una fila), no el local. Éxito tiene ~250 |
| PostGIS `geography` + índice GiST | Haversine a mano sobre lat/lng | `ST_DWithin` usa el índice; el haversine escanea la tabla entera |
| La consulta devuelve solo lo cercano (radio + tope) | Traer todas y filtrar en el cliente | ~4.000 sucursales en el país. 4.000 marcadores matan el mapa |
| Pipeline mensual aparte | Meterlo en el cron diario | Un local no se muda cada noche; sería tráfico y escrituras inútiles |
| La vista devuelve `store_slug` y `store_name` resueltos | Que el feature del mapa importe de `catalog` | Evita que un feature importe de otro (regla 1) |
| Permiso al tocar "ver cercanas" | Pedirlo al abrir el mapa | En iOS la negativa es casi definitiva; el mapa debe servir sin permiso |

## Las siete preguntas móviles

1. **Sin red** — La lista de sucursales es pequeña y estable: caché con `staleTime` largo y
   persistencia. Sin red no hay teselas, así que la ruta degradada es **la lista**, con
   distancias calculadas en el dispositivo sobre la caché. El mapa nunca es el único camino al
   dato.
2. **Proceso matado** — Nada que persistir salvo la caché de la query. La ubicación **no se
   guarda**: se vuelve a pedir. Dónde estuvo alguien es un dato sensible que esta app no
   necesita.
3. **Permisos** — `expo-location`, **solo primer plano**
   (`requestForegroundPermissionsAsync`). Se pide al tocar "las más cercanas", con una frase
   previa que explica para qué. Denegado: el mapa sigue abriendo y aparece un selector de
   ciudad sobre la tabla `region` que ya existe. Nunca ubicación en segundo plano.
4. **RLS** — `store_branch` es catálogo: lectura pública para `anon` y `authenticated`, **sin
   política de escritura** (solo `service_role`). Igual que `store_product`, con su test de
   acceso denegado.
5. **Rendimiento** — El riesgo es el número de marcadores: radio acotado y tope desde la
   consulta. La ruta del mapa se carga perezosa — una vista nativa de mapa montada de fondo
   consume aunque no se mire. Precisión `Balanced`, no `High`: para "qué tienda me queda cerca"
   sobra, y `High` enciende el GPS.
6. **Background → foreground** — Una lectura al abrir, y otra al volver **solo si el mapa está
   visible** y la anterior ya es vieja. Nada de `watchPositionAsync`: eso es GPS continuo. *Excepción posterior:* durante una
   navegación activa sí, con sus límites ([ADR-0007](../adr/0007-rutas-openrouteservice.md)).
7. **OTA** — **No.** Dos módulos nativos nuevos. Es el fallo más caro del stack: servir JS que
   usa un módulo nativo ausente **crashea al arrancar** y el usuario no puede ni actualizar.
   `runtimeVersion: fingerprint` cubre esto, pero el orden importa: primero la build, después
   el JS.

## Archivos

**Migraciones**
- [ ] `<fecha>_store_branches.sql` — extensión PostGIS; tabla `store_branch` (`store_id`,
      código externo, nombre, dirección, ciudad, `region_code`,
      `location geography(Point,4326)`, `is_active`); índice GiST; RLS de solo lectura;
      función `nearest_branches(lat, lng, radius_m, limit)`; vista `branch_public` con
      `store_slug` / `store_name` denormalizados

**Ingesta**
- [ ] `ingestion/core/branch-types.ts` — interfaz `BranchAdapter` (otra forma que
      `StoreAdapter`: no hay precios ni snapshots)
- [ ] `ingestion/adapters/exito-branches.ts` — Éxito es VTEX y VTEX expone *pickup points*;
      **hay que confirmarlo** antes de darlo por hecho
- [ ] `ingestion/runners/node/branches.ts`
- [ ] `.github/workflows/branches.yml` — **mensual**, no diario

**App**
- [ ] `src/features/branches/model/branch.ts` — tipo, schema Zod y `distanceLabel()` puro
      (1,2 km / 850 m)
- [ ] `src/features/branches/api/branch-repository.ts` + `keys.ts`
- [ ] `src/features/branches/hooks/useNearestBranches.ts`
- [ ] `src/features/branches/components/StoreMapScreen.tsx` — los cuatro estados, más el
      quinto propio de esto: **permiso denegado**
- [ ] `src/features/branches/components/BranchList.tsx` — la ruta degradada, y lo que se ve
      sin red
- [ ] `src/features/branches/index.ts`
- [ ] `src/shared/lib/location.ts` — adapter del permiso y la lectura (regla: todo acceso al
      SO pasa por un adapter en `shared/lib`)
- [ ] `app/map.tsx` — ruta, solo composición

**Modificar**
- [ ] `app.config.ts` — plugin de ubicación y la cadena `NSLocationWhenInUseUsageDescription`
      describiendo el uso real
- [ ] `package.json` — dependencias nuevas, **pasando por `vet-dependency` antes**

## Orden de implementación

1. **Migración + datos de una ciudad a mano** — verificable con
   `select * from nearest_branches(...)` en psql. Sin app, sin mapa, sin build.
2. **Test de RLS** — `pnpm run db:test` en verde.
3. **Adaptador de Éxito y su fixture** — verificable con los tests, sin red.
4. **Lista de sucursales cercanas, sin mapa** — pantalla de texto con distancias. Esto **sí
   funciona en Expo Go** y valida el dato de punta a punta.
5. **Dev build y el mapa encima** — la vista de mapa reemplaza a la lista; la lista se queda
   como estado degradado.

Los cuatro primeros pasos no quitan Expo Go. Al llegar al quinto ya se sabe que los datos son
correctos, que es donde de verdad se pierde el tiempo.

## Tests

- **Unidad**: `distanceLabel()` (metros vs km, redondeo), orden por distancia, coordenada
  ausente
- **RLS**: `anon` lee sucursales; `anon` y `authenticated` **no** pueden insertar ni actualizar
- **Componente**: los cuatro estados, más permiso denegado y sin resultados en el radio
- **Ingesta**: `normalize()` contra fixture real; descarte de sucursal sin coordenadas

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Que la fuente de sucursales no exista o no sea pública | Es lo primero a verificar. El paso 1 admite carga manual: con ~250 Éxitos se puede empezar a mano |
| Miles de marcadores congelando el mapa | Radio y tope desde la consulta, no desde el cliente |
| Pedir ubicación y que la nieguen | El mapa funciona sin ella; selector de ciudad sobre `region` |
| Quedarse sin Expo Go a mitad de camino | El orden de arriba lo aplaza hasta el último paso |
| Coordenada a la deriva de la fuente | Descartar lo que caiga fuera de Colombia, igual que se descartan precios absurdos |

## Fuera de alcance

- Navegación paso a paso: se delega en Google Maps / Waze. (Dibujar la ruta en nuestro mapa
  entró después: [ADR-0007](../adr/0007-rutas-openrouteservice.md).)
- Horarios de apertura.
- Filtrar el catálogo por sucursal concreta: los precios son por región, no por local.

## Preguntas — respondidas el 2026-10-04

1. **Cadenas:** las 4 del proyecto (Éxito, D1, Dollarcity, Ara). Las que aún no tienen catálogo
   aparecen con "Precios próximamente" (`has_prices` en la consulta).
2. **Acceso:** botón de mapa en la cabecera de Tiendas, pantalla propia (`app/map.tsx`). Sin
   barra de pestañas.
3. **Radio:** adaptable por construcción (ver arriba).

### Preguntas originales

1. **Homecenter y Falabella no son mercado.** Metro sí (es del Grupo Éxito). Si el mapa las
   muestra, alguien tocará una y llegará a un catálogo vacío. ¿Se muestran igual marcadas como
   "sin precios aún", o el mapa enseña solo las cadenas de las que sí hay precios?
2. **¿Pantalla propia o pestaña?** Hoy no hay barra de pestañas. Un mapa suele vivir en una,
   pero eso reestructura la navegación entera.
3. **¿Radio fijo o adaptable?** En Bogotá 5 km trae decenas; en un pueblo, ninguna. Lo sensato
   es ampliar el radio hasta encontrar un mínimo, pero conviene decidirlo.
