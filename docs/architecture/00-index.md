# Arquitectura — Pocket Market

> Documento raíz de arquitectura. Todo lo que Claude y tú necesitan para tomar decisiones
> consistentes en este repo. Si una decisión contradice algo aquí, se cambia este documento
> primero (vía ADR), no el código.

## Stack fijado

| Capa | Elección | Versión objetivo |
|------|----------|------------------|
| Runtime | React Native (New Architecture: Fabric + TurboModules + Bridgeless) | 0.86 |
| Framework | Expo SDK con **CNG** (Continuous Native Generation) | 57 |
| React | React | 19.2 |
| Routing | `expo-router` (file-based, convenciones App Router) | v4 |
| Server state | TanStack Query + persister MMKV | v5 |
| Client state | Zustand (slices) | v5 |
| Formularios | React Hook Form + Zod | — |
| Backend | Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions) | — |
| Estilos | NativeWind + React Native Reusables | v4 |
| Listas | FlashList | v2 |
| Animación | Reanimated + Gesture Handler | v4 / v2 |
| Build & release | EAS Build / Submit / Update | — |
| Plataformas | iOS + Android, publicación en stores | — |

## Índice

| # | Documento | Qué resuelve |
|---|-----------|--------------|
| 01 | [Visión general y capas](01-overview.md) | Regla de dependencia, qué es "mobile-first de verdad" |
| 02 | [Estructura de carpetas](02-folder-structure.md) | Dónde va cada archivo y por qué |
| 03 | [Patrones de diseño](03-patterns.md) | Catálogo de patrones aplicables y anti-patrones |
| 04 | [Estado y datos](04-state-and-data.md) | TanStack Query, Zustand, offline-first, caché |
| 05 | [Navegación](05-navigation.md) | expo-router, deep links, estado de navegación |
| 06 | [Design system](06-design-system.md) | Tokens, theming, accesibilidad, componentes base |
| — | [Dirección visual](../design/00-visual-direction.md) | Estética: minimalista, crema, sin sombras ni neón |
| 07 | [Rendimiento](07-performance.md) | TTI, listas, re-renders, animaciones, medición |
| 08 | [Seguridad](08-security.md) | Secretos, RLS, almacenamiento seguro, deep links |
| 09 | [Testing](09-testing.md) | Pirámide de test en RN, qué se testea y qué no |
| 10 | [Release](10-release.md) | EAS, OTA, runtimeVersion, versionado, stores |

## Dominio

La arquitectura de arriba es el *cómo*. El *qué* vive en [`docs/domain/`](../domain/):

| Documento | Contenido |
|---|---|
| [00-overview](../domain/00-overview.md) | Qué es la app, casos de uso, tiendas y vocabulario |
| [01-data-model](../domain/01-data-model.md) | Tablas, relaciones, índices, RLS |
| [02-ingestion](../domain/02-ingestion.md) | Pipeline de precios y adaptadores de tienda |
| [03-reminders](../domain/03-reminders.md) | Recordatorios periódicos y sus límites en iOS/Android |

## Decisiones (ADR)

Las decisiones con consecuencias estructurales se registran en [`docs/adr/`](../adr/).
Formato: [`0000-template.md`](../adr/0000-template.md).

| ADR | Decisión |
|---|---|
| [0001](../adr/0001-stack-base.md) | Stack base — Expo CNG + Supabase + TanStack Query/Zustand |
| [0002](../adr/0002-estilos.md) | NativeWind v4 + React Native Reusables (port de shadcn/ui) |
| [0003](../adr/0003-ingesta-centralizada.md) | Ingesta de precios centralizada, híbrida |
| [0004](../adr/0004-catalogo-y-equivalencias.md) | `store_product` como unidad; equivalencias opcionales |

## Principio rector

> **La app es un cliente offline-capable de una base de datos que no controla el dispositivo.**

Cuatro consecuencias que atraviesan todo el repo:

1. **La red es opcional, no garantizada.** Toda lectura debe poder servirse de caché y toda
   escritura debe tolerar fallo y reintento. Ver [04](04-state-and-data.md).
2. **La autorización vive en el servidor.** El cliente es público y auditable: cualquiera puede
   leer el bundle. Las políticas RLS son la única frontera real. Ver [08](08-security.md).
3. **El hilo de UI es sagrado.** 60/120 fps no se negocian; el trabajo pesado va fuera del JS
   thread o fuera del render. Ver [07](07-performance.md).
4. **La app no obtiene datos de las tiendas; los lee de Supabase.** La ingesta de precios es
   centralizada y la app no tiene permiso de escritura sobre el catálogo. Ver
   [ADR-0003](../adr/0003-ingesta-centralizada.md) y [domain/02](../domain/02-ingestion.md).
