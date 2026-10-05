# Bitácora

> Registro **cronológico** de las sesiones de trabajo: qué se hizo, qué se decidió y qué problemas
> aparecieron. La entrada más reciente va **arriba**.
>
> No sustituye a nada: [ESTADO.md](ESTADO.md) es la foto de **hoy**, los [ADR](adr/) explican el
> **porqué** de cada decisión y [known-issues](../.claude/rules/known-issues.md) guarda cada
> problema con su causa y su prevención. Aquí queda **el orden en que pasaron las cosas**, para
> poder reconstruir cómo se llegó a cada punto.
>
> **Cómo añadir una entrada:** al cerrar una sesión, una sección nueva arriba con la fecha y un
> título. Lo hecho, lo decidido (con enlace al ADR) y lo que se rompió (con su ID de
> known-issues). Lo que quedó pendiente va en ESTADO, no aquí.

---

## 2026-10-05 — Cuatro cadenas con precios, todas en el mapa y lista por cercanía

**Hecho** ([plan 0003](plans/0003-mas-tiendas-mvp.md))

- **Precios de tres cadenas nuevas.** D1 y Olímpica usan la misma API VTEX que el Éxito, así
  que el adaptador del Éxito pasó a ser uno genérico (`vtex-catalog.ts`) y cada cadena es una
  configuración. Supermú tiene adaptador propio (Shopify). Cargados: Olímpica 12.080, Supermú
  5.772 y D1 1.145, con 0 ilegibles.
- **Sucursales de siete cadenas más**: Olímpica, Jumbo y Carulla desde su localizador; Supermú,
  La Vaquita Express y Mercado Madrid desde un archivo curado; Ísimo geocodificando sus
  direcciones con Nominatim (137 de 310 ubicadas con seguridad).
- **Lista de inicio por cercanía**: función `stores_near`, origen compartido entre lista y mapa
  (Zustand + MMKV; solo se guarda la ciudad) y hoja para elegir ubicación o ciudad.
- **El mapa ya no tumba la app** si el binario no trae MapLibre: se carga al abrirlo.
- **Clasificador**: capas nuevas de sustantivo inicial, no comestibles y congelados; 1.545
  productos reubicados al reclasificar.
- **Buscador por prefijo**: "g", "go", "gom" ya encuentran "gomitas". Antes solo casaban
  palabras completas.
- Primer **test de componente** del proyecto (lista de tiendas). Jest 318 → 647.

**Decidido**

- [ADR-0008](adr/0008-cadenas-del-mvp.md): qué cadenas llevan precios, lista por cercanía y
  reglas para aceptar una dirección geocodificada.

**Problemas**

- `EXPO-004` (contención), `ING-010` a `ING-014`, `DATA-001`, `SB-002` y `BUILD-002` en
  known-issues.
- Una revisión independiente del diff encontró 9 fallos importantes, todos corregidos antes de
  la carga definitiva:
  - medidas: "1.200 Kg" leído como 1.200 kg y multipacks leídos como una unidad;
  - Olímpica: un producto en dos pasillos se quedaba con el último;
  - geocodificación: reglas demasiado laxas (pines a media calle);
  - lista: la distancia se medía desde un punto redondeado a 1 km.
- Una **segunda revisión**, sobre las correcciones, encontró más:
  - el buscador por prefijo devolvía ruido ("pera" → juguetes para perros): `DATA-001`;
  - el Éxito tenía seis pasillos truncados, no uno, y se leía la mitad del catálogo: `ING-013`.
    Ahora se recorre en 74 subcategorías;
  - tiendas de Ísimo ubicadas en una vereda a 10 km del pueblo;
  - helados repartidos por sabor y 225 productos de aseo en pasillos de comida;
  - combos y "six pack" leídos como una sola unidad.
- Windows bloqueó el ejecutable de pnpm a mitad de sesión (`BUILD-002`); se siguió lanzando las
  herramientas con Node.
- Logo definitivo en icono y pantalla de arranque (requiere build nueva para verse).
- Nueva guía: [publicar en Android](guias/publicar-android.md).
- `D1 requiere navegador` era falso: lo decía la documentación desde el primer día y nadie lo
  había comprobado.

---

## 2026-10-05 — Revisión general de código

**Hecho**

- Revisión de **todo** el código (no solo el diff) con `rn-review` más criterios de clean code,
  SOLID, bucles, callbacks y logging: 4 revisores en paralelo por área y 4 agentes de corrección
  con archivos exclusivos. 3 críticos y ~43 importantes, **todos corregidos**; Jest 249 → 318,
  pgTAP 62 → 85.
- **Críticos:**
  - `lists` importaba otros features sin declararlo: `auth`, `catalog` y `reminders` quedan
    declarados como features base en su README; el grafo, en
    [01-overview](architecture/01-overview.md).
  - La ingesta duplicaba snapshots de precio entre lotes.
  - Faltaba el corte obligatorio de precios absurdos (×10).
- **Lo más relevante entre los importantes:**
  - La caché se limpia en **cualquier** fin de sesión (no solo con el botón).
  - `save_list` acota lo que recibe (NaN, nombre, número de productos); tests RLS de avisos,
    perfiles, ítems y sucursales.
  - Navegación: la última ruta buena sobrevive a un recálculo fallido; llegada medida contra la
    tienda; la cámara encuadra una vez y deja de seguir si el usuario mueve el mapa ("Centrar");
    capas del mapa memoizadas; timeouts en toda la cadena de la ruta.
  - Iconos y etiquetas por palabra entera (el aguacate ya no es "Botella").
  - Componentes compartidos `ErrorState` y `NotFound`; TanStack conectado al ciclo de vida
    (`query-lifecycle.ts`); sin reintentos ante errores del cliente.
  - Ingesta: productos retirados tras 3 días ausentes, páginas/peticiones perdidas en el reporte,
    timeouts y reintentos de red, saturación de la cuadrícula detectada.

**Aplazado** (ver ESTADO): colores en modo oscuro, persistencia MMKV, NetInfo (exige build
nueva), retención de `price_snapshot` y cron de precios.

---

## 2026-10-04 — Mapa de tiendas, rutas y navegación en vivo

**Hecho**

- **Sucursales de las 4 cadenas en la base.** Tabla `store_branch` con PostGIS y la función
  `nearest_branches`: *las 30 más cercanas, nunca a más de 25 km*, que se adapta sola entre una
  ciudad y un pueblo. Catálogo público de solo lectura; 12 tests pgTAP.
- **Ingesta de sucursales** (`pnpm run branches`), aparte del cron de precios y pensada mensual.
  Fuentes investigadas con llamadas reales:
  - Ara: su localizador, 1 llamada → 1.657 tiendas.
  - Dollarcity: su localizador por coordenadas → 421.
  - Éxito: VTEX *pickup points* → 154 (cada tienda llega con dos ids; se unifican por número).
  - D1: VTEX por cuadrícula nacional (25.226 lecturas) → 2.325.
  - **4.557 tiendas, 0 ilegibles.** Fixtures reales y 16 tests. Workflow `branches.yml` en
    manual hasta que exista el Supabase remoto.
- **Pantalla de mapa** (icono en la cabecera de Tiendas): mapa arriba, lista abajo; "Usar mi
  ubicación" pide el permiso al tocarlo; sin permiso se elige ciudad.
- **Rutas y navegación en vivo** dentro de la app: "Ir a pie" / "Ir en vehículo" → mapa a pantalla
  completa, tiempo y distancia restantes que se recalculan en el teléfono, ruta nueva solo si el
  usuario se desvía, aviso de llegada y "Cancelar ruta". Función `supabase/functions/route`.

**Decidido**

- [ADR-0006](adr/0006-mapa-maplibre.md): **MapLibre + OpenFreeMap** en vez de Google Maps.
  Google exige una cuenta de facturación que no hay. El estilo `positron` no tiene ninguna capa
  de negocios, así que "solo nuestras tiendas" sale de fábrica.
- [ADR-0007](adr/0007-rutas-openrouteservice.md): **OpenRouteService** para calcular rutas,
  detrás de una Edge Function para que su key no entre en la app. Se permite **GPS continuo solo
  durante una navegación activa** (excepción documentada a la regla "una sola lectura"). Se
  quitaron Google Maps y Waze.
- Radio de búsqueda adaptable por construcción en la consulta, no por ciudad.
- `db:lint` limitado al esquema `public`: los avisos venían de funciones internas de PostGIS.

**Problemas**

- `ING-009`: Dollarcity sirve su certificado TLS sin el intermedio. Resuelto añadiendo el
  intermedio público a los de confianza del runner, **sin desactivar la verificación**.
- `EXPO-004`: `TurboModuleRegistry ... could not be found` al usar un módulo nativo nuevo con la
  build vieja instalada. Orden correcto: build → instalar → Metro.
- La key de OpenRouteService fallaba con 403: le faltaba el `=` final al copiarla. De paso se
  arregló que la app no leía el código de error de la función.

---

## 2026-09-24 — Cuentas, listas guardadas, avisos y development build

**Hecho**

- **Clasificador:** la comida de mascotas salía en Pollo; 292 productos reubicados (`ING-008`).
- **Autenticación** con email y contraseña; el catálogo sigue público
  ([ADR-0005](adr/0005-autenticacion.md)).
- **Listas guardadas:** guardar con nombre (`save_list`, una transacción), "Mis listas" con el
  total de hoy y la variación, edición que conserva el precio de referencia.
- **Avisos** semanal, quincenal y mensual, programados como fechas concretas con reconciliación
  idempotente ([03-reminders](domain/03-reminders.md)). Pantalla de diagnóstico solo en
  desarrollo (Tu cuenta → *Diagnóstico de avisos*).
- **Development build con EAS:** cuenta, proyecto `@walternights/pocket-market`, `eas.json`,
  `expo-dev-client` e icono provisional. Guía en [guias/probar-avisos.md](guias/probar-avisos.md).
- Commits `091aaeb` (mascotas) y `22839f7` (cuentas, listas y avisos), subidos a `main`.

**Decidido**

- [ADR-0005](adr/0005-autenticacion.md): email + contraseña ahora, OAuth después; la sesión se
  guarda **troceada dentro de SecureStore** porque mide 2.209 bytes y el límite es ~2.048.
- Los avisos se programan todos como fechas concretas: el trigger mensual nativo se salta los
  meses cortos.
- Compilar en la nube (EAS) en vez de Android Studio: las rutas largas de pnpm rompen la
  compilación C++ en Windows.

**Problemas**

- `SB-001`: Hyper-V reservó los puertos de Supabase. Se movió a **553xx**.
- `SEC-001`: la sesión no cabía en un valor de SecureStore.
- `EXPO-001`: las rutas tipadas se corrompen con Metro corriendo en Windows.
- `EXPO-002`: el router cambió la IP del PC y el teléfono no encontraba Supabase.
- `EXPO-003`: importar `expo-notifications` tumba la app entera en Expo Go para Android.
- `BUILD-001`: la primera build falló por el splash sin imagen.

---

## 2026-09-22 / 23 — Arranque: stack, catálogo de Éxito y taxonomía

**Hecho**

- Andamiaje Expo SDK 57 + Supabase local con el gate de calidad en verde.
- Catálogo legible sin cuenta; búsqueda, tiendas, categorías y hoja de producto.
- Borrador de lista con total por tienda y selección de cantidad por presentación.
- **Ingesta de Éxito** desde su API VTEX pública: 13.750 productos con precio real.
- Taxonomía colombiana granular (39 categorías) y un clasificador por capas: modificadores,
  excepciones, forma, ingrediente y frescos con llave.

**Decidido**

- [ADR-0001](adr/0001-stack-base.md) a [ADR-0004](adr/0004-catalogo-y-equivalencias.md): stack,
  estilos, ingesta centralizada y `store_product` como unidad.
- Planes escritos: [0001](plans/0001-mapa-de-tiendas.md) (mapa) y
  [0002](plans/0002-cron-de-ingesta-diaria.md) (cron diario).

**Problemas**

- `ING-001` a `ING-007`: tildes en las reglas, ingrediente frente a forma, un 500 que mataba la
  corrida, el umbral que confundía agotado con ilegible, el tope de paginación de VTEX, búsqueda
  por subcadena y un catálogo escrito pero no publicado.
- NativeWind y lucide: el diagnóstico del CSS en el bundle y el barrel de iconos que no se
  tree-shakea (trampas en known-issues).
