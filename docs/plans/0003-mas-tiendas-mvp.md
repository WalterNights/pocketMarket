# Plan 0003 — Más tiendas para el MVP y lista de tiendas por cercanía

**Estado:** implementado y subido; falta probar en el teléfono · **Complejidad:** alta
**Escrito:** 2026-10-04 · **¿OTA-able?:** sí (la app no gana código nativo; la ingesta corre fuera)

---

## Progreso: implementado y subido (2026-10-05 → 2026-10-08)

Commits `08521ae`, `d954969`, `21f1a86`, `bb95d96` y `87522b6` en `main`. Solo falta **probarlo
en el teléfono** (lista en [ESTADO](../ESTADO.md#siguiente-paso-sugerido)).

- **Precios** (corrida del 2026-10-08): Éxito ~17.400 · Olímpica ~12.150 · Supermú ~5.780 ·
  D1 ~1.160 productos visibles, 0 ilegibles.
- **Sucursales nuevas**: Ísimo 137 de 310 (el resto no se pudo ubicar con seguridad),
  Olímpica 73, Jumbo 59, Carulla 44, Supermú 14, La Vaquita Express 8 y Mercado Madrid 2.
- **Lista por cercanía**: `stores_near`, origen compartido con el mapa y ciudad recordada.
- **Dos revisiones independientes**, con todo lo importante corregido (ver
  [BITÁCORA](../BITACORA.md)).
- **Fuera del plan pero hecho en el camino**: búsqueda por prefijo, Éxito completo en 74
  subcategorías, productos sin precio ocultos en toda la app, logo.

**Deuda menor**, anotada en ESTADO: desglose de "saltados" por motivo en el reporte de precios,
y recordar "Ver todas" entre aperturas.

## Resumen

El MVP pasa de 1 a **4 cadenas con precios**: Éxito (ya está), **D1**, **Olímpica** y **Supermú**.
Las demás se ven como "Próximamente" en la lista, y **todas** salen en el mapa.

La lista de inicio deja de ser fija. Muestra **las cadenas con una sucursal cerca** del usuario,
ordenadas por la distancia a la más cercana. "Cerca" se mide desde su ubicación, si ya dio
permiso, o desde la ciudad que eligió.

Decisión principal: **la cercanía se calcula en servidor** con las sucursales que ya existen
(`store_branch`). No hay que mantener a mano una lista de "qué cadena hay en qué ciudad": si
mañana Supermú abre en Bogotá, la carga mensual de sucursales lo refleja sola.

## Qué se encontró al investigar (2026-10-04)

| Cadena | Precios | Fuente | Sucursales para el mapa | En el MVP |
|---|---|---|---|---|
| Éxito | ✅ | VTEX (ya está) | ✅ ya están (154) | Con precios |
| **D1** | ✅ | **VTEX, igual que Éxito** — no hace falta navegador | ✅ ya están (2.325) | **Con precios** |
| **Olímpica** | ✅ | VTEX | VTEX pickup points (por verificar) | **Con precios** |
| **Supermú** (antes La Vaquita) | ✅ | Shopify `/products.json`, un solo precio | Directorio en HTML, ~14 tiendas | **Con precios** |
| Jumbo | ✅ | VTEX | VTEX pickup points (por verificar) | Próximamente |
| Carulla | ✅ | VTEX bajo `/io/` | VTEX pickup points (por verificar) | Próximamente |
| La Vaquita Express | ✅ | Magento GraphQL | ~9 tiendas, por localizar | Próximamente |
| Ísimo | 🟡 solo PDF de ofertas | — | API de WordPress: 310 direcciones **sin coordenadas** | Próximamente |
| Mercado Madrid | ❓ la web no responde | — | 2 tiendas conocidas | Próximamente |
| Dollarcity | ❌ sin catálogo | — | ✅ ya están (421) | Próximamente |
| Ara | ❌ solo folletos | — | ✅ ya están (1.657) | Próximamente |

Jumbo y Carulla podrían tener precios casi gratis con el mismo adaptador VTEX, pero quedan
fuera del MVP por **espacio en disco** (ver Riesgos). Activarlos después es añadir una línea de
configuración.

## Decisiones de diseño

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| Un **adaptador VTEX genérico** configurable (host, árbol de categorías, mapa de pasillos); `exito.ts` pasa a ser una configuración | Copiar `exito.ts` para D1 y Olímpica | Es la tercera repetición: regla DRY del repo. Éxito, D1 y Olímpica comparten API, paginación y tope de 2.500 (ING-005) |
| Adaptador **Shopify** propio para Supermú | Navegador o scraping de HTML | `/products.json` es JSON público y `robots.txt` lo permite |
| Cercanía con una función `stores_near(lat, lng)` en Postgres, sobre `store_summary` y `store_branch` | Filtrar en el cliente con `nearest_branches` | `nearest_branches` corta en 30 sucursales: en Bogotá las 30 más cercanas podrían ser todas D1 y esconder al Éxito. Agrupar por cadena tiene que pasar antes del límite |
| Radio de 25 km, el mismo del mapa | Radio por ciudad | Una sola regla, ya validada en el mapa ([plan 0001](0001-mapa-de-tiendas.md)) |
| **Sin origen, se muestran todas las cadenas** (las que tienen precios primero), con una invitación a "Ver solo las de cerca" | Pedir ubicación al abrir la app | Pedir un permiso sin contexto está prohibido (known-issues, Stores) y deja la app vacía si se niega |
| El origen (ubicación o ciudad) se **comparte entre la lista y el mapa** en un store de `branches`, y la ruta `app/index.tsx` se lo pasa a `catalog` como prop | Que `catalog` importe de `branches` | Regla 1: nada de imports entre features. La ruta compone |
| Solo se recuerda el **código de ciudad** elegido (MMKV); la posición nunca | Guardar la última posición | Plan 0001 y 08-security: la posición no se guarda. Una ciudad no es un dato sensible |
| Precios **NACIONAL** para D1, Olímpica y Supermú | Precio por ciudad (`sc` de VTEX) | D1 y Supermú tienen precio único. Olímpica por ciudad queda como la deuda que ya tiene Éxito |
| Sucursales de las cadenas pequeñas (Supermú, La Vaquita Express, Mercado Madrid: unas 25) en un **archivo curado en el repo** con sus coordenadas | Geocodificar o hacer scraping de un directorio HTML | 25 filas se verifican a mano una vez. Scraping de HTML para 14 tiendas que casi nunca cambian sería frágil |
| Ísimo: **geocodificar** las 310 direcciones con Nominatim (OSM) una vez al mes, a 1 petición/s, descartando las que no resuelvan con confianza | Dejar Ísimo fuera del mapa | El usuario pidió **todas** en el mapa. Ver la pregunta abierta 2 |

## Las siete preguntas móviles

1. **Sin red:** la lista sale de la caché de TanStack (`offlineFirst`) con el último origen
   consultado. Sin caché y sin red: `ErrorState` con reintento, como hoy.
2. **Proceso matado:** sobrevive el código de ciudad (MMKV, store Zustand con `version` +
   `migrate`). La ubicación del dispositivo se vuelve a leer al abrir, solo si el permiso ya
   estaba concedido.
3. **Permisos:** la lista **nunca pide** ubicación. La usa solo si ya está concedida. Si no, el
   aviso "Ver solo las tiendas cerca de ti" lleva al mismo selector del mapa (ubicación o
   ciudad). Si se niega el permiso, se puede elegir ciudad, o la lista sigue mostrando todas.
4. **Autorización (RLS):** todo es catálogo público.
   - `stores_near` es `security invoker`, con `grant execute` a `anon` y `authenticated`, y
     solo lee `store`, `store_branch` y `current_price`, que ya son públicas.
   - Las cadenas nuevas son filas de `store` que escribe la migración, es decir `service_role`.
     Sin políticas de escritura nuevas.
   - Test pgTAP: `anon` puede ejecutar `stores_near` y no puede escribir en `store` ni en
     `store_branch`.
5. **Rendimiento:** la lista sigue acotada (~11 cadenas): el `ScrollView` actual sigue siendo
   correcto. `stores_near` agrupa por cadena con el índice GIST que ya existe (`ST_DWithin`) y
   devuelve como mucho 11 filas. La clave de query incluye el origen **redondeado a ~1 km**, para
   no volver a pedir la lista con cada metro que se mueve el GPS.
6. **Background → foreground:** `staleTime` de 1 h, como hoy. Al volver no se relee la
   ubicación: el origen se refresca solo cuando el usuario lo pide.
7. **OTA:** sí. MMKV ya está instalado y `expo-location` ya está en la build. **Verificar
   antes** que `react-native-mmkv` esté de verdad en el binario actual (EXPO-004): si no lo
   está, hace falta build nueva.

## Archivos

**Ingesta — crear**
- [ ] `ingestion/adapters/vtex-catalog.ts`: fábrica `vtexCatalogAdapter(config)` con `fetchCatalog` y `normalize` genéricos, sacados de `exito.ts`.
- [ ] `ingestion/adapters/d1.ts` y `olimpica.ts`: solo configuración (host, raíz, pasillos → taxonomía).
- [ ] `ingestion/adapters/supermu.ts`: Shopify. Pagina con `limit=250&page=N`, filtra por `product_type` de mercado y convierte el precio de texto a COP entero con `toCop`.
- [ ] Fixtures reales en `__fixtures__/` para D1, Olímpica y Supermú, con sus tests.
- [ ] `ingestion/adapters/olimpica-branches.ts`, `jumbo-branches.ts` y `carulla-branches.ts`, sobre `sweepPickupPoints`. Antes hay que verificar que cada una lo expone.
- [ ] `ingestion/adapters/curated-branches.ts` + `ingestion/data/branches/*.json`: Supermú, La Vaquita Express y Mercado Madrid, con su fuente anotada.
- [ ] `ingestion/adapters/isimo-branches.ts` + `ingestion/core/geocode.ts`: Nominatim, 1 petición/s, con una caché en disco para no repetir direcciones.

**Ingesta — modificar**
- [ ] [`ingestion/adapters/exito.ts`](../../ingestion/adapters/exito.ts): pasa a configurar `vtexCatalogAdapter`. Sus tests no cambian: son la red de seguridad del refactor.
- [ ] [`ingest.ts`](../../ingestion/runners/node/ingest.ts) y [`branches.ts`](../../ingestion/runners/node/branches.ts): registrar los adaptadores nuevos y añadir `--store all`.
- [ ] [`classify.ts`](../../ingestion/core/classify.ts): solo si los pasillos de D1, Olímpica o Supermú traen palabras que hoy clasifican mal. Cada regla nueva, con su test.

**Base de datos**
- [ ] `supabase/migrations/<fecha>_more_chains.sql`:
  - activa `d1` y le cambia `source_type` a `'api'`;
  - inserta `olimpica` y `supermu` (activas) y `jumbo`, `carulla`, `vaquita-express`, `isimo` y `mercado-madrid` (inactivas);
  - actualiza el comentario de `store.is_active`.
- [ ] `supabase/migrations/<fecha>_stores_near.sql`: `stores_near(p_lat, p_lng, p_radius_m)`. Devuelve las columnas de `store_summary` más `nearest_m`. Una fila por cadena con alguna sucursal en el radio, ordenada por precios primero y después por distancia.
- [ ] `supabase/tests/stores_near.test.sql`.
- [ ] `pnpm run db:types`.

**App**
- [ ] `src/features/branches/store/origin-store.ts`: Zustand + MMKV. Solo guarda `cityCode`; la posición vive en memoria.
- [ ] [`useMapOrigin.ts`](../../src/features/branches/hooks/useMapOrigin.ts): lee y escribe ese store, para que la lista y el mapa compartan el origen.
- [ ] [`branches/index.ts`](../../src/features/branches/index.ts): exporta `useShoppingOrigin()` (solo coordenadas y etiqueta) y `OriginPicker`.
- [ ] `src/features/catalog/model/store.ts`: `nearestM` opcional y `distanceLabel`.
- [ ] [`store-repository.ts`](../../src/features/catalog/api/store-repository.ts): `list(origin?)`. Con origen llama a `stores_near`; sin él, a `store_summary`.
- [ ] [`useStores.ts`](../../src/features/catalog/hooks/useStores.ts) y `keys.ts`: origen redondeado en la clave.
- [ ] [`StoreListScreen.tsx`](../../src/features/catalog/components/StoreListScreen.tsx):
  - nueva prop `origin`;
  - subtítulo "Cerca de Chapinero · cambiar" o "Todas las tiendas · ver las de cerca";
  - distancia en cada tarjeta;
  - estado vacío: "No hay tiendas de las que conocemos cerca", con "Ver todas".
- [ ] [`app/index.tsx`](../../app/index.tsx): compone `useShoppingOrigin()` → `StoreListScreen origin`.

**Documentación (primero)**
- [ ] `docs/adr/0008-cadenas-del-mvp.md`: qué cadenas, por qué esas 4, la lista por cercanía, sucursales curadas y la geocodificación.
- [ ] [`docs/domain/00-overview.md`](../domain/00-overview.md): tabla de tiendas. D1 deja de "requerir navegador".
- [ ] [`docs/domain/02-ingestion.md`](../domain/02-ingestion.md):
  - fuentes nuevas, con sus términos y su `robots.txt`;
  - presupuesto de almacenamiento recalculado.
- [ ] ESTADO, BITÁCORA y known-issues, al cerrar.

## Patrones aplicados

- **Adapter (Strategy)** por tienda, con una fábrica para la familia VTEX. Añadir una tienda VTEX
  no toca `core/` (regla de ingesta).
- **Repository**: el cambio de origen de datos (`stores_near` / `store_summary`) queda escondido
  en `store-repository`.
- **Composición en la ruta**: el origen (feature `branches`) entra en la lista (feature `catalog`)
  por props, sin dependencia entre features.

## Orden de implementación

1. **Docs y ADR-0008.** Verificable con: revisión tuya.
2. **Refactor de `exito.ts` a `vtex-catalog`, sin cambios de comportamiento.** Verificable con:
   los tests de Éxito siguen verdes y `ingest --dry-run --max 200` da los mismos productos.
3. **D1.**
   - Migración que lo activa, adaptador y fixture.
   - Verificable con: dry-run, porcentaje de ilegibles ≈ 0 y revisión de la clasificación; luego la corrida real.
4. **Olímpica.** Igual que D1. Antes, comprobar si sus precios varían por `sc` y anotarlo.
5. **Supermú.** Adaptador Shopify con su fixture; mismas verificaciones.
6. **Sucursales.**
   - VTEX: Olímpica, Jumbo y Carulla.
   - Curadas: Supermú, La Vaquita Express y Mercado Madrid.
   - Ísimo geocodificado.
   - Verificable con: el mapa en Medellín muestra Supermú, y el reporte da 0 fuera de Colombia.
7. **`stores_near` con pgTAP.** Verificable con: `db:test` y una consulta desde Bogotá y desde
   Medellín.
8. **App: origen compartido y lista por cercanía.** Verificable en el teléfono: Bogotá no
   muestra Supermú, Medellín sí; sin permiso se ven todas.
9. `pnpm run quality`, `db:test`, `db:lint` y medir el tamaño de la base
   (`pg_database_size`).

## Tests

- **Unidad (ingesta):**
  - `normalize` de D1, Olímpica y Supermú con fixtures reales: agotado → `skipped`, forma rota → `failed`, precio `"8290.00"` → 8290;
  - pasillos → taxonomía;
  - producto que no es de mercado → descartado;
  - geocodificación: dirección ambigua → descartada, nunca adivinada.
- **Unidad (app `model/`):** `distanceLabel` y el redondeo del origen para la clave de query.
- **pgTAP:**
  - `stores_near` devuelve una fila por cadena, ordenada con las de precios primero;
  - el radio está acotado;
  - sin sucursales cerca devuelve 0 filas;
  - `anon` ejecuta la función pero no escribe en `store` ni en `store_branch`.
- **Componente:** la lista con y sin origen, y el estado vacío "ninguna cerca". Es el primer
  test del proyecto `components` (ESTADO, punto 5).

## Riesgos y trampas conocidas

| Riesgo | De known-issues | Mitigación |
|---|---|---|
| **Espacio**: 4 cadenas acercan la base al límite de 500 MB del plan gratuito en meses | "El free tier de Supabase son 500 MB" | Solo pasillos de mercado. Medir tras cada corrida. La **retención a 90 días (plan 0002) es requisito antes del Supabase remoto**. Jumbo y Carulla esperan |
| Tope de paginación de VTEX en D1 y Olímpica | ING-005 | El adaptador genérico hereda `MAX_OFFSET`; bajar a subcategorías si un pasillo pasa de 2.500 |
| Producto en dos categorías dentro del mismo lote | "Un producto puede estar en DOS categorías" | La deduplicación por `external_id` ya existe en el pipeline |
| Precio de Shopify en texto con decimales (`"8290.00"`) | "Separador de miles leído como decimal" | `toCop` con un test explícito de este formato |
| Precio de pack confundido con precio unitario | "Adivinar `unitValue`" | Medida solo si el nombre la dice; si no, `null` |
| Clasificación nueva con pasillos de otra tienda | ING-002, ING-006, ING-008 | Los pasillos homogéneos (mascotas) son autoritativos; el resto, por nombre. Revisar los primeros 200 de cada tienda |
| Geocodificar mal una tienda de Ísimo la pone en otra ciudad | "Adivinar valores que la fuente no publica" | Solo se aceptan resultados de tipo `building` o `house`; el resto se descarta y se reporta. Los descartes no salen en el mapa |
| MMKV no está en el binario instalado | EXPO-004 | Comprobarlo antes del paso 8. Si falta, build nueva |
| Cambiar la estructura de rutas con Metro corriendo | "Reestructurar `app/` con Metro corriendo" | Este plan no mueve rutas |

## Fuera de alcance

- Precios por ciudad (`sc` de VTEX) en cualquier cadena.
- Precios de Jumbo, Carulla, La Vaquita Express, Ísimo (PDF), Mercado Madrid, Dollarcity y Ara.
- Comparar el mismo producto entre cadenas (equivalencias, ADR-0004).
- Cron diario y retención (plan 0002). Siguen siendo manuales: `pnpm run ingest --store all`.
- Logos de las cadenas.

## Preguntas abiertas

1. **¿Las 4 con precios son Éxito, D1, Olímpica y Supermú?** Supermú solo sirve en Medellín.
   Si el MVP se prueba en otra ciudad, Jumbo o Carulla aportarían más.
2. **Ísimo en el mapa exige geocodificar** con Nominatim (servicio externo gratuito, pide
   atribución y 1 petición/s). ¿Lo hacemos, o Ísimo entra en el mapa más adelante?
3. **¿Recordar la ciudad elegida entre aperturas?** (solo el código de ciudad, nunca la
   posición). Propuesta: sí.
