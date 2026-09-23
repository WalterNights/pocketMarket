# ADR-0001: Stack base — Expo CNG + Supabase + TanStack Query/Zustand

- **Fecha:** 2026-09-22
- **Estado:** Aceptada — matizada por [ADR-0003](0003-ingesta-centralizada.md)

> **Matiz posterior (2026-09-22).** Al definirse el dominio, quedó claro que obtener precios de
> las tiendas no puede ocurrir en el cliente. Existe por tanto un **pipeline de ingesta** fuera
> de la app (Edge Functions + GitHub Actions). "Sin backend propio" sigue siendo cierto en el
> sentido de que no hay servidor de API que mantener, pero el proyecto **no es únicamente
> React Native**: la app sí lo es. Ver [ADR-0003](0003-ingesta-centralizada.md).

## Contexto

Aplicación **solo móvil** (iOS + Android, publicación en stores), proyecto personal, un único
desarrollador con experiencia previa en React, Next, Nest, Angular y Python, pero sin base
instalada en React Native. Prioridad: llegar a producción sin mantener infraestructura.

Restricciones:
- Un solo desarrollador → el tiempo dedicado a infraestructura no se dedica a producto.
- Publicación en stores → hacen falta builds firmadas, revisión de privacidad y capacidad de
  hotfix sin esperar a la revisión.
- Sin equipo de backend → la autorización debe ser declarativa y auditable, no código a mantener.

## Opciones consideradas

| Eje | Elegida | Alternativas descartadas |
|---|---|---|
| Toolchain | **Expo SDK 57 + CNG** | Expo bare (mantener `ios/`+`android/`); RN CLI puro |
| Backend | **Supabase** | Firebase; API NestJS propia; solo local |
| Server state | **TanStack Query** | RTK Query; fetch a mano |
| Client state | **Zustand** | Redux Toolkit; Context; Legend-State |

## Decisión

**Expo con CNG.** El coste de mantener los proyectos nativos en git no compra nada mientras no
haya código nativo propio; los config plugins cubren la personalización, y EAS aporta build
firmada, submit y OTA sin montar CI nativo. Los upgrades de SDK dejan de ser merges manuales.

**Supabase.** Postgres relacional (el modelo que ya dominas por Prisma) con autorización
declarativa vía RLS, que es la propiedad decisiva: la seguridad vive en la base de datos y no en
un servidor que habría que escribir y mantener. Descartamos Firebase por el modelo NoSQL y por
los costes por lectura, que penalizan justo los patrones de lista y sincronización que esta app
va a usar. Descartamos API propia por coste de mantenimiento para un solo desarrollador.

**TanStack Query + Zustand.** Separan server state de client state, que es la distinción que
más código ahorra. TanStack Query ya trae caché, deduplicación, reintentos, persistencia offline
y modo `offlineFirst` — exactamente los requisitos de [01](../architecture/01-overview.md).
Redux Toolkit resolvería lo mismo con más boilerplate y bundle; Zustand con selectores da
suscripción granular, que en móvil importa por re-renders.

## Consecuencias

**Positivas**
- OTA para hotfixes de JS: minutos en vez de días de revisión.
- Cero backend que mantener, desplegar o parchear.
- Un solo modelo mental de datos: caché de Query + slices de Zustand.
- Tipos de la BD generados, extremo a extremo.

**Negativas (aceptadas)**
- **Dependencia de dos proveedores** (Expo/EAS y Supabase). Mitigación: Supabase es Postgres
  estándar y autoalojable; Expo con CNG puede `prebuild` a proyectos nativos en cualquier momento.
- **La seguridad depende por completo de escribir bien las políticas RLS.** Mitigación: regla
  dura de RLS obligatoria + tests de acceso denegado ([08](../architecture/08-security.md)).
- **Lógica de servidor limitada a Edge Functions (Deno).** Si aparece trabajo pesado o de larga
  duración, este ADR se reabre.
- Añadir una librería con código nativo obliga a build nueva, no basta OTA.

**Qué invalidaría esta decisión**
- Necesidad de trabajo en servidor de larga duración, colas o cron complejos → backend propio.
- Costes de Supabase desproporcionados al crecer → migración a Postgres autoalojado (el SQL es
  portable; el SDK de auth no).
- Requisito de un módulo nativo propio significativo → evaluar Expo bare.
