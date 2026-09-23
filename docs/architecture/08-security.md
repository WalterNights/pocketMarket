# 08 — Seguridad

## El axioma

> **El bundle de la app es público.** Cualquiera puede descargar el APK/IPA, descomprimirlo y
> leer el JavaScript. Todo lo que esté dentro —claves, endpoints, lógica de validación, feature
> flags— es conocido por un atacante.

De ahí se derivan todas las reglas de este documento. La app no protege nada; **la protección
vive en Postgres**.

## Secretos

| Dato | Dónde va | Por qué |
|---|---|---|
| `SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` | Pública por diseño |
| Clave `anon` de Supabase | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Pública por diseño: su poder lo limita RLS |
| Clave `service_role` | **Nunca en la app.** Solo Edge Functions / servidor | Ignora RLS: es acceso total a la BD |
| Claves de API de terceros con coste | Edge Function que hace de proxy | Si va en el cliente, te la usan |
| Token de sesión del usuario | `expo-secure-store` | Keychain (iOS) / Keystore (Android) |
| Certificados de firma | Credenciales de EAS, nunca en git | — |

Toda variable `EXPO_PUBLIC_*` **acaba dentro del bundle**. Si dudas si algo puede ser público,
no puede.

`.env` va en `.gitignore`; `.env.example` se versiona con las claves vacías. Las variables de
build viven en `eas.json` (no sensibles) o en EAS Secrets (sensibles).

## Validación de entorno al arrancar

```ts
// shared/config/env.ts
const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

export const env = envSchema.parse(process.env)
```

Falla en el arranque con un mensaje claro, no con un `undefined` a mitad de un flujo de pago.

## RLS — la frontera real

Reglas duras para toda tabla del proyecto:

1. **`ENABLE ROW LEVEL SECURITY` en todas las tablas, sin excepción.** Una tabla sin RLS con la
   clave anon es una tabla pública de internet.
2. **Política por operación** (`select`, `insert`, `update`, `delete`). `FOR ALL` es casi siempre
   demasiado permisivo.
3. **`auth.uid()` como sujeto.** Jamás confiar en un `user_id` enviado por el cliente en el
   payload: se falsifica trivialmente.
4. **`WITH CHECK` en inserts y updates**, no solo `USING`. Sin `WITH CHECK`, un usuario puede
   crear filas a nombre de otro.
5. **Las columnas sensibles no se exponen.** Vistas o `security definer functions` para lo que
   necesite lógica; `REVOKE` sobre columnas que el cliente no debe ver.
6. **Toda política se prueba** con un test que intente el acceso indebido y verifique que falla.
   Una política que nadie intentó romper no está verificada.

```sql
alter table products enable row level security;

create policy "owner reads own products"
  on products for select
  using (auth.uid() = owner_id);

create policy "owner inserts own products"
  on products for insert
  with check (auth.uid() = owner_id);
```

### Lo que el cliente nunca decide

- Precios y totales → calculados en el servidor (función SQL o Edge Function).
- Estados de pedido, saldos, contadores de stock → transiciones atómicas en servidor.
- Roles y permisos → tabla en servidor, nunca un campo del perfil editable por el usuario.
- `created_at` / `updated_at` → `default now()` y triggers, no el reloj del dispositivo.

## Almacenamiento en dispositivo

| Tipo de dato | Mecanismo |
|---|---|
| Tokens, refresh tokens, PIN | `expo-secure-store` (Keychain / Keystore) |
| Preferencias, caché de queries, borradores | MMKV |
| Datos estructurados grandes | SQLite (`expo-sqlite`), cifrado si contiene datos personales |
| Nada sensible | Nunca en `AsyncStorage` plano ni en logs |

`expo-secure-store` tiene un límite práctico de tamaño por entrada: guarda ahí el token, no el
perfil completo.

**Configurar el cliente de Supabase con SecureStore como storage de auth**, no con el
AsyncStorage por defecto.

## Sesión

- **Logout borra todo**: sesión de Supabase, `queryClient.clear()`, storage del persister,
  stores persistidos de Zustand y cualquier borrador. Un dispositivo compartido no debe filtrar
  datos entre usuarios.
- **Refresh automático** gestionado por el SDK, pausado en background.
- **Biometría** (`expo-local-authentication`) como *desbloqueo local*, no como autenticación
  contra el servidor: el servidor sigue exigiendo un token válido.
- **Timeout de inactividad** si la app maneja datos financieros o personales.

## Superficie de ataque móvil

| Vector | Mitigación |
|---|---|
| Deep link malicioso | Validar todo parámetro con Zod; ningún link ejecuta acciones con efecto |
| WebView | Evitarla; si es inevitable: `originWhitelist` restringido, sin `injectedJavaScript` con datos del usuario |
| Capturas en el multitarea | Ocultar pantallas sensibles al pasar a background (`FLAG_SECURE` / overlay en iOS) |
| Logs en release | Eliminar `console.log` en producción (babel plugin). Un log puede filtrar tokens |
| Pasteboard | No copiar datos sensibles; limpiar tras usar |
| Root / jailbreak | Detección solo si el modelo de amenaza lo justifica; nunca como única defensa |
| Ingeniería inversa del bundle | Asumirla como un hecho. Ofuscar no es seguridad |
| Dependencias | Vetting antes de instalar (skill `vet-dependency`); auditoría periódica (`security-audit`) |

## Privacidad y requisitos de store

Ambas plataformas exigen declarar qué datos recoges. Una declaración incorrecta es motivo de
rechazo o retirada:

- **iOS**: App Privacy ("nutrition label") + `PrivacyInfo.xcprivacy` (privacy manifest) +
  justificación de APIs de motivo obligatorio. `NSUserTrackingUsageDescription` si hay tracking.
- **Android**: sección Data Safety en Play Console.
- **Permisos**: solicitar en el momento de uso, con una explicación previa de *por qué*. Pedir
  ubicación al abrir la app es rechazo casi seguro y denegación permanente por parte del usuario.
- Cada cadena de permiso (`NSCameraUsageDescription`, etc.) debe describir el uso real.

## Checklist antes de cada release

- [ ] `git grep` de claves, tokens y URLs privadas en el código
- [ ] Ninguna `EXPO_PUBLIC_*` contiene algo que no pueda ser público
- [ ] Todas las tablas nuevas tienen RLS habilitada y políticas por operación
- [ ] Las políticas nuevas tienen un test de acceso denegado
- [ ] `console.log` eliminados en el build de producción
- [ ] Logout limpia caché, stores y almacenamiento seguro
- [ ] Deep links validados; ninguno con efecto secundario
- [ ] Declaraciones de privacidad al día con los datos que realmente se recogen
- [ ] Dependencias nuevas vetadas
