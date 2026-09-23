---
name: rn-source-adapter
description: Use this skill whenever the user wants to add, fix or investigate a price source for a store in this app — "agrega una tienda", "añade D1", "nueva fuente", "el scraper de X no funciona", "se rompió la ingesta", "add a store", "new source", "scraper roto", "actualiza el adaptador", "de dónde saco los precios de X". Covers researching the store's data source (API vs scraping), capturing fixtures, writing the pure normalize() function with tests, implementing the StoreAdapter, wiring the runner (Edge Function or GitHub Actions) and verifying the first run. Also use to diagnose an ingestion run that started dropping items.
argument-hint: [tienda o síntoma]
---

# RN Source Adapter — añadir o arreglar una fuente de precios

Tienda o síntoma: **$ARGUMENTS**

Referencia: [docs/domain/02-ingestion.md](../../../docs/domain/02-ingestion.md) ·
[`.claude/rules/ingestion.md`](../../rules/ingestion.md)

Añadir una tienda **no toca la app**. Es un adaptador, un runner y una fila en `store`.

---

## Modo A — Añadir una fuente nueva

### Paso 1. Investigar la fuente antes de escribir nada

Determinar, en este orden:

1. **¿Hay API?** Muchos retailers LATAM corren sobre VTEX, y su catálogo es consultable
   (`/api/catalog_system/pub/products/search`). Comprobarlo **primero**: ahorra todo el trabajo
   de scraping. Éxito es VTEX.
2. **¿Hay JSON embebido en el HTML?** (`__NEXT_DATA__`, `window.__INITIAL_STATE__`). Casi tan
   bueno como una API y mucho más estable que parsear el DOM.
3. **¿Hace falta navegador?** Solo si 1 y 2 fallan.
4. **¿Publica EAN?** Determina si las equivalencias serán automáticas o manuales
   ([ADR-0004](../../../docs/adr/0004-catalogo-y-equivalencias.md)).
5. **¿Precios por región o nacionales?** Define qué `region_code` escribe el adaptador.
6. **¿Qué dicen sus términos de uso y su `robots.txt`?** Se revisa antes de escribir el
   adaptador y se anota en su documento.

Registrar el hallazgo en `docs/domain/02-ingestion.md`, aunque la conclusión sea "no viable" —
como con Ara. Eso evita que alguien repita la investigación en seis meses.

### Paso 2. Capturar fixtures

**Antes** de escribir código de parseo: guardar respuestas reales en
`ingestion/adapters/__fixtures__/<slug>/`.

Capturar al menos: un producto simple, uno con descuento, uno por peso, uno con nombre sucio
(medida embebida, marca mezclada) y una página de resultados completa.

Las fixtures son el contrato con la fuente. Cuando cambie su formato, el test falla y señala
exactamente qué cambió.

### Paso 3. `normalize()` — función pura, con tests primero

Es donde está el trabajo real y donde se cometen los errores caros.

```ts
export function normalize(raw: RawExitoProduct): NormalizedProduct | null {
  // devuelve null si el ítem no es utilizable; nunca lanza
}
```

Resolver explícitamente:

| Problema | Qué hacer |
|---|---|
| Medida en el nombre (`"Arroz x 500g"`) | Extraer `unitValue: 500`, `unitMeasure: 'g'` |
| Unidades dispares (`0.5 kg` vs `500 g`) | Canonizar a la base (`g`, `ml`, `un`) |
| Marca mezclada en el nombre | Separar `brand` de `name` |
| Categoría propia de la tienda | Mapear a la taxonomía propia |
| Precio con formato (`"$ 4.200"`) | Entero COP |
| Empaque múltiple (`"x3 und"`) | `unitKind: 'unit'`, `unitValue: 3` |
| Dato ausente o ambiguo | **`null`. Nunca adivinar** |

Tests con las fixtures del paso 2, sin red. Esta función se prueba mejor que ninguna otra del
proyecto porque es pura.

### Paso 4. Implementar el adaptador

```ts
export const exitoAdapter: StoreAdapter = {
  storeSlug: 'exito',
  sourceType: 'api',
  regions: ['BOG', 'MDE', 'NACIONAL'],
  async *fetchCatalog(region, ctx) { /* pagina e itera */ },
  normalize,
}
```

- `AsyncIterable`, nunca array.
- Paginación con límite de concurrencia y pausa entre peticiones.
- Backoff ante 429/5xx; abortar antes que insistir.
- User-Agent identificable.
- Sin lógica de BD: de eso se encarga `core/pipeline.ts`.

### Paso 5. Conectar el runner

| Tipo de fuente | Runner |
|---|---|
| API / JSON embebido | Edge Function en `supabase/functions/` + `pg_cron` |
| Requiere navegador | Entrypoint en `ingestion/runners/node/` + job en `.github/workflows/ingest.yml` |

Escalonar el horario respecto a las demás tiendas. `SUPABASE_SERVICE_ROLE_KEY` desde secrets.

### Paso 6. Registrar la tienda

```sql
insert into store (slug, name, source_type, is_active)
values ('exito', 'Éxito', 'api', true);
```

Y el mapeo de sus categorías a la taxonomía propia.

### Paso 7. Verificar la primera corrida

Ejecutar en seco (sin escribir) y revisar:

- [ ] Número de productos coherente con el catálogo real de la tienda
- [ ] Precios en rango plausible (ninguno 0, negativo ni absurdo)
- [ ] `unitValue`/`unitMeasure` extraídos donde el nombre lo permitía
- [ ] Categorías mapeadas, no `null` masivo
- [ ] Tasa de descarte **< 20%**
- [ ] EAN presente si la fuente lo publica

Después, corrida real y comprobar que `current_price` se refrescó.

---

## Modo B — Diagnosticar una ingesta rota

Síntomas y causa habitual:

| Síntoma | Sospechoso |
|---|---|
| Tasa de descarte disparada | La fuente cambió su formato → comparar respuesta actual contra la fixture |
| Cero productos | Endpoint movido, anti-bot nuevo, o cambio de autenticación |
| Precios absurdos | Parseo de formato numérico (separador de miles leído como decimal) |
| Productos desaparecidos | ¿Se marcaron `is_available = false` o se borraron? Borrar es un bug |
| Corrida lenta o cortada | Falta paginación, falta backoff, o límite de tiempo de la Edge Function |
| `current_price` desactualizado | El refresh de la vista no corrió al final |

Procedimiento:

1. Leer el reporte de la última corrida buena y compararlo con la fallida.
2. Capturar una respuesta actual de la fuente y **diffearla contra la fixture**.
3. Arreglar `normalize()` y actualizar la fixture en el mismo commit.
4. Registrar la incidencia en [`known-issues.md`](../../rules/known-issues.md) con su ID.

---

## Salida esperada

```markdown
## Fuente: <tienda>

### Investigación
- **Tipo:** API VTEX | JSON embebido | scraping con navegador | no viable
- **Endpoint / URL:** ...
- **EAN disponible:** sí / no
- **Regiones:** ...
- **Términos de uso:** <qué dicen sobre acceso automatizado>

### Implementación
- Adaptador: [`ingestion/adapters/<slug>.ts`](...)
- Fixtures: <cuántas y qué cubren>
- Tests de normalize: <casos>
- Runner: Edge Function | GitHub Actions

### Primera corrida
| Métrica | Valor |
|---|---|
| Productos vistos | |
| Nuevos | |
| Precios cambiados | |
| Descartados | <n> (<%>) |
| Duración | |

### Limitaciones conocidas
- <qué campos no publica la fuente, qué queda en null y por qué>
```

## What NOT to do

- ❌ No escribas el parser antes de capturar fixtures.
- ❌ No adivines valores que la fuente no publica.
- ❌ No metas lógica de base de datos en el adaptador: eso es `core/pipeline.ts`.
- ❌ No cargues el catálogo completo en memoria.
- ❌ No borres `store_product` que desaparecieron: hay listas de usuarios apuntando a ellos.
- ❌ No subas el umbral de descarte del 20% para que una corrida rota "pase".
- ❌ No aumentes la frecuencia ni la concurrencia para "traer más rápido".
- ❌ No toques código de `src/` (la app) al añadir una fuente. Si hace falta, algo está mal
   diseñado.
- ❌ No metas `service_role` en nada que se empaquete en la app.
