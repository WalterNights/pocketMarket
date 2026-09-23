---
paths:
  - "ingestion/**"
  - "supabase/functions/**"
  - ".github/workflows/**"
---

# Reglas — Pipeline de ingesta de precios

Referencia completa: [docs/domain/02-ingestion.md](../../docs/domain/02-ingestion.md) ·
[ADR-0003](../../docs/adr/0003-ingesta-centralizada.md)

## Frontera con la app

- La app **nunca** importa de `ingestion/`. El pipeline **nunca** importa de `src/`.
- Lo único compartido son los schemas Zod de `ingestion/core/schemas.ts`, de los que la app
  puede derivar tipos.
- El pipeline escribe con `service_role`. La app no tiene política de escritura sobre el
  catálogo, y eso no se cambia.
- `SUPABASE_SERVICE_ROLE_KEY` vive en secrets de GitHub Actions o variables de Edge Function.
  **Jamás** en el bundle ni en `EXPO_PUBLIC_*`.

## Adaptadores

- Una tienda = un adaptador en `ingestion/adapters/<slug>.ts` que implementa `StoreAdapter`.
- `normalize()` es **pura**: entra el crudo, sale la forma canónica. Sin red, sin BD, sin
  estado. Se testea con fixtures.
- `fetchCatalog()` devuelve `AsyncIterable`, nunca un array. Los catálogos tienen decenas de
  miles de SKU y no caben en memoria.
- Toda salida de `normalize()` pasa por `normalizedProductSchema.parse()` antes de tocar la BD.
- **Fixtures obligatorias**: respuesta real guardada en `ingestion/adapters/__fixtures__/`.
  Cuando la fuente cambie su formato, el test falla y dice qué cambió.
- Añadir una tienda no debe requerir tocar `core/`. Si lo requiere, la interfaz está mal.

## Normalización

- Canonizar unidades a la base: `g`, `ml`, `un`.
- Separar `brand` de `name`.
- Mapear categorías de la fuente a la taxonomía propia.
- Precios a **entero COP**. Nunca float, nunca decimal.
- **Lo que no se puede determinar con confianza se guarda como `null`.** Nunca adivinar un
  `unitValue`: un precio por medida inventado es peor que no tenerlo.

## Escritura en base de datos

- `store_product`: upsert por `(store_id, external_id)`. Actualizar siempre `last_seen_at`.
- **Nunca borrar un `store_product`** — hay `list_item` apuntando. Ausente en 3 corridas →
  `is_available = false`.
- `price_snapshot`: insertar **solo si el precio cambió** respecto al último de ese
  `(store_product_id, region_code)`. Snapshots idénticos repetidos inflan la tabla sin informar.
- Al final de cada corrida: `refresh materialized view concurrently current_price`.
- Escribir por lotes, no fila a fila.

## Validación y cortes de seguridad

| Situación | Comportamiento obligatorio |
|---|---|
| La fuente no responde | Abortar esa tienda, conservar datos previos, reportar |
| **>20% de ítems descartados por validación** | **Abortar y alertar** — la fuente cambió de formato |
| Precio ≤ 0, o ×10 respecto al anterior | Descartar el ítem y reportar. No escribirlo |
| Corrida parcial | Guardar lo válido; `last_seen_at` distingue fresco de rancio |

El corte del 20% es lo que evita que un cambio de HTML se traduzca en precios falsos para el
usuario. No se elimina ni se sube "temporalmente".

## Comportarse bien con las fuentes

- Una corrida **al día** por tienda. Nada de bucles ni ráfagas.
- Concurrencia limitada y pausa entre peticiones.
- User-Agent identificable con forma de contacto.
- Respetar `robots.txt` y los términos de uso de la fuente.
- Backoff exponencial ante 429 y 5xx; abortar antes que insistir.
- `ETag` / `If-Modified-Since` donde la fuente lo soporte.
- Antes de añadir una fuente nueva se revisan sus términos y queda anotado en el documento del
  adaptador.

## Observabilidad

Toda corrida reporta: productos vistos, nuevos, precios cambiados, descartados por validación,
errores, y duración. Una corrida silenciosa es una corrida de la que no sabes nada.

## Qué NO hacer

- ❌ Scraping desde la app. Nunca, por ninguna razón.
- ❌ `service_role` en cualquier archivo bajo `src/`.
- ❌ Borrar filas de catálogo.
- ❌ Adivinar valores que la fuente no publica.
- ❌ Insertar snapshots sin comprobar si el precio cambió.
- ❌ Cargar el catálogo completo en memoria.
- ❌ Subir el umbral de descarte para que "pase" una corrida que falla.
