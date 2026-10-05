# ADR-0008: Cadenas del MVP y lista de tiendas por cercanía

- **Fecha:** 2026-10-04
- **Estado:** Aceptada
- **Plan:** [0003](../plans/0003-mas-tiendas-mvp.md)

## Contexto

El MVP necesita **3 o 4 cadenas con precios**. Hasta ahora solo el Éxito tenía catálogo. El
resto de la lista estaba en "Próximamente", y la documentación daba por hecho que D1 exigía un
navegador.

El 2026-10-04 se investigaron las fuentes con peticiones reales:

- **D1, Olímpica, Jumbo y Carulla** publican su catálogo por la misma API pública de VTEX que
  el Éxito.
- **Supermú** (la antigua La Vaquita, de Medellín) usa Shopify y publica `/products.json`.
- **La Vaquita Express** usa Magento con GraphQL público.
- **Ísimo** solo publica un folleto PDF de ofertas.
- **Dollarcity** no tiene catálogo online.
- **Mercado Madrid** no respondió.

Dos restricciones mandan:

1. **Espacio.** El plan gratuito de Supabase da 500 MB, y cada cadena suma histórico de precios
   ([presupuesto](../domain/02-ingestion.md#presupuesto-de-almacenamiento)).
2. **Una lista fija de 11 cadenas no sirve a nadie.** Supermú solo existe en Medellín y el
   Éxito no está en todos los pueblos.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| Todas las cadenas con API (7) | Más cobertura | ~2× el espacio; más superficie de clasificación por revisar |
| **4 cadenas: Éxito, D1, Olímpica, Supermú** | Las tres nacionales más presentes y una regional probada; cabe en el presupuesto | Jumbo y Carulla esperan aunque son baratas de añadir |
| Lista de tiendas por ciudad, mantenida a mano | Simple | Se queda vieja; hay que mantener "qué cadena hay dónde" |
| **Lista por cercanía a partir de `store_branch`** | Sale sola de las sucursales que ya se cargan cada mes | Una consulta más en el servidor |

## Decisión

- **Con precios:** Éxito, D1, Olímpica y Supermú. Las tres VTEX comparten un adaptador genérico
  (`ingestion/adapters/vtex-catalog.ts`). Supermú tiene uno de Shopify. Todas con precio
  `NACIONAL`.
- **Solo en el mapa** ("Próximamente" en la lista): Jumbo, Carulla, La Vaquita Express, Ísimo,
  Mercado Madrid, Dollarcity y Ara.
- **Sucursales**:
  - de la fuente cuando la fuente las publica;
  - de un **archivo curado** en el repo para las cadenas pequeñas (con su URL de origen y la
    fecha de verificación);
  - **geocodificadas con Nominatim** (OpenStreetMap, 1 petición/s, con caché) para Ísimo, que
    publica direcciones sin coordenadas. Una dirección que no se resuelve con seguridad se
    descarta; nunca se adivina. "Con seguridad" significa una de tres cosas:
    1. un edificio cuya placa coincide con la dirección;
    2. la esquina de la vía con su vía de cruce, cuando es una sola;
    3. una calle entera que cabe en 300 m (pueblos pequeños), lo que deja el pin a menos de
       150 m.

    Además, si el nombre de la calle se repite en otro poblado del mismo municipio (una
    vereda con su propia "Calle 4"), la tienda se descarta salvo que su nombre o dirección
    diga cuál es. En las ciudades esta regla no se aplica, porque una calle larga llega partida
    en trozos y descartaría casi todo; el riesgo aceptado es un barrio con numeración propia.

    El municipio tiene que coincidir exactamente. Con estas reglas entra menos de la mitad de
    las tiendas de Ísimo; es el coste aceptado de no dibujar ninguna en la manzana equivocada.
- **La lista de inicio se ordena por cercanía**: `stores_near(lat, lng)` devuelve las cadenas
  con alguna sucursal a ≤ 25 km, primero las que tienen precios. Sin origen se ven todas. La
  app nunca pide la ubicación desde la lista.
- **El origen se comparte** entre la lista y el mapa. Entre aperturas solo se recuerda el
  **código de ciudad** elegido, nunca la posición.

## Consecuencias

- **Positivas:**
  - 4 cadenas con precios.
  - Activar Jumbo o Carulla es una configuración y un `update` de `is_active`.
  - La lista se adapta sola a la ciudad.
- **Negativas:**
  - La retención de `price_snapshot` ([plan 0002](../plans/0002-cron-de-ingesta-diaria.md))
    pasa a ser requisito antes del Supabase remoto.
  - Olímpica puede variar precios por ciudad y se guarda como nacional, la misma deuda que el
    Éxito.
  - Nominatim es un servicio de terceros con política de uso: una corrida al mes, lenta y
    con atribución a OpenStreetMap.
- **Qué invalidaría esta decisión:**
  - Que la base supere ~70% del límite antes de tener retención.
  - Que una cadena VTEX empiece a exigir sesión o canal de venta para responder.
