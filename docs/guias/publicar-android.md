# Guía: instalar la app como APK y publicarla en Google Play

> Qué hace falta y qué pasos seguir para dos metas distintas:
>
> - **A. Un APK** que se instala directo en un teléfono Android, sin tienda.
> - **B. Publicar en Google Play.**
>
> La configuración de builds está en [`eas.json`](../../eas.json) y la explicación general en
> [10-release](../architecture/10-release.md). Escrita el 2026-10-05; las reglas de Google
> cambian, así que lo marcado con ⚠️ se confirma en la consola antes de darlo por cierto.

---

## Antes de todo: lo que hoy bloquea las dos metas

La app que usamos ahora es un **development build**: necesita el PC encendido con Metro, y sus
datos salen de un Supabase que corre **en el PC**. Un APK "de verdad" no tiene ninguna de las
dos cosas. Antes de generarlo hay que resolver esto:

| # | Requisito | Por qué | Estado |
|---|---|---|---|
| 1 | **Supabase en la nube** (proyecto remoto) | El teléfono no puede depender del PC de casa. Además, Android bloquea el tráfico `http://` sin cifrar en las builds de publicación, y el Supabase local es `http://` | ❌ pendiente |
| 2 | **Migraciones, función de rutas y datos** subidos a ese proyecto | Sin tablas ni catálogo la app abre vacía | ❌ pendiente |
| 3 | **Variables de entorno en EAS** | El archivo `.env` no se sube a EAS (está en `.gitignore`), y las `EXPO_PUBLIC_*` se incrustan al compilar | ❌ pendiente |
| 4 | **Retención de precios** antes de cargar el catálogo en la nube | El plan gratuito da 500 MB ([ADR-0008](../adr/0008-cadenas-del-mvp.md)) | ❌ pendiente ([plan 0002](../plans/0002-cron-de-ingesta-diaria.md)) |

Los pasos 1 a 3 están detallados abajo. El 4 es trabajo de desarrollo aparte.

### Paso 1 — Crear el proyecto de Supabase

1. Entrar en <https://supabase.com>, crear un proyecto (región recomendada: São Paulo o Este de
   EE. UU.) y guardar la contraseña de la base.
2. En *Project Settings → API* anotar la **URL** del proyecto y la clave **anon**. La clave
   `service_role` no se copia a ningún archivo de la app: solo la usa la ingesta.

### Paso 2 — Subir el esquema, la función y los datos

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <ref-del-proyecto>
pnpm exec supabase db push                      # aplica las migraciones
pnpm exec supabase functions deploy route       # función de rutas del mapa
pnpm exec supabase secrets set ORS_API_KEY=<key de OpenRouteService>
```

El nombre exacto del secreto es el que lee `supabase/functions/route/index.ts`; el valor es el
mismo que hoy está en `supabase/functions/.env`.

Después, cargar el catálogo y las sucursales apuntando al proyecto remoto (las dos variables
salen de *Project Settings → API*):

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> pnpm run ingest -- --store all
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<service_role> pnpm run branches -- --store all
```

### Paso 3 — Variables de entorno en EAS

Las dos variables públicas de la app se guardan en EAS, una vez por entorno (`preview` para el
APK, `production` para Google Play):

```bash
pnpm dlx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<ref>.supabase.co --visibility plaintext
pnpm dlx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value <clave anon> --visibility plaintext
```

Repetir con `--environment production`. Para que cada perfil use su entorno, añadir
`"environment": "preview"` y `"environment": "production"` a los perfiles de `eas.json`.

Son valores públicos por diseño: lo que protege los datos es RLS, no esconder la clave anon
([08-security](../architecture/08-security.md)).

---

## A. Generar un APK para instalar directo

Un APK del perfil **`preview`** es la app completa: no necesita Metro ni el PC.

```bash
pnpm dlx eas-cli@latest build --profile preview --platform android
```

1. La build corre en la nube (10 a 20 minutos). Al terminar, EAS muestra un enlace y un QR.
2. Abrir el enlace desde el teléfono y descargar el `.apk`.
3. Android pedirá permitir "instalar apps desconocidas" para el navegador: aceptarlo.
4. Si Play Protect avisa de que no conoce la app, elegir "Instalar de todos modos". Es normal en
   una app que no viene de la tienda.

**Para compartirlo** con otra persona basta el mismo enlace (o el archivo). No hay límite de
dispositivos en Android.

**Diferencias con el development build de hoy:**

| | Development build | APK `preview` |
|---|---|---|
| Necesita Metro y el PC | Sí | No |
| De dónde lee los datos | Lo que diga el `.env` del PC | Lo que se guardó en EAS al compilar |
| Para cambiar el código | Recargar | Build nueva (o una actualización OTA) |
| Menú de desarrollador | Sí | No |

---

## B. Publicar en Google Play

### B1. Lo que hay que tener

| Requisito | Detalle |
|---|---|
| **Cuenta de desarrollador de Google Play** | Pago único de 25 USD en <https://play.google.com/console>. Pide verificar identidad |
| ⚠️ **Prueba cerrada obligatoria** | Las cuentas **personales** nuevas deben hacer una prueba cerrada con testers reales durante 14 días seguidos antes de poder publicar en producción (12 testers según la regla vigente al escribir esto). Hay que planearlo: son dos semanas mínimas |
| **Política de privacidad** en una URL pública | Obligatoria: la app crea cuentas y usa la ubicación |
| **Eliminar la cuenta** | Google exige que una app con cuentas permita borrarla **desde la app** y desde un enlace web. ❌ **La app todavía no lo tiene** |
| **Icono para la ficha** | 512 × 512 px. El logo ya está en la app; el original mide 273 × 306 px, así que conviene tenerlo en vectorial o más grande para la ficha |
| **Gráfico destacado** | 1024 × 500 px |
| **Capturas de pantalla** | Mínimo 2 de teléfono |
| **Textos de la ficha** | Nombre (30 caracteres), descripción corta (80) y descripción completa |

### B2. Lo que hay que declarar en la consola

- **Seguridad de los datos.** Lo que la app recoge de verdad:
  - correo electrónico, para la cuenta;
  - las listas y avisos que el usuario guarda;
  - ubicación, **solo en el dispositivo**: se usa para buscar tiendas cercanas y trazar rutas,
    y no se guarda.

  Ojo con la ubicación: al pedir tiendas cercanas o una ruta, las coordenadas **viajan** al
  servidor (Supabase y, para las rutas, OpenRouteService). Eso se declara como dato "recogido,
  no almacenado" o equivalente; no se puede marcar como que nunca sale del teléfono.
- **Permisos.** Ubicación en primer plano y notificaciones. No se usa ubicación en segundo
  plano, lo que evita la revisión más estricta de Google.
- **Clasificación de contenido**: cuestionario (la app no tiene contenido sensible).
- **Público objetivo**: adultos; no está dirigida a menores.
- **Anuncios**: no tiene.

La declaración tiene que coincidir con lo que hace la app. Una declaración desalineada es
motivo de retirada.

### B3. Atribuciones que deben verse en la app

- Mapa: **© OpenStreetMap contributors** y OpenFreeMap (el mapa ya muestra la atribución;
  comprobar que sigue visible).
- Rutas: OpenRouteService.
- Las tiendas de Ísimo se ubicaron con datos de OpenStreetMap (licencia ODbL).

Conviene una pantalla "Acerca de" con estas tres líneas y el enlace a la política de privacidad.

### B4. Compilar y subir

Google Play no acepta APK para apps nuevas: pide un **AAB**, que es lo que genera el perfil
`production`.

```bash
pnpm dlx eas-cli@latest build --profile production --platform android
```

- **Firma.** EAS crea y guarda la clave de subida. En la consola se activa "Firma de apps de
  Google Play" (viene por defecto): Google guarda la clave definitiva. No hay que manejar
  archivos de claves a mano.
- **Versión.** `version` en [`app.config.ts`](../../app.config.ts) es la que ve el usuario
  (hoy `0.1.0`). El número interno (`versionCode`) lo sube EAS solo en cada build.

**La primera subida es manual:**

1. En Play Console, crear la app (nombre, idioma, gratis).
2. Completar la ficha y las declaraciones de B1 y B2.
3. *Pruebas → Prueba cerrada → Crear versión* y subir el `.aab` descargado de EAS.
4. Añadir los correos de los testers y pasarles el enlace de la prueba.
5. Pasados los 14 días, pedir acceso a producción y crear la versión de producción.

**Las siguientes se pueden automatizar** con `eas submit`, que necesita una clave de cuenta de
servicio de Google Cloud guardada en EAS:

```bash
pnpm dlx eas-cli@latest submit --profile production --platform android
```

La revisión de Google tarda desde unas horas hasta varios días, más en la primera versión.

### B5. Después de publicar

- **Cambios de solo JavaScript** (textos, pantallas, lógica): se envían con una actualización
  OTA, sin pasar por revisión:
  `pnpm dlx eas-cli@latest update --branch production --message "..."`.
- **Cambios nativos** (una librería nativa nueva, permisos, icono): build y revisión nuevas.
  Enviar por OTA un JavaScript que usa un módulo nativo que la app instalada no trae hace que
  no arranque (`EXPO-004` en [known-issues](../../.claude/rules/known-issues.md)).

---

## Lista de pendientes para llegar a Google Play

En orden:

1. Retención de precios y cron diario (plan 0002).
2. Proyecto remoto de Supabase, con esquema, función y datos (pasos 1 y 2).
3. Variables en EAS y perfiles con su `environment` (paso 3).
4. **APK `preview` y prueba real fuera de casa** — primer hito alcanzable.
5. Eliminar la cuenta desde la app.
6. Pantalla "Acerca de" y política de privacidad publicada.
7. Cuenta de desarrollador, ficha y declaraciones.
8. AAB de producción → prueba cerrada de 14 días → producción.

## iOS, por si se quiere después

Exige una cuenta de Apple Developer (99 USD al año) y un Mac no es necesario con EAS. No hay
equivalente al APK: para instalar fuera de la tienda se usa TestFlight. Queda fuera de esta
guía.
