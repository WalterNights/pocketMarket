# Pocket Market

App **solo móvil** (iOS + Android) para **planear el mercado y saber cuánto va a costar antes
de ir**.

Arma listas con productos reales de tiendas reales — Éxito, Olímpica, D1 y Supermú — a precios
actualizados, y te dice cuánto necesitas: **total general y total por tienda**. Guarda listas
reutilizables con recordatorios semanales, quincenales o mensuales, y los precios se actualizan
solos mostrando cuánto cambió cada producto desde que lo agregaste.

No es una app de compra: no hay pago, pedido ni entrega. Es una calculadora de presupuesto de
mercado con precios reales.

> **Estado:** unos 36.000 productos con precio de cuatro cadenas, cuentas, listas guardadas con
> avisos, mapa con las tiendas de 11 cadenas y navegación hasta ellas. Corre contra Supabase
> local; falta el proyecto en la nube para publicar. Detalle en [docs/ESTADO.md](docs/ESTADO.md).

## Arquitectura en una imagen

```
Éxito, D1, Olímpica (VTEX) ─┐
Supermú (Shopify)           ├─► ingestion/ (Node) ─► Supabase ─► App React Native
Sucursales de 11 cadenas    ─┘   service_role        (catálogo)    (solo lectura)
```

La app es 100% React Native y **solo lee**. La ingesta de precios corre fuera del dispositivo:
ver [ADR-0003](docs/adr/0003-ingesta-centralizada.md).

## Stack

React Native 0.86 (New Architecture) · Expo SDK 57 con CNG · React 19.2 · expo-router v4 ·
TanStack Query v5 + Zustand v5 · React Hook Form + Zod · Supabase (Postgres + RLS) ·
NativeWind v4 + React Native Reusables · FlashList v2 · Reanimated · EAS Build/Submit/Update

## Por dónde empezar

| Quiero… | Ir a |
|---|---|
| Entender **qué** construimos | [`docs/domain/00-overview.md`](docs/domain/00-overview.md) |
| Ver el modelo de datos | [`docs/domain/01-data-model.md`](docs/domain/01-data-model.md) |
| Entender la ingesta de precios | [`docs/domain/02-ingestion.md`](docs/domain/02-ingestion.md) |
| Entender **cómo** está construido | [`docs/architecture/00-index.md`](docs/architecture/00-index.md) |
| Saber dónde va un archivo | [`docs/architecture/02-folder-structure.md`](docs/architecture/02-folder-structure.md) |
| Ver la dirección visual | [`docs/design/00-visual-direction.md`](docs/design/00-visual-direction.md) |
| Ver las decisiones tomadas | [`docs/adr/`](docs/adr/) |
| Saber **dónde va el proyecto hoy** y cómo retomarlo | [`docs/ESTADO.md`](docs/ESTADO.md) |
| Ver cómo se llegó aquí, sesión a sesión | [`docs/BITACORA.md`](docs/BITACORA.md) |
| Generar un APK o publicar en Google Play | [`docs/guias/publicar-android.md`](docs/guias/publicar-android.md) |
| Trabajar con Claude Code aquí | [`CLAUDE.md`](CLAUDE.md) |

## Principios

1. La red es opcional, no garantizada.
2. La autorización vive en el servidor (RLS). El bundle es público.
3. El hilo de UI es sagrado.
4. La app no obtiene datos de las tiendas; los lee de Supabase.

## Arrancar en local

Requisitos: Node, pnpm (vía Corepack), Docker Desktop y un development build de EAS instalado en
el teléfono. Cada comando en su terminal:

```bash
pnpm install
pnpm run db:start                      # Supabase local (puertos 553xx)
pnpm run functions                     # Edge Functions (rutas del mapa)
pnpm expo start --dev-client --clear   # Metro
```

Detalle, variables de entorno y problemas conocidos en
[docs/ESTADO.md](docs/ESTADO.md#para-trabajar).
