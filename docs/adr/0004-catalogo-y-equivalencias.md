# ADR-0004: `store_product` como unidad de catálogo, equivalencias como capa opcional

- **Fecha:** 2026-09-22
- **Estado:** Aceptada

## Contexto

La app permite armar una lista con productos de varias tiendas y muestra **total general** y
**total por tienda**. Eso plantea la pregunta más difícil del dominio:

> ¿"Arroz blanco 500 g" del Éxito y "Arroz blanco 500 g" de D1 son el mismo producto?

Los hard discounters colombianos (D1, Ara, Dollarcity) venden mayoritariamente **marca propia**.
La leche de D1 no tiene equivalente exacto en el Éxito: son productos distintos, de fabricantes
distintos, con calidad y precio distintos. Muchos ni siquiera publican código de barras.

Forzar un catálogo unificado significaría decidir por el usuario que dos cosas son iguales
cuando a menudo no lo son.

## Opciones consideradas

| Opción | A favor | En contra |
|---|---|---|
| **Producto por tienda + equivalencias opcionales** | Siempre correcto; comparación donde de verdad aplica; crece por partes | Dos conceptos en el modelo |
| Solo producto por tienda | El modelo más simple posible | No permite "esto está más barato en X", que es alto valor |
| Producto canónico desde el inicio | Comparación uniforme en toda la app | Matching sin EAN es difuso; las marcas propias no tienen equivalente; riesgo de mentir al usuario |

## Decisión

**La unidad del catálogo es `store_product`: un producto *en una tienda*.**

Un `list_item` referencia un `store_product`. De ahí se derivan dos propiedades:

- El **total por tienda** es una agrupación directa. No requiere resolver ninguna ambigüedad.
- El total **nunca miente**, porque nunca asume equivalencias que no existen.

**Encima**, una capa opcional de equivalencias (`equivalence_group` + `equivalence_member`) que
habilita "esto mismo está más barato en X". Cada pertenencia lleva un `confidence`:

| `confidence` | Origen | Cómo se presenta en la UI |
|---|---|---|
| `ean` | Mismo código de barras | Como un hecho |
| `manual` | Curado a mano | Como un hecho |
| `fuzzy` | Coincidencia algorítmica de nombre, marca y medida | Como **sugerencia**: "¿es lo mismo?" |

Un producto sin grupo funciona perfectamente; simplemente no ofrece comparación.

Además, `unit_value` + `unit_measure` habilitan el **precio por unidad de medida** ($/100 g),
que permite comparar presentaciones distintas sin afirmar que sean el mismo producto. Suele ser
más honesto y más útil que la equivalencia misma.

## Consecuencias

**Positivas**
- Los totales son correctos por construcción, desde el primer día.
- La app puede lanzarse sin ninguna equivalencia y seguir siendo útil.
- Las equivalencias por EAN salen gratis donde la fuente publica código de barras.
- `confidence` obliga a que la UI distinga entre hecho y sugerencia.
- Añadir una tienda no exige reconciliar su catálogo con los existentes.

**Negativas (aceptadas)**
- Dos conceptos (producto de tienda y grupo de equivalencia) en vez de uno.
- Comparar entre tiendas solo funciona donde hay equivalencia; al principio, poco.
- Las equivalencias `manual` requieren curación, que es trabajo humano recurrente.
- El mismo producto real aparece varias veces en una búsqueda, una por tienda. La UI debe
  agrupar visualmente para que no se sienta ruidoso.

**Qué invalidaría esta decisión**
- Que la mayoría de fuentes publiquen EAN fiable → el matching automático dejaría de ser difuso
  y un catálogo canónico sería viable.
- Que los usuarios ignoren la comparación entre tiendas → eliminar la capa de equivalencias.
- Que exista una fuente externa de producto canónico colombiano suficientemente buena.

## Nota de diseño de producto

La app **nunca** presenta una equivalencia `fuzzy` como un hecho. El daño de decirle a alguien
"cómpralo en D1, está más barato" cuando no es el mismo producto es mayor que el beneficio de
mostrar una comparación de más.
