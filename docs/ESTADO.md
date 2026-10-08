# Estado del proyecto

> Foto de dónde está Pocket Market **hoy**. Se actualiza al terminar cada sesión de trabajo.
> Para las reglas permanentes, ver [CLAUDE.md](../CLAUDE.md); para el porqué de cada decisión,
> [`docs/adr/`](adr/); para **cómo se llegó aquí**, sesión a sesión, la [BITACORA](BITACORA.md).

**Última actualización:** 2026-10-08 · rama `main` · todo commiteado y subido (último commit `87522b6`)

---

## Cómo retomar en una sesión nueva

1. Leer este archivo entero y la última entrada de la [BITÁCORA](BITACORA.md).
2. Consultar [known-issues](../.claude/rules/known-issues.md) antes de tocar código: cada
   problema ya pagado está ahí con su causa.
3. Levantar el entorno con los comandos de [Para trabajar](#para-trabajar) y seguir por
   [Siguiente paso sugerido](#siguiente-paso-sugerido).
4. Al cerrar la sesión: entrada nueva en la BITÁCORA, este archivo al día y commit.

**Cómo se trabaja aquí** (preferencias del dueño del proyecto):

- Documentación y conversación en español; código y comentarios en inglés.
- Algo no trivial: plan primero (`rn-plan`), aprobación, y después implementación.
- Antes de subir: revisión de código independiente, correcciones aplicadas, gate en verde.
- Se sube directo a `main`.

---

## En una frase

La app lee un catálogo real de **cuatro cadenas** (Éxito, Olímpica, Supermú y D1: unos 36.000
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

**Última corrida de precios: 2026-10-08**, las cuatro con `--store all`, 0 páginas perdidas:

| Cadena | Vistos | Escritos | Retirados | Duración |
|---|---|---|---|---|
| Éxito (74 subcategorías) | 49.949 | 15.122 (el resto está agotado) | 405 | 52 min |
| Olímpica | 12.131 | 12.128 | 29 | 13 min |
| Supermú | 7.619 | 5.776 (el resto es licor, cuidado personal y hogar) | 1 | 1 min |
| D1 | 1.191 | 1.154 | 4 | 1,5 min |

Productos visibles en la app (con precio): Éxito ~17.400, Olímpica ~12.150, Supermú ~5.780,
D1 ~1.160. Sin precio: 4 del Éxito, ya retirados porque la tienda dejó de venderlos.

**Ísimo en el mapa:** solo 137 de sus 310 tiendas. Publica direcciones sin coordenadas y se
geocodifican; las que no se ubican con seguridad se descartan en vez de adivinarlas.

### Base de datos (`supabase/`)

21 migraciones. RLS en todas las tablas; **97 tests pgTAP** en verde. La base local pesa
**84 MB** con las cuatro cadenas (límite del plan gratuito: 500 MB).

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
| Un producto sin precio nunca se muestra (lo filtra la vista del catálogo) | ✅ |
| Búsqueda mientras se escribe (por comienzo de palabra, sin tildes) | ✅ comprobada contra la base; 🟡 sin probar en el teléfono |
| Hoja de producto: cantidad y presentación (cartón, docena, panal…) | ✅ |
| Borrador con total por tienda | ✅ en memoria (se pierde al cerrar la app) |
| Inicio de sesión y registro (email + contraseña) | ✅ [ADR-0005](adr/0005-autenticacion.md) |
| Guardar lista, "Mis listas" con total de hoy y variación, editar | ✅ totales en servidor. Un producto que perdió su precio sigue en la lista, atenuado, con "Sin precio hoy" |
| Avisos semanal / quincenal / mensual | ✅ se guardan y reconcilian — 🟡 **falta oírlos sonar** en el development build |
| Mapa de tiendas cercanas, sin otros negocios | ✅ MapLibre + OpenFreeMap ([ADR-0006](adr/0006-mapa-maplibre.md)), probado |
| Ruta dibujada a pie / en vehículo | ✅ probado en el teléfono |
| Navegación en vivo (tiempo restante, recálculo, llegada) | 🟡 **sin probar caminando** |

**Tests:** 647 de Jest (modelo puro, ingesta, utilidades y el primer test de componente) + 97
pgTAP. `pnpm run quality` en verde. Última revisión de código independiente: 2026-10-05, con todo lo importante corregido
([bitácora](BITACORA.md)).

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

`ingestion/core/classify.ts` decide en qué pasillo va cada producto. Capas, de la más fuerte a
la más débil:

1. **Pasillo con autoridad**: si la fuente dice `mascotas`, es de mascotas (`ING-008`).
2. **Se borran los modificadores**: `sabor [a] X` y `relleno de X` dicen a qué sabe, no qué es.
3. **Mascotas y no comestibles**: un limpiador "aroma canela" no es canela (`ING-010`).
4. **Pasillos cerrados**: en aseo y congelados manda el pasillo de la fuente.
5. **Congelados por nombre**, helados incluidos.
6. **Excepciones**: la leche en polvo SÍ es leche; "pasta de ajo" es un condimento.
7. **Sustantivo inicial**: "Galleta leche" es una galleta (`ING-010`). Algunos dependen del
   pasillo ("Papa" es verdura en frescos y snack en otros).
8. **Forma**: mermelada, en lata, en polvo, embutido.
9. **Frescos, con llave**: fruta y verdura **solo** si la fuente dice pasillo de frutas y
   verduras.
10. **Ingrediente**: lo evidente.

Reglas por **palabra entera** con plural; las raíces se marcan con `*` (`ING-006`).

**Para arreglar una mala clasificación:** añadir la regla y su test, y `pnpm run reclassify`.

---

## Siguiente paso sugerido

1. **Probar en el teléfono** lo del plan 0003 y la búsqueda:
   - con ciudad Bogotá no sale Supermú; con Medellín sí;
   - sin ubicación ni ciudad se ven todas las cadenas;
   - la ciudad elegida se recuerda al reabrir;
   - D1, Olímpica y Supermú abren con productos;
   - la búsqueda encuentra mientras se escribe ("go" → gomitas);
   - el logo nuevo: exige **build nueva** (`pnpm dlx eas-cli@latest build --profile development
     --platform android`), porque icono y splash son nativos.
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

- El reporte de precios dice "saltados" sin desglosar el motivo (agotado, fuera de mercado, sin
  pasillo). El de sucursales ya lo desglosa.
- "Ver todas" se respeta durante la sesión, pero no entre aperturas.
- Un pasillo VTEX que llegue al tope de 2.500 productos ahora marca la corrida como incompleta:
  si pasa, hay que partirlo en subcategorías (como la Despensa de Olímpica).

### Decisiones pendientes del usuario

- **Comida preparada** (empanadas, lasaña, tamal, sándwich): hoy casi toda cae en congelados
  (107) y unas pocas en otros o pollo. ¿Categoría propia "Comidas preparadas"?
- **Lista guardada con un producto sin precio**: hoy se muestra atenuado con "Sin precio hoy".
  ¿Mantenerlo o esconderlo?

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
- `db:start`, `functions` y `expo start` van **cada uno en su terminal**: los dos últimos no
  terminan nunca.
- Si `pnpm` deja de arrancar ("Control de aplicaciones bloqueó este archivo"), es Windows y no
  el proyecto: ver `BUILD-002` en known-issues, que lista los comandos equivalentes con Node.

```bash
pnpm run quality                 # type-check + lint + format + test — gate obligatorio
pnpm run db:test                 # pgTAP de RLS
pnpm exec supabase migration up --local   # aplicar migraciones nuevas sin borrar datos
pnpm run db:reset                # desde cero (BORRA catálogo y sucursales)

pnpm run ingest -- --store all   # precios de las 4 cadenas (~70 min, una al día)
pnpm run ingest -- --store d1    # o una sola: exito | d1 | olimpica | supermu
pnpm run reclassify -- --dry-run # refilar sin tocar la fuente
pnpm run branches -- --store all # sucursales (D1 ~13 min, Ísimo ~17 min; mensual)
```

La ingesta necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. En Git Bash:

```bash
eval $(pnpm exec supabase status -o env | grep -E '^(API_URL|SERVICE_ROLE_KEY)=')
export SUPABASE_URL="$API_URL" SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY"
```

El reporte de cada corrida dice cuántos productos sin precio había antes y después; en una
corrida sana el "después" es cero o casi.

**Regla de la casa con las fuentes:** una corrida al día por tienda. Repetir una carga el mismo
día "para probar" va contra [la regla de ingesta](../.claude/rules/ingestion.md).
