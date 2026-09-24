# ADR-0005: Email y contraseña con Supabase Auth; el catálogo sigue siendo público

- **Fecha:** 2026-09-24
- **Estado:** Aceptada

## Contexto

Guardar una lista exige saber de quién es: `shopping_list`, `list_item` y `list_reminder` ya
tienen RLS por `auth.uid()`, pero la app no tenía sesión, así que las listas vivían en memoria y
se perdían al cerrar.

Hechos que condicionan la decisión:

- El catálogo es de lectura pública (`anon`). Nadie necesita cuenta para ver precios.
- Se quiere OAuth (Google, Apple) más adelante, no ahora.
- La sesión de Supabase de un usuario con email ocupa **2.209 bytes** medidos en local, y
  `expo-secure-store` tiene un límite práctico de **2.048 bytes** por valor. Con identidades
  OAuth crecerá más.
- Expo Go no tiene MMKV: cualquier almacenamiento tiene que funcionar sin él.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| A. Email + contraseña ahora, OAuth después | Sin dependencias nativas nuevas; funciona en Expo Go; Supabase lo trae | El usuario tiene que recordar una contraseña |
| B. Sesión anónima y conversión posterior a cuenta | Cero fricción para guardar | Perder el teléfono = perder las listas; no da "sesión personalizada" |
| C. Magic link / OTP por email | Sin contraseña | Exige SMTP y deep links desde el primer día; en local depende de Mailpit |
| D. OAuth ya | Un toque | `expo-auth-session` + configuración en Google/Apple + development build para Apple |

**Almacenamiento de la sesión:**

| Opción | A favor | En contra |
|---|---|---|
| 1. SecureStore, un valor | Lo que ya había | Excede 2.048 bytes: falla o avisa según la versión |
| 2. Cifrar con AES, clave en SecureStore y datos en AsyncStorage (guía de Supabase) | Sin límite de tamaño | Dos dependencias nuevas (`aes-js`, AsyncStorage); el token sale del Keychain |
| 3. **Partir el valor en trozos, todos en SecureStore** | Sin dependencias; el token sigue en Keychain/Keystore (regla 8) | Varias lecturas por arranque; hay que limpiar trozos sobrantes |

## Decisión

**A + 3.** Email y contraseña con Supabase Auth, y la sesión troceada dentro de SecureStore.

- Es lo que el usuario pidió y deja una puerta directa a OAuth: Supabase enlaza identidades a la
  misma cuenta, así que añadir Google después no rompe las listas de nadie.
- **El login no bloquea la app.** El catálogo sigue siendo público; la sesión se pide solo en
  rutas privadas (grupo `app/(private)/`) y al guardar. Pedir cuenta para ver precios sería
  pedirla antes de haber demostrado nada.
- Trocear en SecureStore cumple la regla 8 sin tocar la cadena de suministro. Un fallo a mitad
  de escritura deja trozos incoherentes, el JSON no parsea y Supabase lo trata como "sin
  sesión": el peor caso es volver a iniciar sesión, nunca una sesión corrupta aceptada.

## Consecuencias

- **Positivas:** listas personales por usuario; nada nativo nuevo, así que sigue siendo OTA y
  funciona en Expo Go; OAuth se suma sin migrar cuentas.
- **Negativas:**
  - Sin recuperación de contraseña hasta que haya SMTP configurado en el proyecto remoto.
  - `enable_confirmations = false` en local. **En producción hay que activarla** (y con ella
    SMTP): sin confirmación, cualquiera registra un email ajeno.
  - Contraseña mínima de 8 caracteres, validada en cliente (Zod) **y** en servidor
    (`minimum_password_length`). El cliente es cortesía; el servidor es la regla.
- **Qué invalidaría esta decisión:** que la mayoría de usuarios abandone en el registro (se
  adelantaría OAuth), o que `expo-secure-store` añada almacenamiento sin límite.
