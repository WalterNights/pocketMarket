# Dominio — Pocket Market

## Qué es

Una app de bolsillo para **planear el mercado y saber cuánto va a costar antes de ir**.

No es una app de compra. No hay pasarela de pago, ni pedido, ni entrega. El usuario arma una
lista con productos reales de tiendas reales, a precios reales y actualizados, y la app le dice
cuánto necesita — en total y desglosado por tienda.

## El usuario y su problema

> "Necesito hacer mercado este fin de semana. ¿Cuánto tengo que sacar? ¿Me conviene ir al Éxito
> o al D1? ¿Qué me costó esto el mes pasado?"

Hoy eso se resuelve con una nota en el teléfono y precios de memoria, que siempre están
desactualizados. El valor de la app es que **los precios son los de la tienda, hoy**.

## Casos de uso centrales

| # | Caso | Qué resuelve |
|---|---|---|
| 1 | Buscar un producto y ver su precio actual por tienda | Saber cuánto cuesta realmente |
| 2 | Añadir productos de **varias tiendas** a una lista | El mercado real se hace en más de un sitio |
| 3 | Ver **total general** y **total por tienda** | "Saco $90.000: $48.000 para el Éxito y $32.000 para el D1" |
| 4 | Guardar listas reutilizables | El mercado de cada mes se parece al anterior |
| 5 | Recordatorios periódicos (semanal, quincenal, mensual) | No olvidar hacer el mercado |
| 6 | Que los precios de la lista se actualicen solos | Una lista guardada en marzo sirve en septiembre |
| 7 | Ver cuánto **cambió** un precio desde que lo agregué | Es la señal más útil para decidir |

Los casos 6 y 7 van juntos: actualizar el precio en silencio esconde información. La app
actualiza **y muestra la variación**.

## Tiendas objetivo y sus fuentes

| Tienda | Fuente | Estado | Dificultad |
|---|---|---|---|
| **Éxito** | VTEX — API de catálogo (`/api/catalog_system/pub/products/search`) | **v1** | 🟢 JSON estructurado |
| **D1** | `tiendasd1.com` — tienda online con domicilios | v2 | 🟡 Requiere navegador |
| **Dollarcity** | `dollarcity.com/co` — catálogo online | v2 | 🟡 Requiere navegador |
| **Ara** | Sin tienda online; solo app con folletos de promociones | v3 | 🔴 Sin catálogo estructurado |

**Ara es el caso duro:** no publica catálogo con precios. Sus datos tendrían que salir de
folletos (imagen/PDF) o de carga manual. Queda fuera del alcance automatizable hasta que exista
una fuente fiable; se documenta aquí para que nadie vuelva a investigarlo desde cero.

Cada tienda entra al sistema como un **adaptador de fuente** que implementa la misma interfaz
(ver [02-ingestion.md](02-ingestion.md)). Añadir una tienda no toca la app.

## Las tres decisiones que definen el sistema

### 1. La ingesta es centralizada; la app solo lee

La app **nunca** scrapea. Un pipeline en servidor obtiene, normaliza y guarda precios en
Supabase; la app los consulta. Razonado en [ADR-0003](../adr/0003-ingesta-centralizada.md).

### 2. El ítem de una lista pertenece a una tienda

La unidad del catálogo es `store_product`: *este producto, en esta tienda*. No un producto
abstracto. Por eso el total por tienda siempre es correcto y nunca compara lo incomparable.

Encima de eso hay una capa **opcional** de equivalencias que permite decir "esto mismo está más
barato en X" cuando de verdad es lo mismo. Razonado en
[ADR-0004](../adr/0004-catalogo-y-equivalencias.md).

### 3. Los precios son históricos, no un campo mutable

`price_snapshot` es append-only. El precio "actual" es el último snapshot. Esto da gratis el
caso 7 (variación), las tendencias y la respuesta a "¿cuánto me costó esto en marzo?".

## Lo que la app NO hace

Fijarlo evita que el alcance crezca solo:

- ❌ No compra, no reserva, no paga, no pide a domicilio.
- ❌ No garantiza que el precio mostrado sea el de la caja registradora. Es una **estimación
  basada en el precio publicado** por la tienda. La app lo dice explícitamente en la UI.
- ❌ No gestiona inventario de despensa ni fechas de vencimiento.
- ❌ No hace recetas ni listas por plan de comidas.
- ❌ No compara productos que no son equivalentes solo porque se parezcan.

## Vocabulario del dominio

Usar estos términos en código, tablas y UI. Sin sinónimos.

| Término | Significado | **No** confundir con |
|---|---|---|
| `store` | Cadena: Éxito, D1, Dollarcity, Ara | Local físico |
| `store_product` | Un producto **en una tienda** concreta. La unidad del catálogo | Producto abstracto |
| `price_snapshot` | Precio observado en un momento y una región | Precio actual |
| `current_price` | Último snapshot conocido por producto y región | Precio de caja |
| `equivalence_group` | Conjunto de `store_product` considerados el mismo producto | Categoría |
| `shopping_list` | Lista guardada del usuario | Carrito de compra |
| `list_item` | Un `store_product` + cantidad dentro de una lista | Pedido |
| `region` | Ámbito de precio: `BOG`, `MDE`, `NACIONAL` | Dirección del usuario |
| `unit_price` | Precio por unidad de medida ($/100 g) | Precio del empaque |

**`unit_price` merece atención:** es la métrica que hace honesta la comparación entre un hard
discounter y una marca tradicional. Un arroz de $4.200 × 500 g es más caro que uno de $7.500 ×
1 kg, y sin normalizar por medida la app engañaría al usuario.

## Moneda

Peso colombiano, **entero**. `price_cop integer`, nunca decimal ni float. El retail colombiano
no maneja centavos, y los flotantes en dinero son un error de diseño en cualquier moneda.

Formateo en UI con separador de miles: `$ 12.450`.

## Documentos de dominio

| Documento | Contenido |
|---|---|
| [01-data-model.md](01-data-model.md) | Tablas, relaciones, índices, RLS |
| [02-ingestion.md](02-ingestion.md) | Pipeline, adaptadores de tienda, cadencia |
| [03-reminders.md](03-reminders.md) | Recordatorios periódicos y sus límites en iOS/Android |
