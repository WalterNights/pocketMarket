# Estado del proyecto

> Foto de dónde está Pocket Market **hoy**. Se actualiza al terminar cada sesión de trabajo.
> Para las reglas permanentes, ver [CLAUDE.md](../CLAUDE.md); para el porqué de cada decisión,
> [`docs/adr/`](adr/); para **cómo se llegó aquí**, sesión a sesión, la [BITACORA](BITACORA.md).

**Última actualización:** 2026-10-05 · rama `main` · todo subido (ver `git log`)

---

## En una frase

La app lee un catálogo real de Éxito (13.750 productos) desde Supabase local. Con cuenta, el
usuario **guarda listas, las edita y les pone avisos**; y en un **mapa** ve las tiendas de Éxito,
D1, Dollarcity y Ara más cercanas (4.557 cargadas) y puede **navegar hasta una** dentro de la app,
a pie o en vehículo. Se prueba con un **development build** de EAS, no con Expo Go.

---

## Qué funciona

### Ingesta (`ingestion/`)

Corre fuera del dispositivo y es lo único que escribe el catálogo.

| Pieza | Estado |
|---|---|
| Precios de Éxito (API VTEX pública), 14 subcategorías de "Mercado" | ✅ |
| Pipeline: fetch → normalize → validate → upsert → diff → append → publish | ✅ |
| Clasificador a taxonomía colombiana (39 categorías) | ✅ ver abajo |
| Reclasificar sin volver a la fuente (`pnpm run reclassify`) | ✅ |
| Sucursales de las 4 cadenas (`pnpm run branches`) | ✅ Ara 1.657 · Dollarcity 421 · Éxito 154 · D1 2.325 |
| Precios de D1 y Dollarcity | ❌ requieren Playwright |
| Precios de Ara | ❌ **no tiene catálogo online** — solo folletos. Ya se investigó |
| Cron diario de precios | ❌ **pendiente** — [plan 0002](plans/0002-cron-de-ingesta-diaria.md) |
| Carga mensual de sucursales en CI | 🟡 workflow `branches.yml` listo, en manual hasta tener Supabase remoto |

**Última corrida de precios:** 27.217 vistos · 13.750 escritos · 49% agotados · **0% ilegibles**.
El 49% de agotados es real: VTEX ordena los disponibles primero y la cola de cada categoría es
stock agotado.

### Base de datos (`supabase/`)

17 migraciones. RLS en todas las tablas; **85 tests pgTAP** en verde.

Dos mundos con reglas distintas: **catálogo** (precios, sucursales — lectura pública, escribe solo
`service_role`) y **datos de usuario** (listas, avisos — solo el dueño). La ausencia de política de
escritura en el catálogo *es* la protección.

Edge Function `route` (rutas del mapa): valida y llama a OpenRouteService con su key guardada
como secreto, nunca en la app ([ADR-0007](adr/0007-rutas-openrouteservice.md)).

### App (`src/`, `app/`)

| Pantalla | Estado |
|---|---|
| Tiendas → categorías → productos, con búsqueda y scroll infinito | ✅ |
| Hoja de producto: cantidad y presentación (cartón, docena, panal…) | ✅ |
| Borrador con total por tienda | ✅ en memoria (se pierde al cerrar la app) |
| Inicio de sesión y registro (email + contraseña) | ✅ [ADR-0005](adr/0005-autenticacion.md) |
| Guardar lista, "Mis listas" con total de hoy y variación, editar | ✅ totales en servidor |
| Avisos semanal / quincenal / mensual | ✅ se guardan y reconcilian — 🟡 **falta oírlos sonar** en el development build |
| Mapa de tiendas cercanas, sin otros negocios | ✅ MapLibre + OpenFreeMap ([ADR-0006](adr/0006-mapa-maplibre.md)), probado |
| Ruta dibujada a pie / en vehículo | ✅ probado en el teléfono |
| Navegación en vivo (tiempo restante, recálculo, llegada) | 🟡 **sin probar caminando** |

**Tests:** 318 de Jest (modelo puro, ingesta y utilidades) + 85 pgTAP. `pnpm run quality` en
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
5. **Tests de componente vacíos.** El proyecto `components` de Jest está configurado pero sin
   tests.
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

1. **Probar en la calle** la navegación en vivo y **oír sonar un aviso**
   ([guias/probar-avisos.md](guias/probar-avisos.md)).
2. **Proyecto remoto de Supabase**: destraba el cron de precios (0002), la carga de sucursales y
   una build que funcione fuera de casa.
3. **Cron diario de precios** ([plan 0002](plans/0002-cron-de-ingesta-diaria.md)).
4. **Borrador persistente con MMKV** y error boundary en la raíz.
5. **Mejora de la clasificación** aplicada a las demás tiendas cuando tengan catálogo.

### Decisiones pendientes del usuario

- **Comida preparada** (empanadas, lasaña, raviolis, tamal, sándwich) sale en Pollo: ¿categoría
  nueva "Comidas preparadas" o congelados/otros?
- **Papas y pasabocas "sabor pollo"** siguen en Pollo: moverlas a snacks (arreglo claro, falta
  hacerlo).
- **Icono definitivo de la app**: el actual es provisional.

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

pnpm run ingest                  # precios de Éxito (~23 min, una al día)
pnpm run reclassify -- --dry-run # refilar sin tocar la fuente
pnpm run branches -- --store all # sucursales (D1 tarda ~13 min; mensual)
```

La ingesta necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que salen de
`pnpm exec supabase status -o json`.
