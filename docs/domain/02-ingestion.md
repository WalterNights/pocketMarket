# Pipeline de ingesta de precios

## Regla que lo gobierna todo

> **La app nunca obtiene datos de las tiendas. La app lee Supabase.**

Un pipeline centralizado obtiene, normaliza, valida y guarda. La app consulta el resultado.
Razonado en [ADR-0003](../adr/0003-ingesta-centralizada.md).

## Topología

```
┌─────────────────────────────────────────────────────────┐
│  FUENTES CON API                                         │
│  Éxito (VTEX)                                            │
│       └─► Supabase Edge Function (Deno) + pg_cron        │
│                                                           │
│  FUENTES QUE EXIGEN NAVEGADOR                            │
│  D1, Dollarcity                                          │
│       └─► GitHub Actions (cron) + Playwright             │
└──────────────────────────┬──────────────────────────────┘
                           │ service_role
                           ▼
                  ┌────────────────┐
                  │   Supabase     │
                  │  store_product │
                  │ price_snapshot │
                  └────────┬───────┘
                           │ anon + RLS (solo SELECT)
                           ▼
                    ┌────────────┐
                    │  App RN    │
                    └────────────┘
```

Dos entornos de ejecución porque las fuentes son distintas, no por gusto: las Edge Functions no
tienen Chromium ni tiempo de ejecución largo, y montar un VPS solo para eso sería sobreingeniería.

## Ubicación en el repo

El pipeline vive en el **mismo repositorio**, separado de la app:

```
pocket-market/
├── src/                      app React Native
├── ingestion/
│   ├── adapters/
│   │   ├── exito.ts
│   │   ├── d1.ts
│   │   └── dollarcity.ts
│   ├── core/
│   │   ├── pipeline.ts       orquestación común
│   │   ├── normalize.ts      unidades, marcas, categorías
│   │   └── schemas.ts        Zod del producto normalizado
│   └── runners/
│       ├── edge/             Edge Functions (Deno)
│       └── node/             entrypoints para GitHub Actions
├── supabase/
│   ├── migrations/
│   └── functions/
└── .github/workflows/
    └── ingest.yml
```

Un solo repo porque los **schemas Zod del producto normalizado se comparten** entre pipeline y
app. Dos repos obligarían a duplicarlos o publicar un paquete, y ese coste no se paga solo con
un desarrollador.

La app **nunca importa de `ingestion/`** y el pipeline **nunca importa de `src/`**. Lo común
vive en `ingestion/core/schemas.ts`, del que la app sí puede leer tipos.

## Las siete etapas

```
1. Fetch      adaptador → datos crudos de la fuente
2. Normalize  → forma canónica común a todas las tiendas
3. Validate   Zod; lo que no valida se descarta y se reporta
4. Upsert     store_product por (store_id, external_id); marca last_seen_at
5. Diff       compara con current_price
6. Append     price_snapshot SOLO si el precio cambió
7. Refresh    refresh materialized view concurrently current_price
```

Y al final, **reportar**: productos vistos, nuevos, precios cambiados, descartados por
validación, errores. Una corrida silenciosa es una corrida que no sabes si funcionó.

### Etapa 6 merece énfasis

Insertar un snapshot diario idéntico al anterior hace crecer la tabla sin aportar nada. Solo se
inserta cuando el precio **cambia**. Consecuencia: `captured_at` significa *"desde cuándo tiene
este precio"*, no *"cuándo se miró"*. Para saber cuándo se miró está `store_product.last_seen_at`.

## Interfaz del adaptador

Añadir una tienda = escribir un adaptador. Nada más cambia.

```ts
// ingestion/core/types.ts
export interface StoreAdapter {
  /** slug en la tabla store */
  readonly storeSlug: string
  /** 'api' | 'scraper' */
  readonly sourceType: SourceType
  /** regiones que esta fuente publica */
  readonly regions: RegionCode[]

  /** Itera el catálogo. Async iterable para no cargar 50k productos en memoria. */
  fetchCatalog(region: RegionCode, ctx: FetchContext): AsyncIterable<RawProduct>

  /** Traduce el crudo de la fuente a la forma canónica. Función PURA y testeable. */
  normalize(raw: RawProduct): NormalizedProduct | null
}
```

```ts
export const normalizedProductSchema = z.object({
  externalId:  z.string().min(1),
  ean:         z.string().regex(/^\d{8,14}$/).nullable(),
  name:        z.string().min(1),
  brand:       z.string().nullable(),
  categorySlug: z.string().nullable(),
  unitKind:    z.enum(['unit', 'weight', 'volume']),
  unitValue:   z.number().positive().nullable(),
  unitMeasure: z.enum(['g', 'kg', 'ml', 'l', 'un']).nullable(),
  imageUrl:    z.string().url().nullable(),
  priceCop:    z.number().int().positive(),
  listPriceCop: z.number().int().positive().nullable(),
})
```

`normalize` es **pura**: entra el crudo, sale la forma canónica. Se testea con fixtures reales
guardadas del día que se escribió el adaptador, sin red. Cuando la fuente cambie su formato, el
test falla y dice exactamente qué cambió.

### `AsyncIterable`, no array

El catálogo de Éxito ronda decenas de miles de SKU. Traerlo entero a memoria en una Edge
Function es un fallo asegurado. El adaptador pagina e itera; el pipeline procesa por lotes.

## Normalización — donde está el trabajo real

Cada tienda publica los datos a su manera. La capa `normalize.ts` unifica:

| Problema | Ejemplo | Tratamiento |
|---|---|---|
| Medida dentro del nombre | `"Arroz Diana x 500g"` | Extraer `unitValue: 500`, `unitMeasure: 'g'` |
| Unidades dispares | `0.5 kg` vs `500 g` | Canonizar a la base (`g`, `ml`, `un`) |
| Marca en el nombre | `"DIANA Arroz blanco"` | Separar `brand` de `name` |
| Categorías propias | `"Víveres > Granos"` | Mapear a la taxonomía propia |
| Precio con formato | `"$ 4.200"`, `4200.00` | A entero COP |
| Tildes y mayúsculas | `"PLÁTANO"` / `"platano"` | `unaccent` + minúsculas para buscar, original para mostrar |
| Empaques múltiples | `"Six pack"`, `"x3 und"` | `unitKind: 'unit'`, `unitValue: 3` |

Lo que no se puede normalizar con confianza se guarda como `null`, **nunca se adivina**. Un
`unitValue` inventado produce un precio por medida falso, que es peor que no tenerlo.

## Cadencia

| Fuente | Frecuencia | Motivo |
|---|---|---|
| Éxito (API) | Diaria, de madrugada | Los precios de supermercado no cambian por hora |
| D1, Dollarcity (scraper) | Diaria, escalonada | Repartir la carga y no coincidir entre sí |
| Refresh de `current_price` | Al final de cada corrida | — |

Los precios que ve el usuario son **de hoy**, no de este segundo. La UI lo dice: "Precios
actualizados hace N horas".

## Presupuesto de almacenamiento

El free tier de Supabase da **500 MB de base de datos**. `price_snapshot` es append-only y crece
de forma lineal con el tiempo, así que el límite no se alcanza de golpe: se alcanza un martes
cualquiera dentro de unos meses. Estimación (fila + índices):

| Escenario | Catálogo | Snapshots/año | Total |
|---|---|---|---|
| **v1: Éxito, solo categorías de mercado** (~20k SKU) | 25 MB | 87 MB | **112 MB** |
| Éxito catálogo completo (~50k SKU) | 63 MB | 218 MB | 280 MB |
| 3 tiendas, categorías de mercado | 76 MB | 261 MB | 337 MB |
| 3 tiendas, catálogo completo | 189 MB | 653 MB | **841 MB — no cabe** |

Dos consecuencias de diseño, ambas desde el principio y no cuando explote:

### 1. Ingerir solo lo que es mercado

Éxito vende electrodomésticos, ropa y muebles. Esta app es de **mercado**: el adaptador filtra
por las categorías de la taxonomía propia y descarta el resto. No es solo ahorro de espacio —
un televisor en los resultados de búsqueda de una lista de compra es ruido.

### 2. Retención del histórico

Los snapshots antiguos pierden valor rápido: para "¿cuánto costaba en marzo?" basta un punto al
mes, no uno por cada cambio. Política:

| Antigüedad | Qué se conserva |
|---|---|
| < 90 días | Todos los snapshots |
| > 90 días | El primero y el último de cada mes, por producto y región |

Ejecutada por `pg_cron` una vez al mes. Nunca se borra el snapshot más reciente de un
`(store_product_id, region_code)`: es lo que alimenta `current_price`.

> Vigilar el consumo real tras la primera corrida completa:
> `select pg_size_pretty(pg_database_size(current_database()));`
> La estimación de arriba usa medias; los índices GIN sobre `tsvector` y trigram son los
> componentes más difíciles de predecir.

## Comportarse bien con las fuentes

No es cortesía: un scraper agresivo se gana un bloqueo y deja la app sin datos.

- **Concurrencia limitada** y pausa entre peticiones. Sin ráfagas.
- **User-Agent identificable** con forma de contacto.
- **Respetar `robots.txt`** y los términos de uso de cada fuente.
- **Backoff exponencial** ante 429 y 5xx; abortar la corrida antes que insistir.
- **Caché condicional** (`ETag`, `If-Modified-Since`) donde la fuente lo soporte.
- **Una corrida al día**, no un bucle.

> La app muestra precios **publicados** por las tiendas como referencia para presupuestar, y lo
> declara en la UI. No se presenta como precio oficial ni de caja registradora.

## Errores y observabilidad

Una corrida nunca debe romper el catálogo existente.

| Situación | Comportamiento |
|---|---|
| La fuente no responde | Abortar esa tienda, conservar datos previos, reportar |
| Cambió el formato y `normalize` devuelve `null` masivamente | **Abortar y alertar.** Umbral: si se descarta >20% de los ítems, algo se rompió |
| Un producto desaparece del catálogo | No borrar. Si falta en 3 corridas → `is_available = false` |
| Precio absurdo (0, negativo, ×10 del anterior) | Descartar el ítem y reportar. Un precio mal parseado destruye la confianza |
| Corrida parcial | Guardar lo válido; el `last_seen_at` distingue lo fresco de lo rancio |

La regla del **20% descartado** es la que detecta que una tienda cambió su HTML antes de que el
usuario vea precios equivocados.

## Secretos

| Secreto | Dónde |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Secret de GitHub Actions / variable de Edge Function |
| Credenciales de fuentes (si aplica) | Igual |
| — | **Jamás** en el bundle de la app, ni en `EXPO_PUBLIC_*` |

El `service_role` salta RLS: es acceso total a la base de datos. Solo vive en el entorno del
pipeline.

## Añadir una tienda nueva

Usar la skill [`rn-source-adapter`](../../.claude/skills/rn-source-adapter/SKILL.md), que
recorre: investigar la fuente → fixtures → `normalize` puro con tests → adaptador → runner →
registro en `store` → primera corrida verificada.
