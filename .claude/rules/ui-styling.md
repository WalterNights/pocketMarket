---
paths:
  - "src/shared/ui/**"
  - "src/features/**/components/**"
  - "app/**/*.tsx"
---

# Reglas — UI, estilos y accesibilidad

Referencia completa: [docs/architecture/06-design-system.md](../../docs/architecture/06-design-system.md)
Dirección estética: [docs/design/00-visual-direction.md](../../docs/design/00-visual-direction.md)

## Motor y componentes

**NativeWind v4** + componentes copiados de **React Native Reusables** ([ADR-0002](../../docs/adr/0002-estilos.md)).

- shadcn/ui **no** se puede usar en React Native (es Radix: DOM + CSS). RNR es su port.
- Los componentes de RNR se **copian** a `shared/ui/`: son código del repo, no una dependencia,
  y cumplen las mismas reglas que cualquier archivo.
- Al adoptar un componente, verificar que el patrón tiene sentido en móvil: un `Dialog` suele
  ser un bottom sheet, un `Select` un action sheet, y el hover no existe.

## Design system

- Los features **no** importan `Text`, `Pressable` ni contenedores con estilo desde
  `react-native`. Usan los primitivos de `@/shared/ui`.
  (`View` sin estilo para layout estructural es aceptable.)
- Nada de colores ni valores literales en componentes de feature. Siempre clases con tokens:
  `bg-background`, `text-muted-foreground`, no `bg-[#f5f5f7]`.
- Un componente que se usa en un solo feature vive en ese feature. Se promueve a `shared/ui`
  cuando lo usan tres.
- Espaciados desde la escala de Tailwind. Sin valores arbitrarios (`p-[13px]`) salvo
  justificación.

## Estética — no negociable

Ver [dirección visual](../../docs/design/00-visual-direction.md).

- **Separar con borde y superficie, no con sombra.** `card` blanco sobre `background` crema.
  Única excepción con sombra: bottom sheets y menús flotantes, suave y sin color.
- **Sin neón:** nada de glow, degradados vivos, glassmorphism, sombras de color ni acentos
  fluorescentes en modo oscuro.
- **Jerarquía por tamaño y peso tipográfico**, no por color.
- **El color solo informa** (variación de precio, destructivo) y nunca es el único portador de
  la señal: siempre acompañado de texto o icono.
- **Iconos Lucide, solo de línea**, grosor uniforme, tamaños 16/20/24, color heredado del texto.
- **Precios con variante numérica tabular** para que las cifras se alineen en columna.
- Sin badges de color para categorías, sin animaciones de entrada por elemento de lista.

## Temas

- **Todo componente funciona en claro y oscuro.** Si no se ve bien en ambos, no está terminado.
- Tokens semánticos con la convención de shadcn (`background`, `foreground`, `muted-foreground`,
  `primary`, `destructive`, `border`), no descriptivos (`gray200`).
- Definidos como variables CSS en `global.css`, con su bloque `.dark:root`.
- Incluye barra de estado, splash, iconos adaptativos y fondo nativo de ventana.

## Accesibilidad — mínimos obligatorios

| Requisito | Umbral |
|---|---|
| Área táctil | ≥ 44×44 pt / 48×48 dp (`hitSlop` si el visual es menor) |
| Contraste | ≥ 4.5:1 texto normal, ≥ 3:1 texto grande y UI — **en ambos temas** |
| Etiquetas | `accessibilityLabel` en todo control sin texto visible |
| Roles y estado | `accessibilityRole` + `accessibilityState` (`disabled`, `selected`, `busy`) |
| Color | Nunca el único portador de información |
| Movimiento | Respetar `useReducedMotion()` en animación decorativa |

- No desactivar `allowFontScaling` globalmente. Si el layout se rompe al 200%, el layout está mal.
- `maxFontSizeMultiplier` solo puntual y justificado.

## Layout

- Safe areas con `useSafeAreaInsets()` o el primitivo `<Screen>`. Nunca valores fijos para
  esquivar notch o barra de gestos.
- Teclado: `KeyboardAvoidingView` o `keyboard-controller`. Un input tapado por el teclado es
  un bug bloqueante.
- Probar en dispositivo con notch **y** sin él.
- Sin dimensiones fijas en px que rompan con fuentes grandes o pantallas pequeñas.

## Listas y scroll

- `FlashList` para cualquier colección remota o de longitud desconocida.
- **Nunca** `ScrollView` + `.map()` sobre datos remotos.
- `estimatedItemSize` siempre.
- Sin lógica pesada en `renderItem`: formateo memoizado o precalculado.

## Imágenes

- `expo-image` para todo lo remoto, con `cachePolicy`, `contentFit` y `placeholder` (blurhash).
- Dimensiones explícitas en el contenedor para evitar reflow.
- Pedir a Supabase Storage la transformación al tamaño de pantalla. Nunca la original.
- Iconos vectoriales. Sin PNG para iconos.

## Animación

- Reanimated worklets. `useSharedValue` para valores por frame.
- Animar `transform` y `opacity`. No `width`, `height`, `top` ni `margin`.
- Transiciones de pantalla: las hace el navegador nativo.
- `runOnJS` solo al final del gesto.

## Estados de UI

Toda vista con datos remotos pinta los cuatro:

- `loading` → skeleton con la forma del contenido, no spinner centrado.
- `error` → mensaje accionable **con botón de reintento**.
- `empty` → icono de línea + frase + acción primaria. **Sin ilustración** (ver dirección visual).
- `data` → el contenido.

## Textos

- Textos de usuario en **español**, listos para extraer a i18n (sin concatenar fragmentos).
- Sin strings hardcodeados repartidos: constantes o módulo de textos del feature.
- Errores en lenguaje de usuario, no `Error: 23505 duplicate key`.
