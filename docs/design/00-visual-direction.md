# Dirección visual

> **Estado: guía de referencia, no trabajo en curso.**
> La prioridad actual es la arquitectura y lo funcional. Este documento existe para que, cuando
> se construya UI, las decisiones estéticas ya estén tomadas y no se improvisen pantalla a
> pantalla. Los tokens concretos viven en
> [06-design-system.md](../architecture/06-design-system.md).

## La idea en una frase

**Papel, no pantalla.** Una herramienta de cálculo tranquila que se abre en el pasillo del
supermercado, no una app que compite por tu atención.

La app muestra números que el usuario necesita leer rápido y creer. Todo lo que decore, brille o
se mueva de más compite contra eso.

## Principios

| Sí | No |
|---|---|
| Fondo blanco tirando a crema, cálido | Blanco puro clínico, ni fondos oscuros por defecto |
| Contraste por **tipografía y espacio** | Contraste por color saturado |
| Separación por **borde sutil y superficie** | Separación por sombra |
| Iconos de línea, simples | Iconos rellenos, con degradado o multicolor |
| Un solo acento, usado poco | Paleta de acentos compitiendo |
| Color como **señal**, no como decoración | Color porque sí |
| Jerarquía por tamaño y peso | Jerarquía por color |
| Movimiento funcional (transición, feedback) | Animación decorativa |

**Nada de neón.** Sin glow, sin degradados vivos, sin glassmorphism, sin sombras de color, sin
bordes luminosos, sin modo oscuro con acentos fluorescentes.

## Color

Base crema cálida. El blanco puro se reserva para las **tarjetas**, que así se separan del fondo
sin necesitar sombra.

```
Claro
  background        #FAF8F3   crema cálido — el lienzo
  card              #FFFFFF   blanco puro — se eleva por contraste, no por sombra
  foreground        #1F1D1B   casi negro cálido, nunca #000
  muted-foreground  #78726B   texto secundario
  border            #E8E3DA   línea apenas visible
  primary           #1F1D1B   las acciones son tipográficas, no cromáticas
```

```
Oscuro
  background        #141311   gris cálido muy oscuro, nunca negro azulado
  card              #1C1A18
  foreground        #EDE9E1
  muted-foreground  #9A938A
  border            #302C28
```

### Señales de precio

Es el único lugar donde entra color, porque es donde el color **informa**:

```
  price-down        #3D6B52   verde salvia apagado — bajó de precio
  price-up          #A3583F   terracota apagado — subió de precio
  destructive       #A33F3F   rojo apagado — destructivo
```

Desaturados a propósito. Un verde y un rojo de semáforo convertirían una lista de mercado en un
tablero de trading.

> El color **nunca** es el único portador de la señal. Una variación de precio lleva también
> flecha y cifra: `↑ $400`. Ver accesibilidad en
> [06-design-system.md](../architecture/06-design-system.md).

## Superficies y elevación

**Regla: separar con borde y superficie, no con sombra.**

| Elemento | Cómo se separa |
|---|---|
| Tarjeta sobre fondo | Superficie blanca sobre crema + borde 1px |
| Secciones de una lista | Espacio en blanco + separador fino |
| Barra inferior de totales | Borde superior + superficie |
| Bottom sheet, menú flotante | **Única** excepción: sombra suave, difusa, sin color |

Cero `elevation` alta en Android, cero sombras apiladas. Si algo necesita sombra para leerse, el
problema es el contraste de la superficie.

## Tipografía

La jerarquía la hace el **tamaño y el peso**, no el color ni las mayúsculas.

```
display   32/40  semibold    total general
title     24/32  semibold    nombre de lista
heading   18/24  medium      tienda, sección
body      16/24  regular     nombre de producto        ← por defecto
label     14/20  medium      etiquetas, unidades
caption   12/16  regular     "actualizado hace 3 h"
```

**Los precios son tabulares.** Activar variante numérica tabular para que las cifras se alineen
en columna en las listas. Un total que baila al cambiar de dígito se lee mal y se ve descuidado.

Sin mayúsculas forzadas, sin `letter-spacing` exagerado, sin texto bajo 12pt.

## Iconografía

**Lucide** (`lucide-react-native`) — el mismo set que shadcn/ui en tus proyectos web, y es
minimalista por diseño.

- Solo iconos de **línea**. Nada relleno.
- Grosor uniforme, 1.5–2 px. No mezclar grosores.
- Tamaños de la escala: 16 / 20 / 24. Nada intermedio.
- Color heredado del texto (`currentColor`), no coloreado aparte.
- Un icono **acompaña** una etiqueta; rara vez la sustituye. Si va solo, lleva
  `accessibilityLabel`.
- Sin ilustraciones decorativas. Los estados vacíos usan un icono grande y texto, no una escena.

## Espaciado y densidad

- Rejilla de 4. Espaciado generoso: el aire es lo que hace que esto parezca tranquilo.
- Margen lateral de pantalla: 16 px.
- Densidad **media**: en una lista de mercado hay que ver varios productos, pero cada fila debe
  poder tocarse con el pulgar. Alto mínimo de fila: 56 px.
- Radios suaves y consistentes: 12 px en tarjetas, 8 px en controles, `full` solo en avatares y
  chips.

## Movimiento

- Transiciones de pantalla: las nativas. Sin reemplazos personalizados.
- Duración 150–250 ms, curva estándar. Nada de rebotes ni resortes exagerados.
- Feedback de pulsación: cambio de opacidad o de superficie. Sin ondas expansivas de color.
- Háptica sutil al marcar un producto y al completar una lista. En nada más.
- Respetar `useReducedMotion()`.

## Cómo se ve el dominio

Traducción de los principios a las pantallas que importan:

**Fila de producto** — nombre en `body`, tienda y medida en `caption` gris, precio a la derecha
en tabular. El precio por unidad (`$/100 g`) en `caption`, debajo, porque es contexto y no el
dato principal.

**Variación de precio** — discreta, junto al precio: `↑ $400` en terracota. No un badge, no una
píldora de color.

**Totales** — barra inferior fija. Total general en `display`; desglose por tienda en `label`.
Es el número por el que existe la app: merece el mayor tamaño de la pantalla y nada más
compitiendo a su lado.

**Frescura del dato** — `caption` gris, sin alarma: *"Precios de hoy, 6:00 a. m."*. Si el dato
está rancio, se dice con palabras, no con un icono rojo.

**Estado vacío** — un icono de línea, una frase y un botón. Sin ilustración.

## Qué NO hacer

- ❌ Degradados de fondo, glow, glassmorphism, sombras de color.
- ❌ Acentos fluorescentes en modo oscuro.
- ❌ Badges de colores para categorías: son ruido en una lista de compra.
- ❌ Sombras apiladas o `elevation` alta.
- ❌ Iconos rellenos, multicolor o de sets mezclados.
- ❌ Animaciones de entrada por elemento en listas.
- ❌ Negro puro `#000` o blanco puro como **fondo**.
- ❌ Verde y rojo saturados para variaciones de precio.
- ❌ Más de un color de acento por pantalla.
