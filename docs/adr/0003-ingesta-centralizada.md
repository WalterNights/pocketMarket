# ADR-0003: Ingesta de precios centralizada, híbrida Edge Functions + GitHub Actions

- **Fecha:** 2026-09-22
- **Estado:** Aceptada
- **Relacionado:** matiza [ADR-0001](0001-stack-base.md) ("sin backend propio")

## Contexto

La app necesita precios actualizados de Éxito, D1, Dollarcity y Ara. Las fuentes son desiguales:

| Tienda | Fuente | Naturaleza |
|---|---|---|
| Éxito | VTEX, API de catálogo (`/api/catalog_system/pub/products/search`) | JSON estructurado |
| D1 | `tiendasd1.com`, tienda online con domicilios | Requiere navegador |
| Dollarcity | `dollarcity.com/co`, catálogo online | Requiere navegador |
| Ara | Sin tienda online; solo app con folletos | Sin catálogo estructurado |

La pregunta de fondo: ¿la obtención de datos ocurre en el cliente o en el servidor?

## La opción descartada de entrada: scraping en el cliente

Sería "más full React Native", y es inviable:

1. **Multiplica la carga por usuario.** 1.000 instalaciones = 1.000 clientes golpeando la tienda.
   Eso es indistinguible de un ataque y se gana un bloqueo.
2. **La IP bloqueada es la del usuario**, no la nuestra.
3. **Batería y datos móviles.** Parsear catálogos de decenas de miles de SKU en el dispositivo
   es exactamente lo que [07-performance.md](../architecture/07-performance.md) prohíbe.
4. **Fragilidad sincronizada.** El día que una tienda cambia su markup, se rompen todas las
   instalaciones a la vez y el arreglo depende de que cada usuario actualice.
5. **Anti-bot.** Los retos de JavaScript y Cloudflare no se resuelven desde React Native.
6. **Datos inconsistentes.** Cada usuario vería su propio parseo, con sus propios errores.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| **Híbrido: Edge Functions + GitHub Actions** | Cero infraestructura; gratis; cada fuente en el entorno que le corresponde | Dos entornos de ejecución que mantener |
| Todo en Edge Functions | Un solo entorno (Deno) | Sin Chromium y con límite de tiempo: no sirve para D1 ni Dollarcity |
| Worker propio (Node/Python + Playwright) | Control total: proxies, colas, reintentos | Un servicio más con deploy, monitorización y coste fijo |
| Servicio gestionado (Apify) | Sin mantener scrapers | Coste mensual; dependencia de un tercero para el dato central del producto |

## Decisión

**Ingesta centralizada, híbrida:**

- **Supabase Edge Functions (Deno) + `pg_cron`** para fuentes con API JSON → Éxito.
- **GitHub Actions (cron) + Playwright** para fuentes que exigen navegador → D1, Dollarcity.
- Ambos escriben con `service_role`. La app lee con la clave `anon` bajo RLS y **no tiene
  ninguna política de escritura sobre el catálogo**.

El pipeline vive en el **mismo repositorio**, en `ingestion/`, porque los schemas Zod del
producto normalizado se comparten con la app. Dos repos obligarían a duplicarlos o a publicar
un paquete interno, y ese coste no se justifica con un solo desarrollador.

GitHub Actions es la pieza que cierra la decisión: da cron y un runner con Chromium sin
levantar ni pagar un servidor. Para una cadencia diaria es más que suficiente.

## Consecuencias

**Positivas**
- La app sigue siendo 100% React Native: no ejecuta ingesta, solo lee.
- Una sola copia de los datos, normalizada e igual para todos los usuarios.
- Una tienda que cambia su formato se arregla en un sitio, sin release de app.
- Respeta a las fuentes: una corrida al día, con rate limiting, en vez de N clientes.
- El histórico de precios se acumula en servidor y habilita tendencias y variación.

**Negativas (aceptadas)**
- **"Full React Native" aplica a la app, no al proyecto entero.** Hay código TypeScript de
  pipeline que no corre en el dispositivo. Es la consecuencia inevitable del dominio.
- Dos entornos de ejecución (Deno y Node) con diferencias sutiles de API.
- Los scrapers son frágiles por naturaleza: cada cambio de la fuente exige mantenimiento.
- Los precios son de la última corrida, no en tiempo real. La UI lo declara.
- Dependencia de los minutos gratuitos de GitHub Actions.

**Qué invalidaría esta decisión**
- Necesidad de ingesta más frecuente que diaria, o de muchas más tiendas → worker dedicado.
- Bloqueo sistemático de los runners de GitHub por parte de las fuentes → proxies y worker propio.
- Que Ara u otra fuente exija procesamiento pesado (OCR de folletos) → servicio aparte.

## Nota sobre las fuentes

La app muestra precios **publicados** por las tiendas como referencia para presupuestar, y lo
declara explícitamente en la UI. El pipeline se comporta como un cliente respetuoso: una corrida
diaria, concurrencia limitada, `robots.txt` respetado, User-Agent identificable y backoff ante
429. Antes de añadir cada fuente se revisan sus términos de uso; queda registrado en el
documento del adaptador correspondiente.
