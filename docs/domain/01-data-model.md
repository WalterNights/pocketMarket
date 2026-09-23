# Modelo de datos

## División fundamental

```
┌──────────────────────────────────────────────────────────┐
│  CATÁLOGO — global, compartido, SOLO LECTURA para la app │
│  store · category · region · store_product               │
│  price_snapshot · current_price · equivalence_*          │
│  Escribe: únicamente el pipeline (service_role)          │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│  USUARIO — privado, RLS por auth.uid()                   │
│  profile · shopping_list · list_item · list_reminder     │
│  Escribe: el usuario dueño, y nadie más                  │
└──────────────────────────────────────────────────────────┘
```

Esta separación es la regla de seguridad más importante del proyecto: **la app nunca escribe en
el catálogo**. Si un cliente pudiera insertar precios, cualquiera podría envenenar los datos de
todos los usuarios.

---

## Catálogo

### `store`

```sql
create table store (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,          -- 'exito' | 'd1' | 'dollarcity' | 'ara'
  name        text not null,
  logo_path   text,
  source_type text not null,                 -- 'api' | 'scraper' | 'manual'
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
```

### `region`

```sql
create table region (
  code text primary key,                     -- 'NACIONAL' | 'BOG' | 'MDE' | 'CLO' ...
  name text not null
);
```

`NACIONAL` es el fallback: las tiendas de precio único (D1, Dollarcity) solo publican en esa
región. La consulta de precio resuelve *región del usuario → NACIONAL*.

### `category`

```sql
create table category (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  name      text not null,
  parent_id uuid references category(id)
);
```

Taxonomía **propia**, no la de cada tienda. Cada adaptador mapea sus categorías a esta. Sin
esto, filtrar "lácteos" daría resultados distintos por tienda.

### `store_product` — la unidad del catálogo

```sql
create table store_product (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references store(id),
  external_id   text not null,               -- SKU en la tienda origen
  ean           text,                        -- código de barras, si la fuente lo publica
  name          text not null,
  brand         text,
  category_id   uuid references category(id),
  unit_kind     text not null default 'unit',-- 'unit' | 'weight' | 'volume'
  unit_value    numeric(10,3),               -- 500
  unit_measure  text,                        -- 'g' | 'kg' | 'ml' | 'l' | 'un'
  image_url     text,
  is_available  boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  unique (store_id, external_id)
);
```

**`is_available` en vez de borrar.** Nunca se elimina un `store_product`: puede haber
`list_item` apuntando a él. Si deja de aparecer en la fuente durante varias corridas, se marca
no disponible y la app lo muestra atenuado con su último precio conocido.

**`unit_value` + `unit_measure`** habilitan el precio por unidad de medida, que es lo que hace
honesta la comparación entre presentaciones distintas. Son opcionales porque muchas fuentes no
lo publican limpio; el adaptador los extrae del nombre cuando puede.

**`ean`** es la llave de oro para equivalencias automáticas. Cuando existe, el matching es
exacto y gratis.

### `price_snapshot` — append-only

```sql
create table price_snapshot (
  id              bigserial primary key,
  store_product_id uuid not null references store_product(id),
  region_code     text not null references region(code),
  price_cop       integer not null,          -- entero: COP no usa centavos
  list_price_cop  integer,                   -- precio antes de descuento, si aplica
  captured_at     timestamptz not null default now()
);
```

**Solo se inserta si el precio cambió** respecto al último snapshot de ese
`(store_product_id, region_code)`. Guardar el mismo precio cada día infla la tabla sin aportar
información. El pipeline compara antes de insertar.

Esta tabla es lo que da gratis: la variación desde que el usuario añadió el producto, el
histórico, y "¿cuánto costaba en marzo?".

### `current_price` — vista materializada

```sql
create materialized view current_price as
select distinct on (store_product_id, region_code)
  store_product_id, region_code, price_cop, list_price_cop, captured_at
from price_snapshot
order by store_product_id, region_code, captured_at desc;

create unique index on current_price (store_product_id, region_code);
```

La app consulta **siempre** esta vista, nunca `price_snapshot` con `ORDER BY ... LIMIT 1` por
producto (eso es un N+1 disfrazado). Se refresca al final de cada corrida de ingesta con
`refresh materialized view concurrently current_price`.

### `equivalence_group` y `equivalence_member`

```sql
create table equivalence_group (
  id         uuid primary key default gen_random_uuid(),
  label      text,                           -- 'Arroz blanco 500 g'
  created_at timestamptz not null default now()
);

create table equivalence_member (
  group_id         uuid not null references equivalence_group(id) on delete cascade,
  store_product_id uuid not null references store_product(id),
  confidence       text not null,            -- 'ean' | 'manual' | 'fuzzy'
  primary key (group_id, store_product_id)
);
```

Capa **opcional**: un producto sin grupo funciona perfectamente. Solo habilita "esto está más
barato en X".

`confidence` es obligatorio y se muestra en la UI: una equivalencia `fuzzy` se presenta como
sugerencia ("¿es lo mismo?"), nunca como hecho. Comparar marca propia de D1 con una marca
nacional es exactamente donde esta app podría mentirle al usuario.

---

## Datos del usuario

### `profile`

```sql
create table profile (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  region_code  text not null default 'NACIONAL' references region(code),
  created_at   timestamptz not null default now()
);
```

### `shopping_list`

```sql
create table shopping_list (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  notes       text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

### `list_item`

```sql
create table list_item (
  id               uuid primary key default gen_random_uuid(),
  list_id          uuid not null references shopping_list(id) on delete cascade,
  store_product_id uuid not null references store_product(id),
  quantity         numeric(10,3) not null default 1,
  note             text,
  is_checked       boolean not null default false,
  position         integer not null default 0,
  price_cop_at_add integer not null,         -- precio congelado al añadir
  created_at       timestamptz not null default now(),

  unique (list_id, store_product_id)
);
```

**`price_cop_at_add`** es lo que permite el caso de uso 7: comparar contra `current_price` y
mostrar "subió $400 desde que lo agregaste". Sin este campo, actualizar el precio borra la
información de que cambió.

`quantity` es `numeric` porque hay productos por peso (0.5 kg de carne), no solo unidades.

### `list_reminder`

```sql
create table list_reminder (
  id               uuid primary key default gen_random_uuid(),
  list_id          uuid not null references shopping_list(id) on delete cascade,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  frequency        text not null,            -- 'weekly' | 'biweekly' | 'monthly'
  weekday          smallint,                 -- 1-7, para weekly/biweekly
  day_of_month     smallint,                 -- 1-31, para monthly
  time_local       time not null,
  anchor_date      date,                     -- ancla de la quincena
  is_enabled       boolean not null default true,
  created_at       timestamptz not null default now()
);
```

La programación real ocurre **en el dispositivo** con notificaciones locales; esta tabla es la
definición, para que sobreviva a reinstalaciones y se sincronice entre dispositivos. Detalles y
límites en [03-reminders.md](03-reminders.md).

---

## Totales: se calculan, no se guardan

El total de una lista **no es una columna**. Se deriva de `list_item × current_price`.
Guardarlo produce un valor que se queda obsoleto en cuanto cambia un precio — justo lo contrario
del propósito de la app.

```sql
create view list_totals as
select
  li.list_id,
  sp.store_id,
  sum(round(cp.price_cop * li.quantity))::integer as subtotal_cop
from list_item li
join store_product sp on sp.id = li.store_product_id
join current_price cp on cp.store_product_id = li.store_product_id
group by li.list_id, sp.store_id;
```

El total general es la suma de los subtotales por tienda. El cliente **no** calcula el total
sumando lo que tiene en memoria: lo pide al servidor, con los precios de ahora.

> La resolución de región (región del usuario, con fallback a `NACIONAL`) se hace en una función
> SQL para que la regla viva en un solo lugar, no repetida en cada consulta.

---

## Índices

Sin estos, las consultas principales se degradan rápido: el catálogo de Éxito ronda decenas de
miles de SKU.

```sql
-- Búsqueda de texto en español, tolerante a errores de tipeo
create index on store_product
  using gin (to_tsvector('spanish', coalesce(name,'') || ' ' || coalesce(brand,'')));
create index on store_product using gin (name gin_trgm_ops);

-- Navegación por tienda y categoría
create index on store_product (store_id, category_id) where is_available;
create index on store_product (ean) where ean is not null;

-- Histórico de precios
create index on price_snapshot (store_product_id, region_code, captured_at desc);

-- Datos del usuario
create index on shopping_list (owner_id) where not is_archived;
create index on list_item (list_id);
```

Requiere las extensiones `pg_trgm` y `unaccent`. La búsqueda debe funcionar sin tildes:
"platano" tiene que encontrar "plátano".

---

## RLS

### Catálogo — lectura para todos, escritura solo del pipeline

```sql
alter table store_product enable row level security;

create policy "catálogo legible por usuarios autenticados"
  on store_product for select
  to authenticated
  using (true);

-- Sin políticas de insert/update/delete: solo service_role (que salta RLS) escribe.
```

Mismo patrón para `store`, `category`, `region`, `price_snapshot`, `equivalence_*`.
**La ausencia de política de escritura es deliberada y es la protección.**

### Datos del usuario — dueño y solo el dueño

```sql
alter table shopping_list enable row level security;

create policy "dueño lee sus listas"    on shopping_list for select
  using (auth.uid() = owner_id);
create policy "dueño crea sus listas"   on shopping_list for insert
  with check (auth.uid() = owner_id);
create policy "dueño edita sus listas"  on shopping_list for update
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "dueño borra sus listas"  on shopping_list for delete
  using (auth.uid() = owner_id);
```

`list_item` y `list_reminder` no tienen `owner_id` directo: la política atraviesa la lista.

```sql
create policy "dueño lee ítems de sus listas"
  on list_item for select
  using (exists (
    select 1 from shopping_list l
    where l.id = list_item.list_id and l.owner_id = auth.uid()
  ));
```

⚠️ Esa subconsulta necesita el índice de `shopping_list (owner_id)` **y** la PK de `list_id`,
o se degrada con listas grandes.

Cada política lleva su test de acceso denegado, según
[`.claude/rules/supabase.md`](../../.claude/rules/supabase.md).

---

## Lo que el cliente nunca decide

- `price_cop` — lo escribe el pipeline. Ni siquiera hay política que permita al cliente tocarlo.
- `price_cop_at_add` — lo pone un trigger leyendo `current_price`, no el payload del cliente.
  Si el cliente lo enviara, podría inventarse un precio anterior y falsear la variación.
- `captured_at`, `created_at`, `updated_at` — `default now()` y triggers. El reloj del
  dispositivo no es confiable.
- Totales — vista en servidor.
