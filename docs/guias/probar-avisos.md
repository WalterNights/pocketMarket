# Probar los avisos en local

Los avisos **no suenan en Expo Go para Android** (`EXPO-003` en known-issues): hace falta un
**development build**, que es la misma app React Native compilada con sus módulos nativos. Se
instala una vez en el teléfono y después se trabaja igual que con Expo Go (`expo start`, recarga
en caliente).

Esta guía cubre montarlo en local, verificar cada disparador y qué cambia para producción.

---

## 1. Compilar el development build en la nube (EAS) — camino recomendado

Se compila en los servidores de Expo (Linux), así que no hace falta Android Studio y se evitan
los fallos de rutas largas de Windows con pnpm. El proyecto ya está enlazado a EAS
(`extra.eas.projectId` en `app.config.ts`) y los perfiles están en `eas.json`.

```bash
pnpm dlx eas-cli@latest login                                            # una vez, con tu cuenta de expo.dev
pnpm dlx eas-cli@latest build --profile development --platform android
```

- La **primera** vez pregunta si genera un *keystore* de Android: responder **sí**. EAS lo
  guarda en tu cuenta; no hay que tocarlo.
- La build tarda ~10–20 min en la cola gratuita. Al terminar muestra un **enlace y un QR**:
  abrirlo en el teléfono, descargar el APK e instalarlo (Android pedirá permitir "instalar apps
  de fuentes desconocidas" para el navegador).

**Cuándo volver a compilar:** solo cuando cambia algo nativo — una dependencia con código
nativo, un config plugin o `app.config.ts`. Los cambios de JS/TS no lo necesitan.

## 2. El día a día

```bash
pnpm run db:start                          # si Supabase no está arriba (ver SB-001)
pnpm expo start --dev-client --clear
```

Abrir **Pocket Market** (la app instalada, no Expo Go) y conectarla al servidor que aparece, o
escanear el QR de Metro desde ella. Recarga en caliente igual que antes.

> Si el teléfono no carga datos: la IP de `.env` tiene que ser la del PC (`EXPO-002`).

## 3. Alternativa: compilar en local con Android Studio

Solo si hiciera falta depurar código nativo o compilar muchas veces al día.

1. Instalar **Android Studio** (con Android SDK, Platform y Platform-Tools) y **JDK 17**
   (`winget install Microsoft.OpenJDK.17`).
2. Variables de usuario: `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`, `JAVA_HOME` = carpeta
   del JDK 17, y añadir `%ANDROID_HOME%\platform-tools` al `Path`.
3. Teléfono con **Depuración USB** activada; `adb devices` debe listarlo.
4. `pnpm expo run:android` — genera `android/` (no se versiona, regla 10), compila e instala.

Riesgo conocido en Windows: rutas de más de 260 caracteres dentro de `node_modules/.pnpm`
pueden romper la compilación C++ de la New Architecture.

---

## 4. Verificar los disparadores

Todo se hace desde **Tu cuenta → Diagnóstico de avisos (solo desarrollo)**, que muestra lo que
*debería* sonar (calculado desde Supabase) frente a lo que el teléfono *tiene* programado, y
permite lanzar un aviso real a un minuto.

| # | Qué probar | Cómo | Resultado esperado |
|---|---|---|---|
| 1 | Permiso en el momento correcto | Crear el primer aviso de una lista | El sistema pide permiso **ahí**, no al abrir la app |
| 2 | Suena con la app abierta | *Aviso de prueba en 1 min* y esperar | Banner con sonido |
| 3 | Suena en segundo plano | Aviso de prueba y salir al inicio | Notificación en la barra |
| 4 | Suena con el teléfono bloqueado | Aviso de prueba y bloquear | Notificación en la pantalla de bloqueo |
| 5 | Suena con la app cerrada | Aviso de prueba y cerrarla desde recientes | Notificación igualmente |
| 6 | Tocar abre la lista | Tocar el aviso de prueba (sale "abre una lista" si hay avisos) | Abre esa lista; con sesión cerrada pide entrar y luego la abre |
| 7 | Reconciliación | Crear, cambiar y quitar avisos; editar y borrar listas | *Reconciliación: ✓ Coinciden* tras cada cambio |
| 8 | Idempotencia | Cerrar y abrir la app varias veces | El número de programados no crece |
| 9 | Cerrar sesión | Cerrar sesión y volver al diagnóstico (entrando de nuevo) | Antes de entrar, 0 programados |
| 10 | Permiso denegado | Denegarlo en Ajustes del sistema | La lista muestra "Próximo mercado" y el enlace a Ajustes |
| 11 | Reinicio del teléfono | Reiniciar con avisos programados | Siguen apareciendo como programados |
| 12 | Texto del aviso | Esperar un aviso real (o ver *Planeados*) | `"Nombre" · N productos · ~$total` |

**Para probar un aviso real sin esperar al día:** crear el aviso para hoy a una hora cercana de las
disponibles, o poner el teléfono en fecha/hora manual (Ajustes → Sistema → Fecha y hora) justo
antes de la ocurrencia. Tras cambiar la hora, abrir la app para que reconcilie. Volver a hora
automática al terminar.

### Mirar desde el PC

```bash
adb logcat ReactNativeJS:V *:S                         # logs JS del teléfono
adb shell dumpsys alarm | findstr pocketmarket         # alarmas del sistema de la app
adb shell dumpsys notification | findstr pocketmarket  # notificaciones visibles
```

Los fallos de sincronización salen en el log como
`No se pudieron sincronizar los recordatorios`.

---

## 5. Hacia producción

El código de los avisos **es el mismo**: el adaptador solo se apaga en Expo Go. Lo que cambia es
cómo se compila y lo que hay que revisar antes de publicar:

- **Build de release** con EAS (`eas build --profile production`). `eas.json` y la cuenta ya
  existen; falta el proyecto remoto de Supabase y sus variables `EXPO_PUBLIC_*` como variables
  de entorno de EAS (hoy salen del `.env` local).
- En release `__DEV__` es `false`: el diagnóstico no aparece.
- **Icono de notificación en Android**: hoy usa el de la app. Para release conviene uno
  monocromo (opción `icon` del plugin `expo-notifications` en `app.config.ts`).
- **iOS**: probar en un iPhone real; allí el límite de 64 pendientes es real y el presupuesto
  de 56 lo respeta por construcción (`03-reminders.md`).
- Repetir la tabla de la sección 4 sobre la build de release antes de publicar.
