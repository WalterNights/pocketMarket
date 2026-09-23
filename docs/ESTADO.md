# Estado del proyecto

> Foto de dónde está Pocket Market **hoy**. Se actualiza al terminar cada sesión de trabajo.
> Para las reglas permanentes, ver [CLAUDE.md](../CLAUDE.md); para el porqué de cada decisión,
> [`docs/adr/`](adr/).

**Última actualización:** 2026-09-24 · rama `main` · commit `034aa6d`

---

## En una frase

La app lee un catálogo real de Éxito (13.750 productos, precios de verdad) desde Supabase
local, permite armar una lista y ver el total. **No hay autenticación todavía**, así que las
listas viven en memoria y se pierden al cerrar.

---

## Qué funciona

### Ingesta (`ingestion/`)

Corre fuera del dispositivo y es lo único que escribe el catálogo.

| Pieza | Estado |
|---|---|
| Adaptador de Éxito (API VTEX pública) | ✅ 14 subcategorías de "Mercado" |
| Pipeline: fetch → normalize → validate → upsert → diff → append → publish | ✅ |
| Clasificador a taxonomía colombiana (39 categorías) | ✅ 4 capas, ver abajo |
| Reclasificar sin volver a la fuente (`pnpm run reclassify`) | ✅ |
| Adaptadores de D1, Dollarcity | ❌ requieren Playwright |
| Ara | ❌ **no tiene catálogo online** — solo folletos. Ya se investigó |
| Cron diario | ❌ **pendiente** — [plan 0002](plans/0002-cron-de-ingesta-diaria.md) |

**Última corrida:** 27.217 vistos · 13.750 escritos · 49% agotados · **0% ilegibles** · 23 min.

El 49% de agotados es real y está verificado contra la fuente: VTEX ordena los disponibles
primero, así que la cola de cada categoría es stock agotado (Bebidas en el offset 1500 da
100%). Se descartó que fuera un fallo de lectura — ningún producto esconde precio en otra
variante ni en otro vendedor.

### Base de datos (`supabase/`)

13 migraciones aplicadas. RLS en todas las tablas, 27 tests pgTAP en verde.

Dos mundos con reglas distintas: **catálogo** (lectura pública, escribe solo `service_role`) y
**datos de usuario** (lectura y escritura del dueño). La ausencia de política de escritura en
el catálogo *es* la protección.

### App (`src/`, `app/`)

| Pantalla | Estado |
|---|---|
| Lista de tiendas | ✅ con contador y frescura |
| Categorías de una tienda | ✅ |
| Productos de una categoría, con búsqueda y scroll infinito | ✅ |
| Hoja de producto: cantidad y presentación (cartón, docena, panal…) | ✅ |
| Barra de borrador con total y contador | ✅ |
| Pantalla de carga propia (`PocketLoader`) | ✅ |
| Guardar listas | ❌ **necesita auth** |
| Recordatorios | ❌ |
| Mapa de tiendas | ❌ **pendiente** — [plan 0001](plans/0001-mapa-de-tiendas.md) |

---

## Qué NO funciona todavía, y por qué importa

1. **No hay autenticación.** Es lo que bloquea guardar listas, que es la mitad del producto.
   Es el siguiente paso natural.
2. **Expo Go, no development build.** Todo lo que lleve código nativo está fuera de alcance
   hasta que se haga una build: mapa, MMKV, notificaciones. El splash crema tampoco se ve en
   Expo Go, que usa el suyo blanco.
3. **Solo Supabase local.** No hay proyecto remoto. El free tier permite 2 proyectos activos,
   así que dev va contra local (Docker) y staging/prod compartirán el remoto.
4. **Sin error boundary en la raíz.** `app/_layout.tsx` no define uno, así que un error de
   render deja pantalla blanca sin explicación. Pendiente.
5. **Tests de componente vacíos.** El proyecto `components` de Jest está configurado pero sin
   tests. Los de `model/` e ingesta sí existen: 137 en total.

---

## Decisiones tomadas que conviene no volver a discutir

Están en los ADR, pero estas son las que más veces han vuelto a surgir:

- **No es una app de compra.** Ni pago, ni pedido, ni entrega. Calculadora de presupuesto.
- **shadcn/ui no funciona en React Native** (es Radix: DOM + CSS). Se usa React Native
  Reusables, que es su port, y los componentes se **copian** a `shared/ui/`.
- **Dinero en `integer` COP.** El peso no usa centavos y los flotantes pierden dinero.
- **Nunca borrar un `store_product`.** Hay `list_item` apuntando: se marca `is_available`.
- **Los totales de una lista guardada se calculan en servidor.** El borrador en memoria es la
  excepción, porque todavía no existe en la base.
- **Taxonomía colombiana, no "víveres y abarrotes".** Los huevos son su propia categoría
  porque se compran solos, y las gaseosas no están enterradas en "bebidas".

---

## El clasificador, que es donde más se ha iterado

`ingestion/core/classify.ts` decide en qué pasillo va cada producto. Cuatro capas, en orden:

1. **Se borran los modificadores** — `sabor [a] X` y `relleno de X` describen a qué sabe algo,
   no qué es.
2. **Excepciones** — la leche en polvo SÍ es leche, aunque "en polvo" suela ser condimento.
3. **Forma** — mermelada, en lata, en polvo, embutido. La presentación manda sobre el
   ingrediente: una crema de tomate en sobre es sopa.
4. **Ingrediente** — lo evidente.
5. **Frescos, con llave** — las reglas de fruta y verdura **solo** se aplican si la fuente dice
   que el producto viene del pasillo de frutas y verduras. Un limón de verdad se vende ahí; un
   barquillo de limón, no.

Las reglas se comparan por **palabra entera** con plural. Las que de verdad son raíces se
marcan con `*` (`enlatad*`, `salchich*`). Esto no es un detalle: ver `ING-006`.

**Para arreglar una mala clasificación:** añadir la regla, añadir su test, y
`pnpm run reclassify`. No hace falta volver a pedirle el catálogo a Éxito — para eso se guarda
`source_bucket`.

---

## Tareas pendientes con plan escrito

| # | Tarea | Estado | Bloqueo |
|---|---|---|---|
| [0001](plans/0001-mapa-de-tiendas.md) | Mapa de tiendas con las más cercanas | plan listo | 3 preguntas abiertas + exige development build |
| [0002](plans/0002-cron-de-ingesta-diaria.md) | Cron diario que actualiza la base | plan listo | contradice a ADR-0003: hay que decidir y documentar primero |

**0002 es el más urgente en la práctica**: sin él los precios se quedan congelados en la
última corrida manual, que es justo lo contrario de lo que promete la app. Y tiene un efecto
secundario que importa: el free tier de Supabase **pausa el proyecto tras una semana sin
actividad**, y el cron diario lo mantiene despierto.

Ojo con 0002: el ADR decidió Edge Function para Éxito, pero una corrida tarda **23 minutos** y
una Edge Function no dura tanto. El plan explica las dos salidas y cuál se recomienda.

---

## Siguiente paso sugerido

**Autenticación**, porque desbloquea guardar listas y sin eso el producto está a medias.
Después, o bien los recordatorios (cierran el ciclo del producto) o bien el mapa (que además
obliga al development build y destraba todo lo nativo).

Los dos planes escritos ([0001](plans/0001-mapa-de-tiendas.md) y
[0002](plans/0002-cron-de-ingesta-diaria.md)) están listos para implementar en cuanto se
respondan sus preguntas abiertas.

---

## Comandos que se usan a diario

```bash
pnpm run db:start                # Supabase local
pnpm run db:reset                # migraciones + seed desde cero (BORRA el catálogo)
pnpm exec supabase migration up --local   # aplicar solo lo nuevo, sin borrar

pnpm run ingest                  # corrida completa (~23 min, una al día)
pnpm run reclassify -- --dry-run # refilar sin tocar la fuente

pnpm run quality                 # type-check + lint + format + test
pnpm run db:test                 # pgTAP de RLS
```

La ingesta necesita `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, que salen de
`pnpm exec supabase status -o json`.
