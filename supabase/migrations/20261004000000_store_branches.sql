-- Store branches: where each chain's physical shops are, for the map.
--
-- Public catalogue, like store_product: anyone may read, only service_role
-- writes, and the absence of a write policy IS the protection
-- (rules/supabase.md). Branches have their own rhythm — a shop does not move
-- every night — so they are loaded by their own pipeline, not the daily
-- price run (docs/plans/0001-mapa-de-tiendas.md).

create extension if not exists postgis with schema extensions;

-- ---------------------------------------------------------------------------
-- store_branch
-- ---------------------------------------------------------------------------

create table public.store_branch (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.store(id),
  -- The branch's id in its source, so a reload updates instead of duplicating.
  external_id   text not null,
  name          text not null check (length(trim(name)) > 0),
  address       text,
  city          text,
  region_code   text references public.region(code),
  location      extensions.geography(Point, 4326) not null,
  -- Where the row came from. A branch from OpenStreetMap is community data,
  -- not the chain's word: the app may want to say so one day.
  source        text not null check (source in ('official', 'osm', 'manual')),
  is_active     boolean not null default true,
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),

  constraint store_branch_external_uk unique (store_id, external_id),

  -- A coordinate outside Colombia is a source error, not a branch: rejected
  -- at the door, the same way an absurd price is (rules/ingestion.md).
  constraint store_branch_in_colombia check (
    extensions.st_y(location::extensions.geometry) between -4.3 and 13.6
    and extensions.st_x(location::extensions.geometry) between -82.0 and -66.8
  )
);

comment on table public.store_branch is
  'Physical shops of each chain. Public catalogue: read by anyone, written only by '
  'the branch pipeline (service_role). Never deleted: a closed shop is is_active = false.';

-- KNN ("nearest first") and radius filters both use this index.
create index store_branch_location_idx
  on public.store_branch using gist (location)
  where is_active;

create index store_branch_store_idx on public.store_branch (store_id);

-- ---------------------------------------------------------------------------
-- RLS — read-only catalogue
-- ---------------------------------------------------------------------------

alter table public.store_branch enable row level security;

revoke all on public.store_branch from anon, authenticated;
grant select on public.store_branch to anon, authenticated;

create policy "sucursales: legibles por todos"
  on public.store_branch for select to anon, authenticated
  using (true);

-- No insert / update / delete policy, on purpose: only service_role writes.

-- ---------------------------------------------------------------------------
-- nearest_branches — the N closest shops, within a ceiling
-- ---------------------------------------------------------------------------
-- "The 30 nearest, but never further than 25 km" adapts on its own: in Bogotá
-- the 30 nearest sit within a couple of kilometres, in a small town the
-- nearest may be 15 km away. No fixed radius to tune per city.
--
-- Bounded on both axes, because the caller is the public internet: the limit
-- and the radius are clamped here, not trusted from the client. Thousands of
-- markers would freeze the map (plan 0001, "Rendimiento").

create or replace function public.nearest_branches(
  p_lat          double precision,
  p_lng          double precision,
  p_max_radius_m integer default 25000,
  p_limit        integer default 30
)
returns table (
  id          uuid,
  store_slug  text,
  store_name  text,
  has_prices  boolean,
  name        text,
  address     text,
  city        text,
  lat         double precision,
  lng         double precision,
  distance_m  integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select
    b.id,
    s.slug,
    s.name,
    s.is_active,
    b.name,
    b.address,
    b.city,
    extensions.st_y(b.location::extensions.geometry),
    extensions.st_x(b.location::extensions.geometry),
    round(extensions.st_distance(b.location, o.g))::integer
  from public.store_branch b
  join public.store s on s.id = b.store_id
  cross join origin o
  where b.is_active
    and extensions.st_dwithin(b.location, o.g, least(greatest(p_max_radius_m, 0), 50000))
  order by b.location operator(extensions.<->) o.g
  limit least(greatest(p_limit, 1), 100)
$$;

comment on function public.nearest_branches(double precision, double precision, integer, integer) is
  'Nearest active branches to a point, closest first. Radius capped at 50 km and limit at '
  '100 regardless of what the caller asks. has_prices = the chain has a catalogue today.';

revoke all on function public.nearest_branches(double precision, double precision, integer, integer) from public;
grant execute on function public.nearest_branches(double precision, double precision, integer, integer) to anon, authenticated;
