# ADR-0006: MapLibre + OpenFreeMap para el mapa de tiendas

- **Fecha:** 2026-10-04
- **Estado:** Aceptada

## Contexto

El mapa de tiendas ([plan 0001](../plans/0001-mapa-de-tiendas.md)) se planteó con
`react-native-maps`: Google Maps en Android y Apple Maps en iOS. En Android eso exige una API key
de un proyecto de Google Cloud **con cuenta de facturación activa**, aunque el mapa móvil no se
cobre. No hay cuenta de facturación disponible, y no se quiere mantener una relación con Google
Cloud solo para esto.

Requisitos que no cambian: solo nuestras cadenas en el mapa, **ningún otro negocio** del mapa
base; Android e iOS; New Architecture (RN 0.86, Expo SDK 57); development build con EAS.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| A. `react-native-maps` (Google en Android) | Mapa conocido; React views como marcadores | Exige facturación en Google Cloud; dos motores distintos (Google/Apple); ocultar negocios depende de cada uno |
| B. **MapLibre RN 11 + OpenFreeMap** | Sin key, sin cuenta, sin facturación, uso comercial permitido; el estilo `positron` **no tiene capa de negocios**; mismo motor en Android e iOS | Sin SLA del servidor de teselas; librería menos conocida; issues abiertos en Android |
| C. Teselas raster de openstreetmap.org | Gratis | Su política prohíbe el uso intensivo desde apps |
| D. Solo lista, sin mapa | Cero dependencias | No es lo pedido |

## Decisión

**B.** `@maplibre/maplibre-react-native@11.4.0` con el estilo
`https://tiles.openfreemap.org/styles/positron`.

- La v11 es estable (abril 2026), solo New Architecture, `react-native >= 0.80`, `expo >= 54`, y
  trae config plugin. Sin scripts de instalación ni advisories. Se fija **11.4.0** y no 11.4.1
  porque esta tenía 3 días y la cuarentena de `minimumReleaseAge` es de 7: no se salta la defensa
  por una versión de parche.
- **"Ningún otro negocio" sale de fábrica**: `positron` no tiene el `source-layer` `poi`
  (verificado contra el estilo publicado el 2026-10-04). No hay estilo que mantener para
  ocultarlos.
- Las tiendas se dibujan como **una capa GeoJSON** (círculos + etiqueta), no como un marcador por
  tienda: la GPU dibuja decenas sin coste y se esquiva maplibre#1618 (en Android el toque de un
  `Marker` también dispara el del mapa).
- La posición del usuario es **una lectura** de `expo-location` dibujada como capa propia. No se
  usa `UserLocation` de MapLibre: sigue el GPS de forma continua (el plan lo prohíbe) y tiene
  issues abiertos en Android (#1621 redibuja cada frame, #1697 crash tras recarga en desarrollo).

## Consecuencias

- **Positivas:** nada que configurar en Google; el mismo mapa en ambas plataformas; el requisito
  de "solo tiendas" lo cumple el estilo base; la key ya no existe, así que no hay nada que filtrar.
- **Negativas:**
  - OpenFreeMap no garantiza disponibilidad ("may discontinue it at any time"). Si cae, el mapa
    sale vacío **pero la lista sigue funcionando**: el dato nunca depende solo del mapa.
  - Atribución obligatoria: *© OpenMapTiles · Data from OpenStreetMap*. Se deja activa la
    atribución del componente (`attribution`), que la toma de las teselas.
  - Las teselas llegan hasta zoom 14 y se estiran por encima: suficiente para ver una calle.
  - Coste de tamaño del binario no documentado: medirlo en la build.
- **Qué invalidaría esta decisión:** que OpenFreeMap deje de responder de forma recurrente (salida:
  autoalojar teselas o un proveedor con plan gratuito con key), o que MapLibre RN abandone el
  soporte de la versión de RN que usemos.
