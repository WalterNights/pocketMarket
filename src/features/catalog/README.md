# Feature `catalog` — feature base

Tiendas, categorías, productos y precios: lo que la app **lee** del catálogo público.

**Es un feature base** ([01-overview](../../../docs/architecture/01-overview.md), opción 2):
otros features pueden importarlo, **solo por su `index.ts`**.

| Depende de él | Para qué |
|---|---|
| `lists` | una lista está hecha de productos (`Product`, iconos, presentación, precios de hoy) |

`catalog` no importa de ningún feature. Lo que necesita de otro (p. ej. el botón de cuenta en
la cabecera de Tiendas) le llega compuesto desde `app/` por props.
