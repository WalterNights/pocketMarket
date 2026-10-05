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

### ING-001: las reglas con "ñ" o tilde nunca casaban
- **Síntoma**: `piña`, `aliño`, `pañal` y `buñuelo` estaban en la tabla de reglas del
  clasificador y jamás clasificaron nada. Ningún test fallaba: todos los casos de prueba
  usaban palabras sin tilde.
- **Causa raíz**: el texto del producto se normaliza (`NFD` + quitar diacríticos) antes de
  buscar, pero **las claves de las reglas no**. `normalise('Piña')` da `pina`, que nunca
  contiene `piña`. La regla existía, se leía bien y era código muerto.
- **Solución**: `compile()` normaliza las claves al cargar el módulo. Las reglas se siguen
  escribiendo en español normal.
- **Prevención**: si un lado de una comparación se normaliza, el otro también. Vale para
  búsqueda, orden y deduplicación, no solo para esto.

### ING-002: el ingrediente no clasifica un producto procesado
- **Síntoma**: "Frutas" tenía bebidas en polvo, mermelada, helado y un barquillo de limón.
  "Verduras" tenía sopa de sobre, tomate en lata y cebolla en polvo. "Pollo" tenía 17
  productos y ninguno era pollo: era todo jamón, salchicha y mortadela.
- **Causa raíz**: clasificar por la palabra que aparece en el nombre. Un nombre de fruta
  aparece en cualquier producto con ese sabor, ese relleno o esa forma.
- **Solución**: tres capas con precedencia explícita — excepciones, luego **forma**
  (mermelada, en lata, en polvo, embutido), luego ingrediente — y antes de todo se borran
  las frases "sabor a X" y "relleno de X", que describen a qué sabe, no qué es. Las reglas
  de fruta y verdura solo se aplican si la **fuente** dice que el producto viene del pasillo
  de frutas y verduras: un limón de verdad se vende ahí y un barquillo de limón no.
- **Prevención**: ante una mala clasificación, preguntar si falta una palabra o si sobra
  una capa. Añadir palabras a una lista plana solo mueve el problema al siguiente producto.

### ING-003: un 500 en una página profunda mataba la corrida entera
- **Síntoma**: corrida abortada en el offset 1600 de una categoría, con las categorías
  siguientes sin visitar. 4.598 productos escritos, el resto perdido.
- **Causa raíz**: `fetchPage` lanzaba ante cualquier estado que no fuera 200/206, y la
  excepción subía hasta abortar el `for` de categorías.
- **Solución**: reintento con backoff exponencial (2s, 4s, 8s) ante 429 y 5xx; agotados los
  intentos se descarta **la página**, no la corrida. La categoría termina ahí y la
  siguiente empieza.
- **Prevención**: distinguir siempre el radio del fallo. Un error de una página no es un
  error de la tienda, y un error de la tienda no es un error de la corrida.

### ING-004: el umbral de descarte confundía "agotado" con "ilegible"
- **Síntoma**: corrida abortada al 24% de descartes con el mensaje de "la fuente cambió de
  formato". La fuente no había cambiado nada.
- **Causa raíz**: `normalize()` devolvía `null` para dos cosas distintas. Un producto con
  `Price: 0` está agotado hoy — es rutina, y las páginas profundas van llenas: "Comidas
  preparadas" da 32% — mientras que un registro con forma ilegible sí significa que el
  formato cambió. Sumados, el umbral del 20% se dispara solo.
- **Solución**: `NormalizeResult` discriminado (`ok` / `skipped` / `failed`). El umbral solo
  vigila `failed`. En la corrida real: 28% agotados, **0% ilegibles**.
- **Prevención**: una alarma que mide dos cosas distintas no mide ninguna. Antes de subir un
  umbral que salta de más, mirar si está contando lo que dice contar.

### ING-006: buscar la palabra como subcadena la encuentra dentro de otra palabra
- **Síntoma**: "Repollo Blanco" en **Pollo**. "Lechuga Morada" y "ESPINACA BOGOTANA" en
  **Frutas**. "LIMONARIA" en Frutas. Cada uno pareció un caso aislado y cada uno se
  arregló por separado, tres veces, hasta ver que era el mismo fallo.
- **Causa raíz**: el clasificador comparaba con `haystack.includes(keyword)`. Las palabras
  cortas del dominio viven dentro de otras: `pollo` en re**pollo**, `mora` en **mora**da,
  `limon` en **limon**aria y — tras quitar la tilde — `piña` se vuelve `pina`, que está
  dentro de es**pina**ca.
- **Solución**: las reglas se compilan a expresiones regulares de **palabra entera** con
  plural opcional (`\bpollo(?:e?s)?\b`). Las que de verdad son raíces se marcan con `*`
  (`enlatad*`, `salchich*`), porque tienen que coger enlatado, enlatada y enlatados.
- **Prevención**: en español, comparar por subcadena solo es seguro con palabras largas y
  poco comunes. Por defecto, palabra entera; la raíz se pide explícitamente. Y ojo al
  interactuar con ING-001: quitar tildes **crea** subcadenas que no existían (`piña` no
  está en `espinaca`, pero `pina` sí).

### ING-007: una corrida abortada escribía el catálogo sin publicarlo
- **Síntoma**: la app mostraba "Arroz 111" y una lista vacía. Todas las tiendas en
  "próximamente", incluida la única que tenía productos.
- **Causa raíz**: dos eslabones. `current_price` es una vista materializada y **nada es
  visible hasta refrescarla**; el pipeline tenía `if (!report.aborted)` antes del refresco,
  así que la corrida que murió por el 500 escribió 4.598 productos y no publicó ninguno.
  Encima, el contador de cada categoría salía de `store_product` mientras la lista salía de
  `catalog_product`, que exige precio: dos fuentes de verdad que podían discrepar.
- **Solución**: refrescar **siempre** que se haya escrito algún precio, también al abortar
  — los precios ya escritos son correctos, que la corrida acabe pronto no dice nada de
  ellos. Y los resúmenes (`store_summary`, `store_category_summary`) ahora cuentan
  únicamente productos con precio, lo mismo que muestra la lista.
- **Prevención**: un contador es una promesa sobre la pantalla siguiente. Si sale de una
  consulta distinta a la que llena esa pantalla, algún día mentirá. Y publicar es un paso
  aparte de escribir: hay que preguntarse siempre quién lo ejecuta cuando algo falla.

### ING-008: la comida de perro salía en Pollo aunque la fuente dijera "mascotas"
- **Síntoma**: "Comida para perros adultos carne cerdo y pollo" en **Pollo**. Al mirar el
  pasillo entero: **292 de 2.082** productos de mascotas en categorías de personas — 115 en
  condimentos (golosinas "deshidratadas"), 35 en carnes ("Pulmón de cerdo x kilo"), 34 en
  pescados, 10 pañales de perro en Bebés, arena "aroma café" en Café.
- **Causa raíz**: las reglas de mascota solo cubrían "alimento para perro" y la palabra
  suelta `perro` estaba **debajo** de `pollo`. El nombre no dice "sabor pollo", así que
  `stripModifiers` no lo borraba. Y el `source_bucket`, que ya decía `mascotas`, solo se
  consultaba como último recurso.
- **Solución**: `AUTHORITATIVE_SOURCES` — hay pasillos de la fuente cuyo veredicto es final.
  `mascotas` es uno: no contiene comida de personas. Además, reglas por nombre (`para perro`,
  `para gato`, `cachorro`, `felino`) antes de los animales, para cuando no hay pasillo.
- **Prevención**: antes de pelear palabra por palabra, preguntar si la fuente ya respondió.
  Solo es autoritativo un pasillo **homogéneo**: `carnes` no lo es, porque mezcla pollo, res
  y pescado y el nombre tiene que separarlos. Misma idea que la llave de frescos de ING-002.

### ING-010: el sustantivo que abre el nombre es el producto
- **Síntoma**: "Galleta Leche" en Leche, "Pan tajado mantequilla" en Mantequilla, "Salsa para
  carnes" en Carnes, "Gaseosa sin azúcar" en Azúcar, "Atún en aceite" en Aceites, "Blanqueador
  ropa color" en Condimentos. Unas 60 malas clasificaciones de D1, Olímpica y Supermú, todas
  distintas en apariencia.
- **Causa raíz**: las reglas de ingrediente daban el mismo peso a todas las palabras del nombre
  y ganaba la que estaba más arriba en la tabla. En español el tipo de producto va primero y lo
  que lo califica (sabor, acompañamiento, aroma) va después: la posición era información que
  no se usaba.
- **Solución**:
  - Capa `HEAD_RULES`: se ancla al inicio del nombre y solo contiene tipos de producto, nunca
    ingredientes.
  - Delante de ella van `NON_FOOD_RULES` (un limpiador con aroma a canela no es canela) y los
    congelados.
  - En el pasillo de frescos gana la fruta o verdura que aparece primero ("Tomate pera").
- **Prevención**:
  - Si una regla falla con el ingrediente "de abajo", antes de añadir la palabra hay que
    preguntar si esa palabra *es* el producto o lo *describe*.
  - `\bkeyword(?:e?s)?\b` no cubre grafías alternativas ("yogurt" no casa con `yogur`): en esos
    casos, raíz con `*`.

### ING-011: "2.500 G" se leía como 2,5 gramos
- **Síntoma**: "ARROZ 2.500 G" (Olímpica) con medida 2,5 g, y "Aceite 3.000 Ml" (D1) con 3 ml.
  El precio por medida salía mil veces más caro.
- **Causa raíz**: `extractMeasure` leía el punto siempre como decimal porque el Éxito escribe
  "110.5 gr". D1 y Olímpica usan el punto como separador de miles, que es la trampa conocida del
  separador de miles, esta vez en la medida en vez del precio.
- **Solución**: un punto seguido de **exactamente tres dígitos**, con parte entera distinta de
  cero, se lee como miles (`measureNumber`). "0.250 kg", "1.5 L" y "110.5 gr" siguen siendo
  decimales, y la coma es siempre decimal.
- **Prevención**: cada tienda nueva trae su propia forma de escribir números. Al añadir una
  fuente, buscar en su muestra medidas con punto o coma antes de dar el adaptador por bueno.

### ING-012: todas las tiendas de Bogotá descartadas por "municipio desconocido"
- **Síntoma**: al geocodificar Ísimo, 69 de 310 tiendas se saltaban con "municipio desconocido".
  Eran exactamente las de Bogotá.
- **Causa raíz**: la fuente a veces pone un departamento en el campo del municipio, y el código
  descarta ese caso. La lista de departamentos incluía `bogota`, que es una ciudad.
- **Solución**: Bogotá fuera de la lista de departamentos, con test.
- **Prevención**: cuando un motivo de descarte se lleva una cifra redonda y grande, mirar qué
  tienen en común los descartados antes de aceptar que "la fuente viene así".

### SB-002: tests pgTAP que dependían de los datos reales
- **Síntoma**: tras cargar D1, `db:test` falló en dos tests que nadie había tocado.
- **Causa raíz**: uno usaba D1 como "la tienda sin catálogo". El otro insertaba dos precios del
  mismo producto en la misma transacción: `now()` no avanza dentro de una transacción, los dos
  empataban en `captured_at` y `current_price` se quedaba con cualquiera.
- **Solución**: el primero crea su propia tienda de prueba; el segundo da al segundo precio un
  `captured_at` explícito posterior.
- **Prevención**: un test crea lo que necesita y no asume el estado del catálogo. Y dentro de
  una transacción, dos filas que deben ordenarse por fecha necesitan fechas explícitas.

### ING-013: el Éxito tenía seis pasillos truncados y parecía uno
- **Síntoma**: ninguno visible. Se creía que solo "Despensa" rozaba el tope de 2.500 de VTEX.
  Al pedir el total real de cada pasillo: Despensa 12.261, Aseo 7.968, Lácteos 4.621, Dulces
  3.284, Panadería 2.563 y Mascotas 23.356. Se leía poco más de la mitad del catálogo.
- **Causa raíz**: se miraba cuántos productos había **guardados** por pasillo, y nunca pasaban
  de ~2.500 justamente porque el tope los cortaba. Además los agotados se saltan después de
  leerlos, así que lo guardado siempre queda por debajo de lo leído.
- **Solución**: recorrer los pasillos grandes por subcategorías de nivel 3 (74 consultas, todas
  bajo el tope). Un pasillo que llegue al tope ahora se reporta como página perdida, con su
  nombre.
- **Prevención**: el tamaño de una categoría se le pregunta a la fuente (cabecera `resources`
  con `_from=0&_to=0`), no a nuestra base. Lo que guardamos ya pasó por el límite que queremos
  medir.

### DATA-001: buscar por prefijo sobre raíces devuelve ruido
- **Síntoma**: al hacer la búsqueda "mientras se escribe", "pera" devolvía juguetes para perros
  y "sal" 2.010 productos.
- **Causa raíz**: `search_vector` usa la configuración `spanish`, que guarda **raíces**. Postgres
  reduce también el término ("pera" → "per") y luego busca por prefijo: `per:*` casa con
  "perros".
- **Solución**: columna `search_prefix` con configuración `simple` (palabras tal cual, sin
  tildes) e índice GIN propio. La búsqueda por prefijo va contra esa; `search_vector` queda
  para búsqueda por palabra completa.
- **Prevención**: prefijo y raíces no se mezclan. Y un buscador se prueba con palabras cortas y
  comunes del dominio ("pera", "papa", "sal", "mora"), no solo con el ejemplo que motivó el
  cambio.

### SB-001: Supabase arranca pero la app se queda en el skeleton para siempre (Windows)
- **Síntoma**: tras reiniciar el PC, la app muestra el skeleton de tiendas y nunca carga.
  `docker ps` dice que todo está *healthy*, pero `curl :54321` da conexión rechazada y
  `docker port supabase_kong_pocket-market` no devuelve nada. Al reiniciar con `db:start`:
  *"bind: Intento de acceso a un socket no permitido por sus permisos de acceso"*.
- **Causa raíz**: Hyper-V/WinNAT reserva al arrancar rangos de puertos aleatorios
  (`netsh int ipv4 show excludedportrange protocol=tcp`), y cayó en 54318–54417, justo
  encima de los puertos de Supabase (54321–54327). Docker Desktop relanza los contenedores
  solo, así que parecen vivos aunque no publiquen nada.
- **Solución aplicada**: mover Supabase de 543xx a **553xx** en `supabase/config.toml` y
  `EXPO_PUBLIC_SUPABASE_URL` en `.env`. Tras cambiar el `.env` hay que reiniciar Metro con
  `--clear`: las `EXPO_PUBLIC_*` se incrustan en el bundle. El volumen de datos no depende
  del puerto; el catálogo sobrevive al cambio.
- **Si vuelve a pasar con el rango nuevo**: comprobar `excludedportrange` y mover otra vez,
  o reservar el rango como administrador (`net stop winnat` →
  `netsh int ipv4 add excludedportrange protocol=tcp startport=55320 numberofports=10` →
  `net start winnat`), que es persistente.
- **Prevención**: ante un skeleton infinito, antes de mirar la app, `curl` a la API desde el
  PC. Si el PC tampoco llega, no es un problema de la app, ni de RLS, ni de la red del teléfono.

### SEC-001: la sesión de Supabase no cabe en un valor de SecureStore
- **Síntoma**: ninguno todavía — se midió antes de que fallara. Una sesión de usuario con
  email ocupa **2.209 bytes**; `expo-secure-store` admite ~2.048 por valor y según la versión
  avisa o lanza. Con identidades OAuth crece más.
- **Causa raíz**: la sesión incluye el objeto `user` completo (metadatos, identidades), no
  solo el token.
- **Solución**: `shared/utils/chunked-storage.ts` la parte en trozos de 600 unidades UTF-16
  (≤1,8 KB aun con caracteres de 3 bytes), todos en SecureStore. El contador se escribe al
  final: una escritura cortada se lee como "sin sesión", nunca como sesión corrupta.
- **Prevención**: la guía de Supabase para Expo propone AES + AsyncStorage. Aquí no: saca el
  token del Keychain y añade dos dependencias ([ADR-0005](../../docs/adr/0005-autenticacion.md)).

### EXPO-001: las rutas tipadas se corrompen con Metro corriendo (Windows)
- **Síntoma**: `tsc` falla con `'"/lists"' is not assignable to parameter of type ...` para una
  ruta que existe. El tipo lista cosas como `"/../src/features/lists/api/keys"` y
  `/lists/index` en vez de `/lists`.
- **Causa raíz**: el watcher incremental de Expo que regenera `.expo/types/router.d.ts` trata
  como ruta **cualquier** `.ts` añadido o cambiado, también los de `src/`, y no colapsa
  `index`. La generación completa al arrancar sale bien; se estropea con cada guardado
  posterior. Un `prettier --write` basta para reescribirlo mal.
- **Solución**: reiniciar Metro, o regenerar sin servidor:
  ```bash
  node -e "const p=require('path');const c=p.dirname(require.resolve('@expo/cli/package.json',{paths:[p.dirname(require.resolve('expo/package.json'))]}));process.env.EXPO_ROUTER_APP_ROOT=p.resolve('app');require(require.resolve('@expo/router-server/build/typed-routes',{paths:[c]})).regenerateDeclarations(p.resolve('.expo/types'),{})"
  ```
- **Prevención**: antes de pelearse con un error de tipos de rutas, mirar si el tipo contiene
  rutas `/../src/...`. Si las contiene, el código está bien y el archivo generado no.

### EXPO-002: `NoRouteToHostException: Host unreachable` al iniciar sesión
- **Síntoma**: en Metro, `WARN [AuthRetryableFetchError: fetch failed:
  java.net.NoRouteToHostException: Host unreachable]`. La app no carga nada, aunque Supabase
  está *healthy* y `curl` desde el PC responde 200.
- **Causa raíz**: el router asignó otra IP al PC por DHCP (`.158` → `.154`), y
  `EXPO_PUBLIC_SUPABASE_URL` sigue apuntando a la vieja. El teléfono busca un equipo que ya no
  está ahí.
- **Solución**: `ipconfig` → poner la IPv4 de la red local (la `192.168.x.x`, no la de WSL
  `172.x`) en `.env` → reiniciar Metro con `--clear`, porque las `EXPO_PUBLIC_*` van
  incrustadas en el bundle.
- **Prevención**: reservar la IP del PC en el router (reserva DHCP por MAC). Distinguir de
  `SB-001`: allí el PC tampoco llega a `localhost`; aquí el PC llega y el teléfono no.

### EXPO-003: importar expo-notifications tumba la app entera en Expo Go (Android)
- **Síntoma**: la app no arranca. Metro repite `ERROR expo-notifications: Android Push
  notifications (remote notifications) functionality ... was removed from Expo Go with the
  release of SDK 53`, apuntando a `import * as Notifications from 'expo-notifications'`, y
  termina en `TypeError: Cannot read property 'ErrorBoundary' of undefined` en expo-router.
- **Causa raíz**: desde el SDK 53, en Expo Go para Android el **import** del módulo lanza,
  aunque solo se usen notificaciones locales. El adaptador lo importaba arriba del archivo, y
  la cadena `app/_layout.tsx → reminders → ReminderCard → shared/lib/notifications` hizo que
  el layout raíz no llegara a evaluarse: el `ErrorBoundary of undefined` es expo-router
  encontrándose ese módulo vacío, no un segundo fallo.
- **Solución**: el adaptador solo tiene `import type` (se borra al compilar) y carga el
  módulo con `require` perezoso la primera vez que se usa. En Expo Go para Android
  (`isRunningInExpoGo()` de `expo`, **no** `ExecutionEnvironment.StoreClient`, que incluye
  también los development builds) no lo carga y responde `unavailable`: el aviso se guarda,
  la lista muestra la fecha y un texto explica que sonará en la app instalada.
- **Prevención**: un módulo nativo que puede fallar al cargarse nunca va en un import de
  nivel superior en la cadena del layout raíz. Y "funciona en la build" no es "funciona en
  Expo Go": para probar avisos de verdad hace falta development build.

### EXPO-004: `TurboModuleRegistry.getEnforcing(...): '<Modulo>' could not be found`
- **Síntoma**: al abrir una pantalla nueva, `Invariant Violation: ... 'RNMapsAirModule' could not
  be found. Verify that a module by this name is registered in the native binary`, seguido de
  `Route "./index.tsx" is missing the required default export` y `ErrorBoundary of undefined`.
- **Causa raíz**: el JS que sirve Metro usa un módulo **nativo** que la app instalada no trae: se
  añadió la dependencia pero el teléfono sigue con el development build anterior. Los `WARN` de
  rutas sin export y el `ErrorBoundary` son la misma cadena (el import falla → el módulo de la ruta
  queda vacío), no fallos aparte.
- **Solución**: build nueva (`eas build --profile development`), **instalarla primero** y solo
  después conectar Metro.
- **Prevención**: tras añadir o cambiar una dependencia nativa o un config plugin, el orden es
  siempre build → instalar → `expo start --dev-client --clear`. Es el mismo fallo que el OTA más
  caro del stack (JS nuevo sobre binario viejo), en versión de desarrollo.
- **Contención (2026-10-04)**: el mapa tumbaba **toda** la app, porque `app/index.tsx` importa
  `MapButton` del `index.ts` de `branches`, que importaba el mapa y con él MapLibre. Ahora
  `StoreMapScreen` carga la implementación (`StoreMap.tsx`) con `React.lazy` + `require` al abrir
  el mapa, tras comprobar `TurboModuleRegistry.get('MLRNCameraModule')`; sin el módulo muestra
  "El mapa no está disponible" con "Volver". Regla: un módulo nativo opcional nunca se importa
  arriba de un archivo alcanzable desde el `index.ts` de un feature.

### BUILD-001: `drawable/splashscreen_logo not found` en la primera build de Android
- **Síntoma**: EAS Build falla en `:app:processDebugResources` con *Android resource linking
  failed ... resource drawable/splashscreen_logo not found*. La terminal solo muestra cientos de
  `w: ... is deprecated` (advertencias inofensivas de librerías) y un "unknown error"; el error
  real está en el log completo de la fase *Run gradlew* en expo.dev.
- **Causa raíz**: el plugin `expo-splash-screen` estaba configurado solo con colores, sin
  `image`. El tema nativo que genera referencia igualmente `@drawable/splashscreen_logo`, que
  nunca se crea. En Expo Go no se ve porque usa su propio splash.
- **Solución**: `image` (y `dark.image`, con el glifo claro para fondo oscuro) en el plugin.
  Añadidos también `icon` y `adaptiveIcon.foregroundImage`. Arte **provisional** en `assets/`.
- **Prevención**: antes de mandar una build a la nube, `pnpm expo prebuild --platform android
  --no-install --clean` y revisar los recursos generados (luego borrar `android/`): cuesta
  segundos frente a 15 minutos de cola. Para leer el log de una build fallida:
  `pnpm dlx eas-cli@latest build:view <id> --json` → `logFiles` (NDJSON, pedirlo con
  `curl --compressed`; la URL caduca a los 15 min).

### BUILD-002: Windows bloquea `pnpm-native.exe` a mitad de sesión
- **Síntoma**: todo comando `pnpm ...` falla de golpe con `Could not run the pnpm binary ...
  spawnSync ... UNKNOWN`. Al lanzar el ejecutable a mano: *"Una directiva de Control de
  aplicaciones bloqueó este archivo"*. Minutos antes funcionaba.
- **Causa raíz**: el Control de aplicaciones de Windows (Smart App Control) decidió bloquear el
  binario nativo de pnpm 12 que instala Corepack. No es un fallo del proyecto ni de pnpm.
- **Solución aplicada**: ninguna sobre la política (es una decisión de seguridad del equipo y
  le toca al dueño). Para seguir trabajando, las herramientas del proyecto son scripts de Node
  y se pueden lanzar sin pnpm, dándoles la misma ruta de módulos que pone `pnpm exec`:
  ```bash
  export NODE_PATH="$(pwd -W)/node_modules/.pnpm/node_modules"
  node node_modules/typescript/bin/tsc --noEmit
  node node_modules/eslint/bin/eslint.js . --max-warnings 0
  node node_modules/prettier/bin/prettier.cjs --check .
  node node_modules/jest/bin/jest.js
  node node_modules/tsx/dist/cli.mjs ingestion/runners/node/ingest.ts --store d1
  node node_modules/supabase/dist/supabase.js test db
  ```
  Esto **no** sirve para instalar dependencias: instalar exige pnpm (regla 18).
- **Prevención**: si pnpm deja de arrancar sin haber tocado nada, probar el ejecutable a mano
  antes de sospechar del proyecto. Para recuperarlo: reiniciar, o revisar *Seguridad de Windows
  → Control de aplicaciones y navegador → Control inteligente de aplicaciones*.

### ING-009: Dollarcity falla con `UNABLE_TO_VERIFY_LEAF_SIGNATURE` en Node (y no en curl)
- **Síntoma**: el runner de sucursales muere con `fetch failed ... unable to verify the first
  certificate` contra `dollarcity.com`. Con `curl` en Windows y en el navegador funciona.
- **Causa raíz**: el servidor sirve solo su certificado, **sin el intermedio** "Go Daddy Secure
  Certificate Authority - G2". Navegadores y Windows descargan el intermedio que falta (AIA);
  Node no. `--use-system-ca` lo "arregla" en Windows, pero en el Linux de GitHub Actions no.
- **Solución**: el intermedio (público) vive en `ingestion/certs/` y `core/tls.ts` lo añade a los
  certificados de confianza del runner con `tls.setDefaultCACertificates`. **La verificación
  sigue activa**: la cadena se comprueba hasta una raíz que Node ya trae. Antes de versionarlo
  se verificó con `openssl verify` contra las raíces de Node. Caduca en 2031.
- **Prevención**: **nunca** `NODE_TLS_REJECT_UNAUTHORIZED=0` ni `rejectUnauthorized: false`
  para "que pase": eso acepta cualquier certificado, también el de un atacante. Ante este
  error, mirar la cadena con `openssl s_client -showcerts` antes de tocar nada.

### ING-005: el tope de paginación de VTEX responde 400, no una página vacía
- **Síntoma**: `_from=2550` devolvía 400 y la corrida se interpretaba como error de fuente.
- **Causa raíz**: VTEX corta la paginación alrededor de 2.500 resultados por consulta.
- **Solución**: `MAX_OFFSET = 2500` y leer el 400 como fin de categoría.
- **Prevención**: para categorías con más de 2.500 SKU hay que partir la consulta por
  subcategoría o por faceta, no pedir offsets mayores.

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
- **`Android Bundled ... entry.js (1 module)` significa bundle ROTO, no bundle pequeño.** Un
  proyecto sano reporta miles de modulos. Con el bundle roto la app renderiza los estados por
  defecto (listas vacias, "aun no hay datos") y parece un bug de datos o de RLS cuando no lo es.
  Confirmado 2026-09-23: la vista devolvia sus 8 categorias por REST todo el tiempo.
- **Detonante conocido: reestructurar `app/` con Metro corriendo.** Mover o renombrar ficheros
  de ruta en caliente (p. ej. `app/store/[slug].tsx` -> `app/store/[slug]/index.tsx`) corrompe
  la cache. Tras cualquier cambio de estructura de rutas, reiniciar con `--clear`.
- Antes de culpar a los datos, mirar el log de Metro: si hay `Unable to resolve` de imports que
  ya corregiste, estas viendo codigo viejo.
- No toda librería de RN es compatible con la New Architecture. Verificar antes de instalar
  (React Native Directory marca la compatibilidad).

### Toolchain: NO instalar "latest" del tooling (`EXPO`)
Expo calibra su SDK contra versiones concretas del tooling. Instalar la ultima de cada
herramienta rompe. Verificado 2026-09-23 montando el proyecto:

- **TypeScript 7 elimino `baseUrl`** de tsconfig. Hay que usar rutas relativas en `paths`
  (`"@/*": ["./src/*"]`). Todos los tutoriales de Expo siguen usando `baseUrl`.
- **typescript-eslint no soporta TS 7.0** todavia. Con TS 7 instalado, `eslint` muere con
  "typescript-eslint does not support TS 7.0". Usamos **TypeScript 6.x**.
- **eslint-plugin-react no soporta ESLint 10**: `contextOrFilename.getFilename is not a
  function`. `eslint-config-expo` declara `eslint >=8.10` pero en la practica necesita 9.x.
  Usamos **ESLint 9.x**.
- `newArchEnabled` y `edgeToEdgeEnabled` **ya no existen** en el tipo `ExpoConfig` del SDK 57:
  la New Architecture es obligatoria desde SDK 55 y edge-to-edge es el comportamiento por
  defecto. Dejarlos da error de tipos.
- El import de `global.css` necesita `declare module '*.css'`; `nativewind/types` solo cubre
  `className`.

### pnpm 12: builds ignorados fallan el install (`SEC`)
- pnpm 12 **falla** el install si hay paquetes con scripts que no tienen decision declarada en
  `allowBuilds`, y escribe entradas placeholder en `pnpm-workspace.yaml` (`set this to true or
  false`). Hay que declarar `false` explicito y borrar el placeholder, o el YAML queda con
  claves duplicadas y no parsea.
- **`trustPolicy: no-downgrade` genera falsos positivos sistematicos** con paquetes publicados
  antes de que npm generalizara las attestations (~2023-2024): las versiones nuevas tienen
  provenance y las viejas no, asi que se marcan como "downgrade". Verificar siempre antes de
  excluir: repo oficial, mantenedores, ausencia de scripts, advisories. Casos confirmados:
  `semver@6.3.1`, `eslint-import-resolver-typescript@3.10.1`.
- `minimumReleaseAge` es **estructuralmente incompatible** con `expo install`, que fija las
  versiones exactas del SDK (suelen tener dias). De ahi `minimumReleaseAgeExclude` acotado al
  ecosistema del SDK.

### Diagnosticar NativeWind en el bundle (`UI`)
- **`grep -c "--background"` SIEMPRE devuelve 0**: grep interpreta `--background` como una
  opcion, no como patron. Usar `grep -c -- "--background"`. Confirmado 2026-09-23: llevo a
  concluir que NativeWind no compilaba cuando si lo hacia.
- NativeWind v4 **no** deja los valores crudos (`40 33% 96%`) en el bundle. Compila las clases
  a una estructura propia y resuelve `hsl(var(--x))` en runtime:
  `"bg-background":{n:[{s:[62,1],d:[[[{},"hsl",[[{},"var",["--background"],1]]],"backgroundColor"]]}]}`
  Buscar el valor literal da un falso negativo.
- Para comprobar de verdad que el CSS entro al bundle, buscar la definicion de la variable:
  `grep -ao -- '"--background":{light' bundle.js`. Si aparece, NativeWind funciono.
- Si los estilos se ven rotos en el dispositivo y el bundle contiene esas definiciones, el
  problema es el bundle cacheado en el telefono: recargar la app.

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

### lucide-react-native: el barrel no se tree-shakea (`PERF`)
- El paquete declara **`sideEffects: "False"` como STRING** en vez del booleano `false`, asi que
  Metro no puede descartar nada: `import { Milk } from 'lucide-react-native'` mete **los 1839
  iconos** en el bundle. Medido 2026-09-23: +1.9 MB (5.4 -> 7.3 MB).
- Solucion: importar uno a uno desde `lucide-react-native/icons/<kebab-name>`
  (`import Milk from 'lucide-react-native/icons/milk'`). Verificado: vuelve a 5.4 MB y los
  iconos no usados desaparecen del bundle.
- Comprobarlo tras anadir iconos: exportar con `expo export` y hacer grep de un icono que NO se
  use (p. ej. `Airplay`) sobre el `.hbc`. Si aparece, el barrel se colo por algun sitio.

### Caracteres invisibles en el fuente (`UI`)
- Un regex de rango unicode escrito con los caracteres reales funciona, pero deja marcas
  combinantes invisibles en el archivo. Usar `new RegExp('[\u0300-\u036f]', 'g')`, que mantiene
  el escape visible y editable.
- Al generarlo desde Python: tanto una cadena normal como el reemplazo de `re.sub` interpretan
  `\u`. Hace falta r-string **y** evitar `re.sub` para el reemplazo.

### FlashList v2 / TypeScript 6 (`UI`)
- **FlashList v2 elimino `estimatedItemSize`**: ahora mide solo. Pasarlo da error de tipos.
  Casi toda la documentacion de internet sigue mostrando la v1.
- **TS 6 exige `override`** al redeclarar un miembro de la clase base. Una clase de error
  con `readonly cause` necesita `override readonly cause`, porque `Error.cause` ya existe.

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

### Jest: tests de componente (`UI`)
Verificado 2026-10-05 al escribir el primero:
- `@testing-library/react-native` v14 es **asíncrono**: `await render(...)`,
  `await fireEvent.press(...)`. Ya no existe `extend-expect`; los matchers se registran solos.
- `jest.mock('./hook')` sin fábrica carga el módulo real (y con él Supabase y la validación del
  entorno). Usar fábrica: `jest.mock('./hook', () => ({ useX: jest.fn() }))`.
- Los iconos de lucide son `.mjs` y Jest no los carga: `moduleNameMapper` a `test/mocks`.
- Reanimated necesita `resolver: 'react-native-worklets/jest/resolver'`.

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
- **`security_invoker` aplica los permisos del invocador a TODA la vista**, no solo a la tabla
  principal: una subconsulta a una tabla restringida hace fallar la vista entera para roles sin
  ese permiso. Confirmado 2026-09-23: `catalog_product` (pública) leía `profile` para resolver
  región y daba *permission denied for table profile* a `anon`. Solución: función
  `security definer` sin parámetros que solo lea la fila de `auth.uid()`.
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
- **Un producto puede estar en DOS categorías de la fuente** (un jamón es "Charcutería" y
  "Pollo, carne y pescado"). Recorriendo categoría por categoría, el mismo `external_id` llega
  dos veces al mismo lote y Postgres rechaza el upsert entero: *"ON CONFLICT DO UPDATE command
  cannot affect row a second time"*. Hay que deduplicar por `external_id` antes de escribir.
- **VTEX corta la paginación en ~2500**: `_from=2550` devuelve **400**, no una página vacía.
  Tratarlo como error aborta la corrida y se pierden las categorías pendientes; hay que leerlo
  como fin de categoría. Para pasar del tope hay que bajar a subcategorías de nivel 3.
- **Clasificar con el nombre CRUDO no funciona**: lleva la marca incrustada en medio
  ("Chocolate CORONA de mesa"), así que cualquier regla de varias palabras falla en silencio.
  Clasificar con el nombre ya limpio.
- **El free tier de Supabase son 500 MB**, y `price_snapshot` crece de forma lineal con el
  tiempo. Ingerir el catálogo completo de 3 tiendas daría ~841 MB al año: no cabe. De ahí el
  filtro por categorías de mercado y la retención a 90 días
  ([presupuesto](../../docs/domain/02-ingestion.md#presupuesto-de-almacenamiento)).
- **Free tier: máximo 2 proyectos activos y pausa tras 1 semana sin actividad.** El cron diario
  de ingesta evita la pausa como efecto secundario. Sin backups en free: `supabase db dump`
  periódico para los datos de usuario (el catálogo se regenera con el pipeline).

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
