# 10 — Build, release y actualizaciones

## CNG: qué significa para el día a día

Con **Continuous Native Generation**, `ios/` y `android/` **no se versionan**. Se generan con
`pnpm expo prebuild` a partir de `app.config.ts` y los config plugins.

Consecuencias prácticas:

- **Nunca edites `ios/` o `android/` a mano.** El cambio desaparece en la siguiente generación.
  Para tocar algo nativo: un **config plugin** (propio o de la librería).
- Si aparecen `ios/` o `android/` en un `git status`, algo se ejecutó de más: están en
  `.gitignore` a propósito.
- Los upgrades de SDK dejan de ser un merge manual de proyectos nativos.

## Perfiles de build (`eas.json`)

| Perfil | Para qué | Características |
|---|---|---|
| `development` | Desarrollo diario | `developmentClient: true`, dev menu, apunta a Supabase de dev |
| `preview` | QA y stakeholders | Build de release, distribución interna, entorno de staging |
| `production` | Stores | Optimizado, firmado con credenciales de release, entorno prod |

Cada perfil apunta a un **proyecto de Supabase distinto**. Nunca desarrollar contra la base de
datos de producción.

## Comandos habituales

```bash
pnpm expo start                        # bucle de desarrollo
pnpm expo start --clear                # cuando Metro miente sobre el caché

eas build --profile development --platform all
eas build --profile production --platform all
eas submit --profile production --platform ios

eas update --branch production --message "fix: ..."   # OTA
```

## EAS Update (OTA) — y su única regla

**Un update OTA solo puede cambiar JavaScript y assets.** No puede cambiar código nativo.

`runtimeVersion` es lo que evita servir un bundle JS a un binario incompatible: si el JS nuevo
usa un módulo nativo que la app instalada no tiene, la app **crashea al arrancar** y el usuario
no puede ni actualizar. Es el fallo más caro de este stack.

Política: `runtimeVersion: { policy: "fingerprint" }`. El fingerprint se calcula a partir de las
dependencias nativas reales, así que cambiar una dependencia nativa cambia el runtime y el OTA
deja de alcanzar a los binarios viejos — que es exactamente lo que debe pasar.

| Cambio | Se puede enviar por OTA |
|---|---|
| Texto, estilos, lógica JS, imágenes JS | ✅ |
| Nueva pantalla o feature en JS | ✅ |
| Hotfix de un bug de JS | ✅ |
| Añadir/actualizar una librería con código nativo | ❌ build nueva |
| Cambiar permisos, iconos, splash, deep link scheme | ❌ build nueva |
| Subir de versión de Expo SDK o RN | ❌ build nueva |

Canales: `production` y `preview`, alineados con los perfiles de build.

## Versionado

- **`version`** (`app.config.ts`) — semver visible al usuario: `1.4.0`. Se sube en cada release
  de store.
- **`buildNumber` / `versionCode`** — autoincremento gestionado por EAS (`autoIncrement: true`).
  No se tocan a mano.
- **Tag de git** por cada release de store: `v1.4.0`.

## Antes de subir a las stores

- [ ] `pnpm run type-check && pnpm run lint && pnpm test` en verde
- [ ] Checklist de seguridad de [08](08-security.md) completa
- [ ] Probado en dispositivo físico **iOS y Android**, build de release, no simulador
- [ ] Probado en modo claro y oscuro
- [ ] Probado sin red y con red intermitente
- [ ] Declaraciones de privacidad (App Privacy / Data Safety) actualizadas
- [ ] Permisos con cadenas de uso descriptivas y correctas
- [ ] Capturas y textos de la ficha al día
- [ ] Sentry configurado con la release correcta y source maps subidos
- [ ] `version` incrementada y tag de git creado
- [ ] Probada la ruta de actualización: instalar la versión anterior desde la store y actualizar
      encima (detecta migraciones de store persistido rotas)

## Rollback

| Situación | Acción |
|---|---|
| Bug de JS en producción | `eas update` con el fix, o republicar el update anterior en el canal |
| Bug nativo / crash al arrancar | Build nueva + envío urgente. Si iOS: *expedited review* |
| Release catastrófica | Detener el despliegue por fases en ambas stores |

De ahí que las features de riesgo vayan detrás de un **feature flag** leído en runtime: apagar
un flag es instantáneo; retirar un binario tarda días.

## CI (GitHub Actions)

Dos workflows, siguiendo el patrón de tus otros repos:

1. **`quality.yml`** — en cada push y PR: `type-check`, `lint`, `format:check`, `test`.
2. **`release.yml`** — manual o por tag: `eas build` + `eas submit`, y `eas update` para los
   hotfixes de JS.

Las credenciales viven en EAS y en secrets de GitHub (`EXPO_TOKEN`), nunca en el repo.
