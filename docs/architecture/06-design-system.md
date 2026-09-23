# 06 — Design system

## Motor y componentes

**NativeWind v4** como motor de estilos y **[React Native Reusables](https://github.com/founded-labs/react-native-reusables)**
como punto de partida de los componentes. Decidido en [ADR-0002](../adr/0002-estilos.md).

shadcn/ui **no** funciona en React Native (está sobre Radix UI, que es DOM + CSS). RNR es su
port: mismo modelo copy-paste, construido sobre NativeWind y `@rn-primitives/*` — Radix
reimplementado con primitivos nativos accesibles.

> Los componentes de RNR se **copian** a `shared/ui/`. Son código del repo, no una dependencia:
> se someten a las mismas reglas que cualquier archivo del proyecto.

---

## Tokens, no valores

Ningún componente de feature escribe un color, un tamaño de fuente o un espaciado literal.

Adoptamos la **convención de tokens de shadcn**, la misma de `dashboard-front`, definida como
variables CSS que NativeWind resuelve. Los valores siguen la
[dirección visual](../design/00-visual-direction.md): base crema cálida, acentos desaturados,
cero neón.

```css
/* global.css */
:root {
  --background: 40 33% 96%;        /* #FAF8F3 crema cálido — el lienzo */
  --card: 0 0% 100%;               /* blanco puro: se eleva por contraste, no por sombra */
  --card-foreground: 20 8% 11%;
  --foreground: 20 8% 11%;         /* #1F1D1B casi negro cálido, nunca #000 */
  --muted: 40 20% 93%;
  --muted-foreground: 30 7% 45%;   /* #78726B */
  --primary: 20 8% 11%;            /* las acciones son tipográficas, no cromáticas */
  --primary-foreground: 40 33% 96%;
  --destructive: 0 44% 44%;        /* #A33F3F rojo apagado */
  --destructive-foreground: 40 33% 96%;
  --border: 36 23% 88%;            /* #E8E3DA línea apenas visible */
  --input: 36 23% 88%;
  --ring: 20 8% 11%;
  --radius: 0.75rem;

  /* señales de precio — el único color que informa */
  --price-down: 149 27% 33%;       /* #3D6B52 verde salvia apagado */
  --price-up: 16 44% 44%;          /* #A3583F terracota apagado */
}

.dark:root {
  --background: 30 8% 7%;          /* #141311 gris cálido, nunca negro azulado */
  --card: 30 8% 10%;
  --card-foreground: 40 20% 90%;
  --foreground: 40 20% 90%;
  --muted: 30 7% 14%;
  --muted-foreground: 35 8% 58%;
  --primary: 40 20% 90%;
  --primary-foreground: 30 8% 7%;
  --destructive: 0 44% 58%;
  --border: 30 7% 18%;
  --input: 30 7% 18%;
  --price-down: 149 25% 52%;
  --price-up: 16 42% 60%;
}
```

**`--card` blanco sobre `--background` crema** es lo que permite prescindir de sombras: las
tarjetas se separan por superficie y borde. Ver
[dirección visual](../design/00-visual-direction.md#superficies-y-elevación).

```tsx
<View className="flex-1 bg-background px-4">
  <Text className="text-foreground">Total</Text>
  <Text className="text-muted-foreground">Precios de hoy</Text>
</View>
```

Los nombres son **semánticos** (`background`, `muted-foreground`, `destructive`), no descriptivos
(`gray200`). Un token llamado `gray200` no se puede reasignar en modo oscuro sin mentir.

Valores que no son color (espaciado, escala tipográfica) siguen la escala de Tailwind, múltiplos
de 4: la rejilla que usan tanto Material como HIG.

## Dark mode desde el día uno

No es una feature futura. Es un ajuste del sistema que el usuario ya tiene activado, y
retrofitear colores en 80 componentes es mucho más caro que empezar con dos paletas.

```tsx
const scheme = useColorScheme()   // 'light' | 'dark'
```

Regla: si un componente no se ve bien en ambos esquemas, no está terminado.
Incluye barra de estado, splash, iconos adaptativos y el fondo de la ventana nativa (para evitar
el destello blanco al arrancar en modo oscuro).

## Primitivos del design system

`shared/ui/` expone los bloques básicos. Los features **no** importan `Text`, `View`
ni `Pressable` de `react-native` directamente para UI con estilo:

| Primitivo | Por qué existe |
|---|---|
| `<Screen>` | Safe areas, color de fondo, scroll opcional, comportamiento de teclado — en un sitio |
| `<Text>` | Variantes tipográficas, color por token, `allowFontScaling` controlado |
| `<Button>` | Área táctil mínima, estado de carga, feedback háptico, `accessibilityRole` |
| `<Pressable>` | Feedback de pulsación consistente entre iOS y Android |
| `<Input>` | Etiqueta, error, `keyboardType`, `autoComplete`, foco encadenado |
| `<Sheet>` | Bottom sheet nativa con gestos |
| `<Skeleton>` | Estado de carga con la forma del contenido |
| `<EmptyState>` | Los estados vacíos son parte del diseño, no una omisión. Icono de línea + frase + acción, sin ilustración |

El valor no es estético: es que **la accesibilidad y las diferencias de plataforma se resuelven
una vez**, dentro del primitivo, en vez de olvidarse en cada uso.

`Text`, `Button`, `Input`, `Dialog`, `Select` y compañía salen de React Native Reusables y se
adaptan. `Screen`, `Skeleton` y `EmptyState` son propios: responden a necesidades de esta app
que ninguna librería cubre.

### Revisar cada componente adoptado

Un sistema de diseño nacido en web arrastra patrones que en móvil se sienten mal. Copiar un
componente de RNR **no** exime de preguntarse si ese patrón sirve en una pantalla de cinco
pulgadas manejada con el pulgar:

| Patrón de shadcn/ui | Qué espera el usuario en móvil |
|---|---|
| `Dialog` centrado | **Bottom sheet** con gesto de cierre |
| `Select` desplegable | Action sheet o picker nativo |
| `Tooltip` en hover | No hay hover. Long-press o texto visible |
| `DropdownMenu` | Action sheet |
| `Toast` en esquina | Banner respetando safe area, o háptica |
| Tabla de datos | Lista virtualizada con filas táctiles |

## Tipografía

Escala fija y corta; cada variante justifica su existencia:

```
display  32/40  bold
title    24/32  semibold
heading  18/24  semibold
body     16/24  regular      ← por defecto
label    14/20  medium
caption  12/16  regular
```

16pt es el mínimo cómodo para texto de lectura en móvil. Por debajo de 12pt no ponemos nada
que el usuario deba leer.

**Escalado de fuente:** el sistema permite ampliar el texto hasta ~310%. No lo desactivamos
globalmente. Si un layout se rompe a 200%, el layout está mal, no el ajuste del usuario. Usa
`maxFontSizeMultiplier` puntualmente y solo donde el desbordamiento sea inevitable.

## Accesibilidad — mínimos no negociables

| Requisito | Detalle |
|---|---|
| Área táctil | ≥ 44×44 pt (iOS HIG) / 48×48 dp (Material). Usa `hitSlop` si el visual es menor |
| Contraste | ≥ 4.5:1 texto normal, ≥ 3:1 texto grande y elementos de UI (WCAG AA) — **en ambos temas** |
| Etiquetas | Todo control sin texto visible lleva `accessibilityLabel` |
| Roles | `accessibilityRole` y `accessibilityState` (`disabled`, `selected`, `busy`) |
| Color | Nunca el único portador de información (añade icono o texto) |
| Movimiento | Respetar `useReducedMotion()` en animaciones decorativas |
| Foco | Anunciar cambios de pantalla y errores de formulario al lector |

Probar de verdad con VoiceOver (iOS) y TalkBack (Android) antes de cada release. Un lint no
detecta que un `accessibilityLabel` dice algo inútil.

## Safe areas e insets

Notch, isla dinámica, barra de gestos, teclado, barra de estado. Nunca posicionar con valores
fijos: `useSafeAreaInsets()` o el primitivo `<Screen>`. Verificar en un dispositivo con notch
**y** en uno sin él: el fallo aparece en los extremos.

## Iconografía e imágenes

- **Lucide** (`lucide-react-native`) — mismo set que shadcn/ui en web. Solo iconos de línea,
  grosor uniforme, tamaños 16/20/24, color heredado del texto. Ver
  [dirección visual](../design/00-visual-direction.md#iconografía).
- Iconos vectoriales siempre. Nada de PNG para iconos.
- `expo-image` para todo lo remoto: caché en disco, `placeholder` con blurhash, `contentFit`,
  decodificación fuera del hilo de UI.
- Servir imágenes **ya dimensionadas** desde Supabase Storage (transformaciones en URL). Bajar
  una imagen de 4000 px para pintarla a 120 px es el desperdicio más común en apps móviles.
