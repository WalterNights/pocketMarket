# Pocket Market

App **solo móvil** (iOS + Android) para **planear el mercado y saber cuánto va a costar antes
de ir**.

Arma listas con productos reales de tiendas reales — Éxito, D1, Dollarcity — a precios
actualizados, y te dice cuánto necesitas: **total general y total por tienda**. Guarda listas
reutilizables con recordatorios semanales, quincenales o mensuales, y los precios se actualizan
solos mostrando cuánto cambió cada producto desde que lo agregaste.

No es una app de compra: no hay pago, pedido ni entrega. Es una calculadora de presupuesto de
mercado con precios reales.

> ⚠️ **Estado: arquitectura y dominio documentados. Sin código todavía.**

## Arquitectura en una imagen

```
Éxito (API VTEX)  ─► Edge Function + pg_cron  ─┐
                                                ├─► Supabase ─► App React Native
D1 / Dollarcity   ─► GH Actions + Playwright  ─┘   (catálogo)    (solo lectura)
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
| Trabajar con Claude Code aquí | [`CLAUDE.md`](CLAUDE.md) |

## Principios

1. La red es opcional, no garantizada.
2. La autorización vive en el servidor (RLS). El bundle es público.
3. El hilo de UI es sagrado.
4. La app no obtiene datos de las tiendas; los lee de Supabase.

## Pendiente antes de escribir código

- [ ] Inicializar el proyecto Expo y el repositorio git
- [ ] Crear el proyecto de Supabase (dev) y aplicar el modelo de datos
- [ ] Construir el adaptador de Éxito y verificar la primera corrida de ingesta
