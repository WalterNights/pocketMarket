# Plan 0002 — Cron diario de ingesta

**Estado:** pendiente, sin empezar · **Complejidad:** media
**Escrito:** 2026-09-24 · **Bloqueado por:** una decisión que contradice a [ADR-0003](../adr/0003-ingesta-centralizada.md)

---

## Qué se pide

Que la base se actualice sola con los productos de la API **una vez al día**, sin que nadie
lance nada a mano.

## ⚠️ El ADR dice una cosa y los datos dicen otra

[ADR-0003](../adr/0003-ingesta-centralizada.md) decidió:

> **Supabase Edge Functions (Deno) + `pg_cron`** para fuentes con API JSON → Éxito.
> **GitHub Actions (cron) + Playwright** para fuentes que exigen navegador → D1, Dollarcity.

Ese ADR se escribió **antes de saber cuánto tarda una corrida**. La medición real del
2026-09-24: **27.217 productos vistos en 1.370 segundos (23 minutos)**.

Una Edge Function no dura 23 minutos. El límite de ejecución está muy por debajo, así que
**la decisión del ADR no se puede implementar tal cual**. Hay que elegir antes de escribir
código, y **la documentación se actualiza primero** (regla del repo: no contradecir un ADR en
silencio).

### Opción A — GitHub Actions también para Éxito

Un solo entorno de ejecución en vez de dos, y reutiliza el runner de Node que **ya existe y ya
funciona** (`ingestion/runners/node/ingest.ts`). No hace falta portar nada a Deno.

- ✅ Cero trabajo nuevo de portado; se prueba en local exactamente igual
- ✅ Sin límite de tiempo problemático (el tope de un job son 6 horas)
- ⚠️ Consume minutos de GitHub Actions: ~23 min/día ≈ **700 min/mes**. En repo privado el free
  tier son 2.000 min/mes, así que cabe, pero conviene confirmarlo
- ❌ Se aparta del ADR

### Opción B — Trocear la corrida en Edge Functions

Una invocación por subcategoría (son 14), encadenadas por `pg_cron`. Cada trozo dura ~100 s.

- ✅ Respeta el ADR
- ✅ No gasta minutos de Actions, y el cron mantiene despierto el proyecto free
- ❌ Hay que **portar el pipeline a Deno** y mantener dos entornos
- ❌ Reintentos y estado parcial se vuelven más complicados: si el trozo 9 falla, hay que saber
  reanudar sin repetir los 8 anteriores

**Recomendación:** empezar por la **A**, que reutiliza lo que ya funciona, y anotar en el ADR
por qué. Cuando entren D1 y Dollarcity ya harán falta Actions de todos modos, así que la
"ventaja" de tener un solo entorno acaba estando del lado de A.

## Qué hay que hacer, decidida la opción

**Workflow**
- [ ] `.github/workflows/ingest.yml`
  - `schedule: cron` diario en horario de baja demanda en Colombia (COT = UTC−5; por ejemplo
    `0 7 * * *` son las 02:00 en Colombia)
  - `workflow_dispatch` también, para poder lanzarlo a mano sin esperar al día siguiente
  - `concurrency` con `cancel-in-progress: false` — **dos corridas simultáneas no pueden
    pasar**: escribirían el mismo catálogo a la vez
  - `timeout-minutes` generoso pero finito (45), para que un cuelgue no consuma minutos toda
    la noche
  - Corepack activado, para que use la versión de pnpm de `packageManager`
  - `pnpm install --frozen-lockfile` — nunca resolver versiones nuevas en CI

**Secretos**
- [ ] `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como secretos del repositorio
- [ ] Verificar que el workflow **no** se dispara desde forks ni desde pull requests: un PR con
      acceso a `service_role` es una llave al catálogo entero
- [ ] Nada de `echo` de variables de entorno en los pasos

**Observabilidad — una corrida silenciosa es una corrida de la que no sabes nada**
- [ ] Escribir el informe (`vistos`, `escritos`, `agotados`, `ilegibles`, duración) en el
      *summary* del job, no solo en el log
- [ ] ⚠️ **No canalizar la salida del runner.** El runner ya sale con código 1 al abortar
      ([`ingest.ts:82`](../../ingestion/runners/node/ingest.ts#L82)), pero un `| tail` o
      `| head` devuelve el código de *esa* orden, no el del runner. Comprobado: una corrida
      abortada se reporta como `exited with code 0` en cuanto se canaliza. En el workflow, o
      no se canaliza, o se usa `set -o pipefail`. Sin esto el cron falla en silencio, que es
      exactamente lo que un cron no debe hacer
- [ ] Decidir cómo llega el aviso de fallo (el email de GitHub Actions puede bastar)

**Retención — sin esto la base se llena**
- [ ] Job mensual de `pg_cron` que aplique la política ya documentada en
      [02-ingestion.md](../domain/02-ingestion.md#retención-del-histórico): todos los snapshots
      < 90 días; > 90 días, solo el primero y el último de cada mes por producto y región.
      **Nunca se borra el snapshot más reciente.**
  Sin esto el free tier de 500 MB se agota: `price_snapshot` crece de forma lineal.

**Documentación**
- [ ] Actualizar ADR-0003 con la decisión que se tome y **por qué** — la medición de los 23
      minutos es el dato nuevo que la justifica

## Lo que ya está resuelto y no hay que volver a hacer

El runner es idempotente y seguro para correr a diario sin supervisión:

- Publica lo escrito **aunque aborte a medias** (`ING-007`), y de forma progresiva cada 1.000
  precios, así que una corrida cortada no deja la app a oscuras
- Distingue "agotado" de "ilegible", de modo que el umbral del 20% solo salta cuando la fuente
  cambia de formato de verdad (`ING-004`)
- Reintenta con backoff ante 429 y 5xx, y descarta la página, nunca la corrida (`ING-003`)
- Solo inserta un `price_snapshot` **si el precio cambió**
- Deduplica por `external_id` antes de escribir
- Es educado con la fuente: una corrida al día, concurrencia 1, pausa de 1.200 ms, User-Agent
  identificable con contacto

## Efecto secundario que conviene recordar

El free tier de Supabase **pausa un proyecto tras una semana sin actividad**. El cron diario lo
mantiene despierto sin que haya que hacer nada más. Si algún día se quita el cron, hay que
acordarse de esto.

## Fuera de alcance

- D1 y Dollarcity: necesitan Playwright y su propio adaptador. Ara no tiene catálogo online.
- Ingesta más frecuente que diaria. Los precios de mercado no cambian por hora, y sería
  maleducado con la fuente.
