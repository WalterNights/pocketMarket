# ADR-0007: Rutas en el mapa con OpenRouteService, detrás de una Edge Function

- **Fecha:** 2026-10-04
- **Estado:** Aceptada

## Contexto

Al tocar una tienda, la tarjeta ofrecía Google Maps y Waze, que **abren otra app**. Se pide ver la
ruta **dibujada en nuestro mapa**, con su tiempo. El plan 0001 dejaba las rutas fuera de alcance;
esto lo amplía a *mostrar* la ruta y, después, a *seguirla* dentro de la app (ver "Navegación en
vivo" abajo). No hay indicaciones giro a giro: el mapa sigue al usuario y muestra tiempo y
distancia restantes.

MapLibre dibuja una línea sin problema ([ADR-0006](0006-mapa-maplibre.md)). Lo que falta es quién
la calcula, y cualquier servicio de rutas es un tercero.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| A. **OpenRouteService** vía Edge Function | Gratis con cuenta, **sin tarjeta** (~2.000 rutas/día); a pie y en carro; datos OSM | Una cuenta y una key más; cupo diario compartido por todos los usuarios |
| B. OSRM público (`router.project-osrm.org`) | Sin cuenta | Política de servidor de demostración: no apto para una app publicada |
| C. GraphHopper / Mapbox | Buenos planes gratis | Key, y algunos piden tarjeta |
| D. Llamar a ORS desde la app con la key en el bundle | Sin servidor | La key sería pública: cualquiera agota el cupo (08-security) |

## Decisión

**A.** La app llama a la Edge Function `route` (`supabase/functions/route`), que llama a
OpenRouteService con la key guardada como secreto de la función.

- **La key nunca entra en la app.** Todo lo del bundle es público (08-security, "Claves de API de
  terceros con coste → Edge Function que hace de proxy"). El cupo es el coste aquí.
- **La función valida antes de gastar cupo**: puntos dentro de Colombia, distancia en línea recta
  ≤ 30 km (las tiendas se buscan a ≤ 25 km), modo `foot` | `car`. Lo inválido responde 400 sin
  llamar a ORS.
- **Solo desde la ubicación del dispositivo.** Una ruta desde "el centro de Bogotá" no le sirve a
  nadie; con ciudad elegida la tarjeta lo explica.
- **Caché de 10 minutos** por (origen exacto, tienda, modo) y sin reintentos ante errores que
  darían la misma respuesta (`invalid`, `no_route`, `out_of_range`, `quota`, `unavailable`): cada
  intento cuesta cupo. El origen **no se redondea**: un recálculo sale a pocos metros del origen
  anterior y, redondeado, devolvería de la caché la misma ruta que el usuario acaba de dejar.
- **Tiempos límite**: la función corta la llamada a ORS a los 10 s (→ 503 `unavailable`) y la app
  la suya a los 15 s; la petición se cancela si la pantalla ya no la necesita.
- **Logs sin coordenadas**: la función registra solo el estado HTTP y el código numérico de error
  de ORS, nunca el cuerpo de la respuesta, que puede citar la ubicación del usuario.
- **Modo por defecto**: a pie si la tienda está a menos de 1,5 km, en vehículo si no; ambos se
  ofrecen en la tarjeta ("Ir a pie" / "Ir en vehículo").

### Navegación en vivo (2026-10-04)

El usuario pidió seguir la ruta **dentro de la app**, sin Google Maps ni Waze, con el tiempo y la
distancia restantes actualizándose. Eso exige **GPS continuo**, que el plan 0001 prohibía. Se
permite con condiciones que conservan el motivo de la prohibición (batería y privacidad):

- **Solo durante un viaje**: empieza al elegir "Ir a pie" / "Ir en vehículo" y se detiene al
  llegar (≤ 30 m), al "Cancelar ruta", al salir del mapa o **al pasar a segundo plano**. Nunca
  ubicación en segundo plano. Sigue sin guardarse nada (`shared/lib/location.ts → watch`).
- **El progreso se calcula en el teléfono** proyectando cada posición sobre la ruta ya trazada
  (`model/navigation.ts`). Pedir la ruta en cada lectura agotaría el cupo diario en minutos.
- **Recalcular** solo tras 3 lecturas seguidas a más de 50 m de la línea, y como mucho una vez
  cada 30 s. Mientras se recalcula, **y si el recálculo falla**, se sigue dibujando y siguiendo la
  última ruta buena del viaje; el panel ofrece "Reintentar".
- **La llegada se mide contra la tienda** (≤ 30 m en línea recta), no contra el final de la ruta:
  funciona aunque no haya ruta o el recálculo haya fallado.
- **Cámara**: la ruta se encuadra entera una sola vez por viaje; después el mapa sigue al usuario.
  Si el usuario mueve el mapa, deja de seguirlo hasta que pulse "Centrar".
- **Pantalla**: al iniciar, el mapa ocupa todo; la lista, la barra de origen y la tarjeta se
  ocultan y queda un panel con el tiempo y la distancia restantes y "Cancelar ruta".
- **Ya no se abren apps externas**: se quitaron Google Maps y Waze de la tarjeta y de la lista.
- **No se pide ruta por mirar**: la ruta solo se solicita al iniciar un viaje, nunca al tocar una
  tienda, así que explorar el mapa no gasta cupo.

## Consecuencias

- **Positivas:** la ruta se ve sin salir de la app; ningún secreto en el bundle; el modelo
  (`model/route.ts`) es puro y tiene tests.
- **Negativas:**
  - El cupo gratuito (~2.000/día) es **de toda la app**, no por usuario. Si se agota, el panel
    lo dice; ya no hay una alternativa externa dentro de la app.
  - Sin límite por usuario todavía: alguien con la clave anon podría gastar el cupo. Aceptado en
    esta fase; si pasa, añadir límite por IP/usuario en la función.
  - En desarrollo hay que servir las funciones (`pnpm run functions`) además de `db:start`.
- **Qué invalidaría esta decisión:** agotar el cupo de forma habitual (salida: plan de pago de ORS
  o un OSRM/Valhalla propio), o que ORS cambie su plan gratuito.

## Puesta en marcha

1. Cuenta en <https://openrouteservice.org/dev/#/signup> (gratis, sin tarjeta) → *Dashboard* →
   *Tokens* → crear una key *Standard*.
2. **Local:** pegarla en `supabase/functions/.env` (no se versiona):
   `ORS_API_KEY=<key>` y servir con `pnpm run functions`.
3. **Remoto** (cuando exista el proyecto): `pnpm exec supabase secrets set ORS_API_KEY=<key>` y
   `pnpm exec supabase functions deploy route`.
