# Estado del proyecto

> Foto de dónde está Pocket Market **hoy**. Se actualiza al terminar cada sesión de trabajo.
> Para las reglas permanentes, ver [CLAUDE.md](../CLAUDE.md); para el porqué de cada decisión,
> [`docs/adr/`](adr/); para **cómo se llegó aquí**, sesión a sesión, la [BITACORA](BITACORA.md).

**Última actualización:** 2026-10-05 · rama `main` · **plan 0003 implementado, sin commitear**

---

## En una frase

La app lee un catálogo real de **cuatro cadenas** (Éxito, Olímpica, Supermú y D1: unos 32.000
productos con precio) desde Supabase local. La lista de inicio muestra **las cadenas con tienda
cerca** del usuario. Con cuenta, **guarda listas, las edita y les pone avisos**. En un **mapa**
ve las tiendas de las 11 cadenas que conocemos y puede **navegar hasta una** dentro de la app, a
pie o en vehículo. Se prueba con un **development build** de EAS, no con Expo Go.

---

## Qué funciona

### Ingesta (`ingestion/`)

Corre fuera del dispositivo y es lo único que escribe el catálogo.

| Pieza | Estado |
|---|---|
| Precios de Éxito, D1 y Olímpica (API VTEX pública, un adaptador genérico) | ✅ |
| Precios de Supermú (Shopify) | ✅ |
| Pipeline: fetch → normalize → validate → upsert → diff → append → publish | ✅ |
| Clasificador a taxonomía colombiana (39 categorías) | ✅ ver abajo |
| Reclasificar sin volver a la fuente (`pnpm run reclassify`) | ✅ |
| Sucursales de 11 cadenas (`pnpm run branches`) | ✅ D1 2.325 · Ara 1.657 · Dollarcity 421 · Éxito 154 · Ísimo 137 · Olímpica 73 · Jumbo 59 · Carulla 44 · Supermú 14 · La Vaquita Express 8 · Mercado Madrid 2 |
| Precios de Jumbo y Carulla | 🟡 misma API VTEX; esperan por espacio ([ADR-0008](adr/0008-cadenas-del-mvp.md)) |
| Precios de Dollarcity | ❌ **no tiene catálogo online** |
| Precios de Ara | ❌ **no tiene catálogo online** — solo folletos. Ya se investigó |
| Cron diario de precios | ❌ **pendiente** — [plan 0002](plans/0002-cron-de-ingesta-diaria.md) |
| Carga mensual de sucursales en CI | 🟡 workflow `branches.yml` listo, en manual hasta tener Supabase remoto |

**Últimas corridas de precios** (0% ilegibles en todas):

| Cadena | Vistos | Escritos |
|---|---|---|
| Éxito (74 subcategorías) | 49.859 | 15.265 (el 69% restante está agotado) |
| Olímpica | 12.083 | 12.080 |
| Supermú | 7.615 | 5.772 (el resto es licor, cuidado personal y hogar: fuera de mercado) |
| D1 | 1.182 | 1.145 |

**Ísimo en el mapa:** solo 137 de sus 310 tiendas. Publica direcciones sin coordenadas y se
geocodifican; las que no se ubican con seguridad se descartan en vez de adivinarlas.

### Base de datos (`supabase/`)

20 migraciones. RLS en todas las tablas; **95 tests pgTAP** en verde. La base local pesa
**80 MB** con las cuatro cadenas (límite del plan gratuito: 500 MB).

Dos mundos con reglas distintas: **catálogo** (precios, sucursales — lectura pública, escribe solo
`service_role`) y **datos de usuario** (listas, avisos — solo el dueño). La ausencia de política de
escritura en el catálogo *es* la protección.

Edge Function `route` (rutas del mapa): valida y llama a OpenRouteService con su key guardada
como secreto, nunca en la app ([ADR-0007](adr/0007-rutas-openrouteservice.md)).

### App (`src/`, `app/`)

| Pantalla | Estado |
|---|---|
| Lista de tiendas por cercanía (ubicación o ciudad; sin ninguna, todas) | 🟡 **sin probar en el teléfono** |
| Tiendas → categorías → productos, con scroll infinito | ✅ |
| Búsqueda mientras se escribe (por comienzo de palabra, sin tildes) | ✅ comprobada contra la base; 🟡 sin probar en el teléfono |
| Hoja de producto: cantidad y presentación (cartón, docena, panal…) | ✅ |
| Borrador con total por tienda | ✅ en memoria (se pierde al cerrar la app) |
| Inicio de sesión y registro (email + contraseña) | ✅ [ADR-0005](adr/0005-autenticacion.md) |
| Guardar lista, "Mis listas" con total de hoy y variación, editar | ✅ totales en servidor |
| Avisos semanal / quincenal / mensual | ✅ se guardan y reconcilian — 🟡 **falta oírlos sonar** en el development build |
| Mapa de tiendas cercanas, sin otros negocios | ✅ MapLibre + OpenFreeMap ([ADR-0006](adr/0006-mapa-maplibre.md)), probado |
| Ruta dibujada a pie / en vehículo | ✅ probado en el teléfono |
| Navegación en vivo (tiempo restante, recálculo, llegada) | 🟡 **sin probar caminando** |

**Tests:** 647 de Jest (modelo puro, ingesta, utilidades y el primer test de componente) + 95
pgTAP. `pnpm run quality` en
verde. Revisión general de código hecha el 2026-10-05 ([bitácora](BITACORA.md)).

---

## Qué NO funciona todavía, y por qué importa

1. **Solo Supabase local.** No hay proyecto remoto. Sin él no hay cron de precios, ni carga
   mensual de sucursales, ni versión que se pueda instalar fuera de la red de casa.
2. **Los precios no se actualizan solos** (plan 0002): la variación "subió $X" de las listas se
   queda en cero mientras no haya corridas nuevas.
3. **El borrador se pierde al cerrar la app.** Ya hay development build, así que MMKV es viable;
   falta hacerlo.
4. **Sin error boundary en la raíz.** Un error de render deja la pantalla en blanco.
5. **Un solo test de componente** (la lista de tiendas). El entorno ya funciona; faltan las
   demás pantallas.
6. **OpenFreeMap no garantiza disponibilidad** y el cupo de OpenRouteService (~2.000 rutas/día)
   es de toda la app. Si alguno falla, la lista de tiendas sigue funcionando.

---

## Decisiones tomadas que conviene no volver a discutir

Están en los ADR, pero estas son las que más veces han vuelto a surgir:

- **No es una app de compra.** Ni pago, ni pedido, ni entrega. Calculadora de presupuesto.
- **shadcn/ui no funciona en React Native.** Se usa React Native Reusables, copiado a
  `shared/ui/`.
- **Dinero en `integer` COP.** El peso no usa centavos y los flotantes pierden dinero.
- **Nunca borrar un `store_product`.** Hay `list_item` apuntando: se marca `is_available`.
- **Los totales de una lista guardada se calculan en servidor.** El borrador es la excepción.
- **Taxonomía colombiana, no "víveres y abarrotes".**
- **El mapa no usa Google** ([ADR-0006](adr/0006-mapa-maplibre.md)): exige facturación. MapLibre
  + OpenFreeMap, cuyo estilo ya no trae negocios.
- **Ninguna key de terceros va en la app** ([ADR-0007](adr/0007-rutas-openrouteservice.md)): pasa
  por una Edge Function.
- **GPS continuo solo durante una navegación activa**, nunca en segundo plano, nunca guardado.
- **pnpm exclusivamente**, y toda dependencia nueva pasa por `vet-dependency` y por la cuarentena
  de 7 días.

---

## El clasificador, que es donde más se ha iterado

`ingestion/core/classify.ts` decide en qué pasillo va cada producto. En orden:

1. **Pasillos con autoridad** — si la fuente dice `mascotas`, es de mascotas (`ING-008`).
2. **Se borran los modificadores** — `sabor [a] X` y `relleno de X` dicen a qué sabe, no qué es.
3. **Excepciones** — la leche en polvo SÍ es leche, aunque "en polvo" suela ser condimento.
4. **Forma** — mermelada, en lata, en polvo, embutido. La presentación manda sobre el
   ingrediente.
5. **Ingrediente** — lo evidente.
6. **Frescos, con llave** — fruta y verdura **solo** si la fuente dice pasillo de frutas y
   verduras.

Reglas por **palabra entera** con plural; las raíces se marcan con `*` (`ING-006`).

**Para arreglar una mala clasificación:** añadir la regla y su test, y `pnpm run reclassify`.

---

## Siguiente paso sugerido

1. **Probar el plan 0003 en el teléfono** y hacer el commit:
   - con ciudad Bogotá no sale Supermú; con Medellín sí;
   - sin ubicación ni ciudad se ven todas las cadenas;
   - la ciudad elegida se recuerda al reabrir;
   - D1, Olímpica y Supermú abren con productos.
2. **Probar en la calle** la navegación en vivo y **oír sonar un aviso**
   ([guias/probar-avisos.md](guias/probar-avisos.md)).
3. **Publicar**: los pasos y lo que falta están en
   [guias/publicar-android.md](guias/publicar-android.md). El primer hito es un APK que funcione
   fuera de casa.
4. **Proyecto remoto de Supabase** y, antes de usarlo, la **retención de precios**: con cuatro
   cadenas es requisito ([ADR-0008](adr/0008-cadenas-del-mvp.md)).
5. **Cron diario de precios** ([plan 0002](plans/0002-cron-de-ingesta-diaria.md)).
6. **Borrador persistente con MMKV** y error boundary en la raíz.
7. **Eliminar la cuenta desde la app**: Google Play lo exige.

### Deuda pequeña del plan 0003

- **101 productos del Éxito quedaron sin precio** en la carga del 2026-10-05: un precio
  imposible de la fuente tumbó su lote (`ING-014`, ya corregido). Se llenan solos en la
  siguiente corrida del Éxito.
- D1, Olímpica y Supermú se cargaron antes del último ajuste de medidas: unos 120 combos y
  multipacks conservan una medida por unidad hasta su siguiente corrida.

- El reporte de precios dice "saltados" sin desglosar el motivo (agotado, fuera de mercado, sin
  pasillo). El de sucursales ya lo desglosa.
- "Ver todas" se respeta durante la sesión, pero no entre aperturas.
- Un pasillo VTEX que llegue al tope de 2.500 productos ahora marca la corrida como incompleta:
  si pasa, hay que partirlo en subcategorías (como la Despensa de Olímpica).

### Decisiones pendientes del usuario

- **Comida preparada** (empanadas, lasaña, raviolis, tamal, sándwich) sale en Pollo: ¿categoría
  nueva "Comidas preparadas" o congelados/otros?
- **Papas y pasabocas "sabor pollo"** siguen en Pollo: moverlas a snacks (arreglo claro, falta
  hacerlo).

---

## Para trabajar

Hacen falta **cuatro piezas** corriendo, más el development build instalado en el teléfono:

```bash
pnpm run db:start                      # Supabase local — puertos 553xx (SB-001)
pnpm run functions                     # Edge Functions locales (rutas del mapa)
pnpm expo start --dev-client --clear   # Metro; abrir "Pocket Market", no Expo Go
```

- La IP de `.env` tiene que ser la del PC (`EXPO-002`).
- Si se añade una dependencia nativa o se toca `app.config.ts`: **build nueva primero**
  (`pnpm dlx eas-cli@latest build --profile development --platform android`), instalarla y
  después Metro (`EXPO-004`).
- La key de OpenRouteService va en `supabase/functions/.env` (no se versiona).

```bash
pnpm run quality                 # type-check + lint + format + test — gate obligatorio
pnpm run db:test                 # pgTAP de RLS
pnpm exec supabase migration up --local   # aplicar migraciones nuevas sin borrar datos
pnpm run db:reset                # desde cero (BORRA catálogo y sucursales)

pnpm run ingest -- --store all   # precios de las 4 cadenas (~45 min, una al día)
pnpm run ingest -- --store d1    # o una sola: exito | d1 | olimpica | supermu
pnpm run reclassify -- --dry-run # refilar sin tocar la fuente
pnpm run branches -- --store all # sucursales (D1 ~13 min, Ísimo ~17 min; mensual)
```

La ingesta necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que salen de
`pnpm exec supabase status -o json`.
