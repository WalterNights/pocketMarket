# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Qué es este proyecto

**Pocket Market** — app **solo móvil** (iOS + Android) para **planear el mercado y saber cuánto
va a costar antes de ir**.

El usuario arma listas con productos reales de tiendas reales (Éxito, D1, Dollarcity, Ara) a
precios actualizados, y la app le da **total general y total por tienda**. Guarda listas
reutilizables con recordatorios periódicos (semanal, quincenal, mensual) y los precios se
actualizan solos, mostrando la variación desde que se añadió cada producto.

**No es una app de compra:** no hay pago, pedido ni entrega. Es una calculadora de presupuesto
de mercado con precios reales.

> **Dos piezas, no una.** La *app* es 100% React Native y **solo lee** de Supabase. La ingesta
> de precios corre fuera del dispositivo (`ingestion/`, Edge Functions + GitHub Actions) y es lo
> único que escribe en el catálogo. Ver [ADR-0003](docs/adr/0003-ingesta-centralizada.md).

Dominio completo en [`docs/domain/`](docs/domain/). Leerlo antes de tocar modelo de datos o
ingesta.

## Stack

| Capa | Elección |
|---|---|
| Runtime | React Native 0.86 — New Architecture (Fabric + TurboModules + Bridgeless) |
| Framework | Expo SDK 57 con **CNG** (Continuous Native Generation) |
| React | 19.2 |
| Routing | `expo-router` v4 (file-based) |
| Server state | TanStack Query v5 + persister MMKV |
| Client state | Zustand v5 |
| Formularios | React Hook Form + Zod |
| Backend | Supabase (Postgres + RLS + Auth + Storage + Realtime + Edge Functions) |
| Listas | FlashList v2 |
| Animación | Reanimated + Gesture Handler |
| Estilos | NativeWind v4 + componentes de React Native Reusables ([ADR-0002](docs/adr/0002-estilos.md)) |
| Release | EAS Build / Submit / Update |

## Documentación de arquitectura — LEER ANTES DE CODIFICAR

Toda decisión estructural está documentada. **Consúltala antes de proponer cambios**, no después:

| Documento | Cuándo consultarlo |
|---|---|
| [00-index](docs/architecture/00-index.md) | Punto de entrada; stack y principio rector |
| [01-overview](docs/architecture/01-overview.md) | Capas y regla de dependencia. **Obligatorio** antes de crear archivos |
| [02-folder-structure](docs/architecture/02-folder-structure.md) | Dónde va cada archivo |
| [03-patterns](docs/architecture/03-patterns.md) | Catálogo de patrones y anti-patrones |
| [04-state-and-data](docs/architecture/04-state-and-data.md) | Estado, caché, offline |
| [05-navigation](docs/architecture/05-navigation.md) | Rutas, guards, deep links |
| [06-design-system](docs/architecture/06-design-system.md) | Tokens, theming, accesibilidad |
| [design/00-visual-direction](docs/design/00-visual-direction.md) | **Dirección visual**: minimalista, crema, sin sombras ni neón |
| [07-performance](docs/architecture/07-performance.md) | Presupuestos y técnicas |
| [08-security](docs/architecture/08-security.md) | Secretos, RLS, almacenamiento |
| [09-testing](docs/architecture/09-testing.md) | Qué se prueba y cómo |
| [10-release](docs/architecture/10-release.md) | EAS, OTA, stores |

### Dominio — LEER ANTES DE TOCAR DATOS O INGESTA

| Documento | Cuándo consultarlo |
|---|---|
| [00-overview](docs/domain/00-overview.md) | Casos de uso, tiendas, vocabulario. **Empezar aquí** |
| [01-data-model](docs/domain/01-data-model.md) | Tablas, relaciones, índices, RLS |
| [02-ingestion](docs/domain/02-ingestion.md) | Pipeline de precios y adaptadores de tienda |
| [03-reminders](docs/domain/03-reminders.md) | Recordatorios y sus límites en iOS/Android |

### Decisiones (ADR)

| ADR | Decisión |
|---|---|
| [0001](docs/adr/0001-stack-base.md) | Stack base — Expo CNG + Supabase + TanStack Query/Zustand |
| [0002](docs/adr/0002-estilos.md) | NativeWind v4 + React Native Reusables (port de shadcn/ui) |
| [0003](docs/adr/0003-ingesta-centralizada.md) | Ingesta centralizada, híbrida Edge Functions + GH Actions |
| [0004](docs/adr/0004-catalogo-y-equivalencias.md) | `store_product` como unidad; equivalencias opcionales |

## Reglas activas

`.claude/rules/` — cargadas por glob según el archivo que se toque:

| Regla | Ámbito |
|---|---|
| [react-native.md](.claude/rules/react-native.md) | Todo `.tsx` / `.ts` |
| [state-and-data.md](.claude/rules/state-and-data.md) | `features/**/api`, `hooks`, `store` |
| [ui-styling.md](.claude/rules/ui-styling.md) | `shared/ui/**`, `components/**` |
| [supabase.md](.claude/rules/supabase.md) | `supabase/**`, `features/**/api/**` |
| [ingestion.md](.claude/rules/ingestion.md) | `ingestion/**`, `supabase/functions/**`, workflows |
| [dependencies.md](.claude/rules/dependencies.md) | `package.json`, `pnpm-workspace.yaml`, `.npmrc` |
| [known-issues.md](.claude/rules/known-issues.md) | **Registro vivo — consultar siempre antes de implementar** |

## Skills

| Skill | Para qué |
|---|---|
| `rn-plan` | Producir un plan antes de implementar. **No escribe código.** |
| `rn-analyze` | Analizar código o arquitectura existente y reportar |
| `rn-review` | Revisar el diff pendiente contra los estándares del repo |
| `rn-perf-audit` | Auditar rendimiento móvil (TTI, listas, re-renders, animaciones) |
| `rn-implement` | Implementar siguiendo el plan y las reglas |
| `rn-source-adapter` | Añadir o arreglar la fuente de precios de una tienda |

Skills globales aplicables: `vet-dependency` (antes de instalar), `security-audit`,
`load-context`, `model-routing`.

## Comandos

**Gestor: pnpm, exclusivamente.** Ver [dependencies.md](.claude/rules/dependencies.md).

```bash
# Base de datos (Supabase local)
pnpm run db:start                # levantar Supabase local
pnpm run db:reset                # aplicar migraciones + seed desde cero
pnpm run db:test                 # tests pgTAP de RLS — OBLIGATORIO tras tocar políticas
pnpm run db:lint                 # linter de Supabase sobre el schema
pnpm run db:new <nombre>         # crear migración nueva
pnpm run db:types                # regenerar database.types.ts

# App
pnpm expo start                  # desarrollo
pnpm expo start --clear          # limpiar caché de Metro
pnpm expo prebuild --clean       # regenerar proyectos nativos (NO versionados)

# Calidad — gate obligatorio
pnpm run type-check              # tsc --noEmit
pnpm run lint                    # ESLint (0 warnings)
pnpm run format:check            # Prettier
pnpm test                        # Jest
pnpm run quality                 # los cuatro anteriores

# Release
eas build --profile development --platform all
eas build --profile production --platform all
eas update --branch production --message "..."
```

## Reglas duras del repositorio

Estas no se negocian caso a caso. Cambiarlas exige modificar antes la documentación.

1. **Regla de dependencia.** `app/ → features/ → shared/`. Nunca al revés, nunca entre features.
2. **`app/` es composición.** Cero fetch y cero lógica de negocio en archivos de ruta.
3. **`model/` es puro.** Sin React, sin red, sin `Platform.OS`. Ahí vive la lógica de negocio.
4. **Cero acceso directo a Supabase fuera de `features/**/api/`.** Siempre vía repositorio.
5. **Validar con Zod en toda frontera:** respuestas de red, params de ruta, deep links, env.
6. **Los cuatro estados** (loading / error / empty / data) en toda vista con datos remotos.
7. **Sin `any`.** Si es inevitable: `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- <razón>`.
8. **Nada sensible fuera de `expo-secure-store`.** Toda `EXPO_PUBLIC_*` es pública.
9. **RLS obligatoria** en toda tabla nueva, con política por operación y test de acceso denegado.
10. **Nunca editar `ios/` ni `android/`.** Son generados. Usa config plugins.
11. **Comentarios y código en inglés.** Documentación (`docs/`) y comunicación, en español.
12. **`pnpm run quality` en verde** antes de dar por terminado cualquier trabajo.
13. **La app nunca scrapea ni escribe catálogo.** Solo lee. La ingesta vive en `ingestion/` y
    escribe con `service_role`, que jamás entra en el bundle.
14. **`src/` e `ingestion/` no se importan entre sí.** Lo común son los schemas Zod de
    `ingestion/core/schemas.ts`.
15. **Dinero en `integer` COP.** Nunca float, nunca decimal. El peso colombiano no usa centavos.
16. **Nunca borrar un `store_product`.** Hay `list_item` apuntando: se marca `is_available`.
17. **Los totales se calculan en servidor**, no se guardan ni se suman en el cliente.
18. **pnpm exclusivamente.** Nunca `npm install` ni `yarn`: anula las defensas de
    `pnpm-workspace.yaml` (`allowBuilds`, `minimumReleaseAge`, `blockExoticSubdeps`).
19. **Ningún paquete ejecuta scripts de instalación** salvo entrada explícita y justificada en
    `allowBuilds`. Nunca `dangerouslyAllowAllBuilds`.
20. **Toda política RLS nueva lleva su test** en `supabase/tests/`. `pnpm run db:test` en verde.
21. **Vistas que tocan datos de usuario: `with (security_invoker = true)`.** Sin eso la vista
    corre como su dueño y salta RLS.

## Cómo trabajar aquí

- **Antes de implementar:** consultar [known-issues.md](.claude/rules/known-issues.md) y los
  documentos de arquitectura relevantes. Para cualquier cosa no trivial, usar `rn-plan` primero.
- **Antes de instalar una dependencia:** usar `vet-dependency`. En móvil una librería puede
  arrastrar código nativo y bloquear un upgrade de SDK — el coste no es solo el bundle.
- **Al resolver un problema nuevo y no evidente:** registrarlo en `known-issues.md` con su ID.
- **No commitear** salvo petición explícita.
- **Preguntar antes de cambiar** decisiones registradas en un ADR; la documentación se actualiza
  primero y el código después.
