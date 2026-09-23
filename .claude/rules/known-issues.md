# Known Issues & Solutions Registry — Pocket Market

> Documento vivo. Se actualiza **cada vez** que se encuentra y resuelve un problema no evidente.
> Claude DEBE consultar este archivo antes de implementar cambios, para no repetir errores ya
> pagados.

**Formato de entrada:**

```markdown
### CATEGORÍA-NNN: Título corto
- **Síntoma**: qué se observó
- **Causa raíz**: qué lo provocaba realmente
- **Solución**: cómo se arregló
- **Prevención**: cómo evitarlo la próxima vez
```

**Categorías:** `EXPO` (SDK, prebuild, config plugins) · `BUILD` (EAS, firma, stores) ·
`OTA` (EAS Update, runtimeVersion) · `NAV` (expo-router, deep links) ·
`DATA` (TanStack Query, caché, offline) · `SB` (Supabase, RLS, migraciones) ·
`PERF` (rendimiento) · `UI` (estilos, a11y, layout) · `NATIVE` (permisos, módulos nativos) ·
`SEC` (seguridad) · `ING` (ingesta, adaptadores, fuentes) · `NOTIF` (recordatorios)

---

## Registro

*(Vacío — el proyecto aún no ha empezado a implementarse.)*

---

## Trampas conocidas del stack — a verificar antes de darlas por resueltas

Estas **no** son incidencias ocurridas en este proyecto: son fallos documentados del stack
elegido, anotados aquí para que no nos cuesten una tarde. Al encontrarse una de verdad, se
promueve al registro de arriba con su ID.

### Dependencias / pnpm (`SEC`)
- **No asumir que un paquete necesita `allowBuilds`.** Muchos distribuyen binarios como
  `optionalDependencies` por plataforma, sin ningún script. Comprobar primero:
  `curl -s https://registry.npmjs.org/<pkg> | python -c "..."` y mirar preinstall/install/postinstall.
- **`build`, `test` y `prepare` NO se ejecutan** al instalar desde el tarball del registro. Solo
  `preinstall`, `install` y `postinstall`. Ver un `build` en un paquete no es señal de alarma.
- **Corepack respeta `packageManager`** automáticamente: basta declararlo en `package.json` para
  que todas las máquinas usen la misma versión de pnpm. Verificable con `corepack pnpm --version`.
- `pnpm ignored-builds` lista qué builds se bloquearon: sirve como comprobación de que
  `allowBuilds` está activo de verdad.
- Un advisory de GitHub sobre un paquete **no** significa que la versión instalada sea
  vulnerable: hay que comparar contra `vulnerable_version_range`. Los tres advisories de `jose`
  afectan a ≤ 4.15.4; la 6.x está fuera.

### Expo / CNG
- Editar `ios/` o `android/` a mano: el cambio desaparece en el siguiente `prebuild`. Todo
  cambio nativo va en un **config plugin**.
- Añadir una librería con código nativo requiere **build nueva**: no basta `expo start`.
- Metro cachea con entusiasmo. Ante comportamiento inexplicable: `pnpm expo start --clear`.
- No toda librería de RN es compatible con la New Architecture. Verificar antes de instalar
  (React Native Directory marca la compatibilidad).

### NativeWind / React Native Reusables
- **shadcn/ui no funciona en React Native.** Es Radix UI: DOM + CSS. Usar React Native
  Reusables, que es su port. No perder tiempo intentando adaptar shadcn/ui directamente.
- Los componentes de RNR se **copian**, no se instalan: viven en `shared/ui/` como código del
  repo y cumplen las reglas del proyecto (44pt, a11y, claro/oscuro).
- Traer patrones de web sin revisarlos: un `Dialog` centrado donde el usuario espera un bottom
  sheet, un `Select` desplegable donde espera un action sheet, o un `Tooltip` en hover que en
  móvil no existe.
- NativeWind añade una capa a la cadena de build de Metro: ante fallos raros tras un upgrade,
  sospechar de ella y limpiar caché.

### EAS Update / OTA
- **El fallo más caro del stack:** servir un bundle JS que usa un módulo nativo ausente en el
  binario instalado → crash al arrancar, y el usuario no puede ni actualizar. Por eso
  `runtimeVersion` con política `fingerprint`.
- Un OTA **no** puede cambiar permisos, iconos, splash ni el scheme de deep links.

### expo-router
- `useLocalSearchParams` devuelve `string | string[]`. Castearlo en vez de validarlo con Zod
  produce crashes con deep links malformados.
- Sin estado `loading` en el guard de sesión, todo usuario autenticado ve un destello de la
  pantalla de login en cada arranque (leer SecureStore es asíncrono).
- Olvidar `router.replace()` tras login deja el login en la pila y el botón atrás vuelve a él.

### TanStack Query
- Sin `networkMode: 'offlineFirst'`, las queries sin red se quedan en `pending` en vez de servir
  la caché.
- `refetchOnWindowFocus` no aplica bien en móvil: el concepto correcto es foreground/background
  vía `focusManager` + `AppState`.
- Rehidratar mutaciones tras reinicio del proceso **exige** `setMutationDefaults`; sin eso la
  mutación persistida no sabe qué función ejecutar.
- Logout sin `queryClient.clear()` **y** sin limpiar el persister filtra datos al siguiente
  usuario del dispositivo.

### Zustand
- Store persistido sin `version` + `migrate`: un usuario que actualiza con estado antiguo
  crashea al arrancar y no puede ni entrar a la app para arreglarlo.
- Consumir el store sin selector re-renderiza la pantalla entera ante cualquier cambio.

### Supabase
- Tabla sin RLS + clave anon = tabla pública de internet.
- Política de `insert` sin `WITH CHECK`: un usuario puede crear filas a nombre de otro.
- Olvidar regenerar `database.types.ts` tras una migración: TypeScript compila con tipos que ya
  mienten.
- `ALTER TYPE ... ADD VALUE` no puede ejecutarse dentro de una transacción.
- RLS con subconsultas sin índice se degrada rápido al crecer la tabla.

### Postgres / SQL (`SB`)
- **Vista que toca datos de usuario sin `with (security_invoker = true)`**: corre con los
  permisos de su dueño y **salta RLS**, exponiendo las filas de todos los usuarios. Es el fallo
  de seguridad más silencioso de Supabase: la vista "funciona" perfectamente mientras filtra.
- **`unaccent()` es STABLE, no IMMUTABLE**: Postgres la rechaza dentro de una columna generada
  o un índice de expresión. Hay que envolverla fijando el diccionario
  (`public.immutable_unaccent`) para que sea determinista.
- **`REFRESH MATERIALIZED VIEW CONCURRENTLY` exige un índice único** en la vista. Sin él falla
  y bloquea la tabla durante el refresh normal.
- **Las materialized views no honran RLS**, solo los GRANT. Válido para catálogo público;
  nunca para datos de usuario.
- **UPDATE/DELETE bloqueados por RLS no lanzan error**: afectan 0 filas en silencio. Solo
  INSERT/UPDATE con `WITH CHECK` violado devuelven 42501. Los tests deben contar filas
  afectadas, no esperar excepción.
- **GUC con punto en el nombre necesita comillas**: `set local "request.jwt.claims" = ...`.
- **Postgres NO admite DML dentro de una subconsulta**: `select count(*) from (update ... returning 1) t`
  da `syntax error at or near "."`. Hay que usar un CTE modificador de datos:
  `with attempted as (update ... returning 1) select count(*) from attempted`.
  Confirmado 2026-09-22 al escribir los tests de RLS.
- Supabase concede permisos amplios en `public` por defecto: hacer `revoke all` y luego el
  `grant` exacto, además de RLS.

### Rendimiento
- `ScrollView` + `.map()` sobre datos remotos: monta N elementos y agota la memoria.
- `renderItem` como función en línea invalida la memoización de todas las filas.
- `useState` dentro de `onGestureEvent` en vez de worklets: el gesto cae a ~10 fps.
- Medir en modo desarrollo o en simulador: los números no representan a ningún usuario real.

### Stores
- Permisos solicitados al abrir la app (sin contexto) → rechazo en revisión y denegación
  permanente por parte del usuario.
- Declaraciones de privacidad desalineadas con los datos que realmente se recogen → retirada.
- iOS exige `PrivacyInfo.xcprivacy` y justificación de APIs de motivo obligatorio.

### Ingesta y dominio (`ING`)
- **Borrar un `store_product` que desapareció de la fuente** rompe las listas de los usuarios
  que lo referencian. Marcar `is_available = false`, nunca borrar.
- **Insertar un `price_snapshot` idéntico al anterior** cada día infla la tabla sin aportar
  información. Solo se inserta cuando el precio cambia.
- **Separador de miles leído como decimal**: `"$ 4.200"` parseado como `4.2`. Es el error de
  parseo más probable con precios colombianos y produce datos silenciosamente absurdos.
- **Dinero en float**: pérdida de precisión en los totales. `integer` COP siempre.
- **Adivinar `unitValue`** cuando el nombre no lo dice claro produce un precio por medida falso,
  que es peor que no mostrarlo.
- **Cargar el catálogo completo en memoria** en una Edge Function: decenas de miles de SKU.
  `AsyncIterable` y lotes.
- **No refrescar `current_price`** al final de la corrida: la app sigue viendo precios viejos
  aunque los snapshots sean nuevos.
- **Consultar el último precio con `ORDER BY captured_at DESC LIMIT 1` por producto** es un N+1
  disfrazado. Para eso existe la vista materializada.
- **Subir el umbral de descarte del 20%** para que una corrida "pase" convierte un fallo
  detectado en precios falsos para el usuario.
- **Presentar una equivalencia `fuzzy` como hecho**: recomendar comprar en otra tienda algo que
  no es el mismo producto destruye la confianza en la app.
- **Ara no tiene catálogo online.** Solo folletos en su app. Ya se investigó; no repetirlo.

### Recordatorios (`NOTIF`)
- **iOS limita a 64 notificaciones locales pendientes por app.** Al superarlo se descartan en
  silencio — el recordatorio simplemente no suena.
- **No existe trigger nativo quincenal.** Hay que programar ocurrencias por lotes y reponerlas
  al abrir la app.
- **Reconciliación no idempotente** duplica notificaciones en cada arranque.
- **Mensual el día 31** en un mes de 30: hay que decidir explícitamente (usamos último día del
  mes), o el recordatorio se salta meses.
- **Pedir permiso de notificaciones al arrancar** en vez de al crear el primer recordatorio: en
  iOS la negativa es prácticamente definitiva.
- Una notificación local **no puede consultar la red**: el total del texto se calcula al
  programarla, por eso se muestra como aproximado.
