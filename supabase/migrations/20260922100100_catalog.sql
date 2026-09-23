-- Catalogue: global, shared, READ-ONLY for the app.
-- Only the ingestion pipeline (service_role) writes here. See ADR-0003.

-- ---------------------------------------------------------------------------
-- store
-- ---------------------------------------------------------------------------

create table public.store (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  logo_path   text,
  source_type text not null check (source_type in ('api', 'scraper', 'manual')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.store (slug, name, source_type, is_active) values
  ('exito',      'Éxito',      'api',     true),
  ('d1',         'D1',         'scraper', false),
  ('dollarcity', 'Dollarcity', 'scraper', false),
  ('ara',        'Ara',        'manual',  false);

comment on column public.store.is_active is
  'Only exito is active in v1. The rest ship with their adapter (docs/domain/02-ingestion.md).';

-- ---------------------------------------------------------------------------
-- category
-- ---------------------------------------------------------------------------
-- Our own taxonomy, not each store's. Every adapter maps its categories onto
-- this one, otherwise filtering "lácteos" returns different things per store.

create table public.category (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  parent_id  uuid references public.category(id),
  sort_order smallint not null default 100
);

insert into public.category (slug, name, sort_order) values
  ('viveres',        'Víveres y abarrotes',   10),
  ('frutas-verduras','Frutas y verduras',     20),
  ('carnes',         'Carnes y pescados',     30),
  ('lacteos',        'Lácteos y huevos',      40),
  ('panaderia',      'Panadería',             50),
  ('bebidas',        'Bebidas',               60),
  ('congelados',     'Congelados',            70),
  ('aseo-hogar',     'Aseo del hogar',        80),
  ('cuidado-personal','Cuidado personal',     90),
  ('bebes',          'Bebés',                100),
  ('mascotas',       'Mascotas',             110),
  ('otros',          'Otros',                999);

-- ---------------------------------------------------------------------------
-- store_product — the unit of the catalogue (ADR-0004)
-- ---------------------------------------------------------------------------
-- A product IN a store, never an abstract product. This is what a list item
-- points at, which is why per-store totals are always correct.

create table public.store_product (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.store(id),
  external_id   text not null,
  ean           text check (ean is null or ean ~ '^\d{8,14}$'),
  name          text not null check (length(trim(name)) > 0),
  brand         text,
  category_id   uuid references public.category(id),

  unit_kind     text not null default 'unit'
                  check (unit_kind in ('unit', 'weight', 'volume')),
  unit_value    numeric(10,3) check (unit_value is null or unit_value > 0),
  unit_measure  text check (unit_measure is null or unit_measure in ('g','kg','ml','l','un')),

  image_url     text,
  is_available  boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  -- Accent- and case-insensitive full text over name + brand.
  search_vector tsvector generated always as (
    to_tsvector(
      'spanish',
      public.immutable_unaccent(coalesce(name, '') || ' ' || coalesce(brand, ''))
    )
  ) stored,

  constraint store_product_store_external_uk unique (store_id, external_id),
  -- A measure without its unit (or the other way round) would produce a bogus
  -- unit price. Either both or neither.
  constraint store_product_unit_complete check (
    (unit_value is null and unit_measure is null)
    or (unit_value is not null and unit_measure is not null)
  )
);

comment on table public.store_product is
  'A product in a specific store. NEVER deleted: list_item rows reference it. '
  'If it vanishes from the source, set is_available = false.';

comment on column public.store_product.ean is
  'Barcode when the source publishes it. Enables exact cross-store equivalence.';

create index store_product_search_idx on public.store_product using gin (search_vector);
create index store_product_trgm_idx   on public.store_product using gin (name extensions.gin_trgm_ops);
create index store_product_browse_idx on public.store_product (store_id, category_id) where is_available;
create index store_product_ean_idx    on public.store_product (ean) where ean is not null;
create index store_product_stale_idx  on public.store_product (last_seen_at) where is_available;

-- ---------------------------------------------------------------------------
-- price_snapshot — append only
-- ---------------------------------------------------------------------------
-- A row is inserted ONLY when the price changed. Therefore captured_at means
-- "has had this price since", not "was looked at then" — for that, use
-- store_product.last_seen_at.

create table public.price_snapshot (
  id               bigint generated always as identity primary key,
  store_product_id uuid not null references public.store_product(id),
  region_code      text not null references public.region(code),

  -- Colombian peso has no cents. integer, never float (rules/supabase.md).
  price_cop        integer not null check (price_cop > 0),
  list_price_cop   integer check (list_price_cop is null or list_price_cop > 0),

  captured_at      timestamptz not null default now()
);

comment on table public.price_snapshot is
  'Append-only price history. Insert only when the price actually changed.';

create index price_snapshot_lookup_idx
  on public.price_snapshot (store_product_id, region_code, captured_at desc);

-- ---------------------------------------------------------------------------
-- equivalence — optional layer (ADR-0004)
-- ---------------------------------------------------------------------------
-- A product with no group works perfectly; groups only enable
-- "this same thing is cheaper at X".

create table public.equivalence_group (
  id         uuid primary key default gen_random_uuid(),
  label      text,
  created_at timestamptz not null default now()
);

create table public.equivalence_member (
  group_id         uuid not null references public.equivalence_group(id) on delete cascade,
  store_product_id uuid not null references public.store_product(id),
  -- 'fuzzy' must be shown as a SUGGESTION in the UI, never as a fact.
  confidence       text not null check (confidence in ('ean', 'manual', 'fuzzy')),
  created_at       timestamptz not null default now(),

  primary key (group_id, store_product_id)
);

comment on column public.equivalence_member.confidence is
  'ean/manual render as fact; fuzzy MUST render as a question ("is this the same?"). '
  'Claiming a false equivalence destroys trust in the app.';

create index equivalence_member_product_idx on public.equivalence_member (store_product_id);
