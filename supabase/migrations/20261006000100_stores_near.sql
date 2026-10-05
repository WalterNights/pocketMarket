-- stores_near: the chains with a shop near a point, for the home store list
-- (plan 0003, "Decisiones de diseño").
--
-- Why not reuse nearest_branches: it stops at the 30 nearest SHOPS. In Bogotá
-- those 30 can all be D1 and hide the Éxito two blocks further. Grouping by
-- chain has to happen before any limit, so it happens here.
--
-- One row per chain with at least one active branch within the radius, with
-- the same columns as store_summary plus the distance to its nearest branch.
-- Chains with prices come first (they are the ones the user can open), then
-- the rest by distance.
--
-- Public catalogue only: store_summary (security_invoker), store and
-- store_branch are readable by anon. security invoker keeps it that way — the
-- function can never see more than its caller.

create or replace function public.stores_near(
  p_lat      double precision,
  p_lng      double precision,
  p_radius_m integer default 25000
)
returns table (
  id              uuid,
  slug            text,
  name            text,
  logo_path       text,
  source_type     text,
  is_active       boolean,
  product_count   integer,
  last_updated_at timestamptz,
  nearest_m       integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  ),
  nearby as (
    -- ST_DWithin on geography uses the GIST index on store_branch.location.
    -- The radius is clamped here, not trusted from the client: the caller is
    -- the public internet (same ceiling as nearest_branches).
    select b.store_id, min(extensions.st_distance(b.location, o.g)) as distance_m
    from public.store_branch b
    cross join origin o
    where b.is_active
      and extensions.st_dwithin(b.location, o.g, least(greatest(p_radius_m, 0), 50000))
    group by b.store_id
  )
  select
    s.id,
    s.slug,
    s.name,
    s.logo_path,
    s.source_type,
    s.is_active,
    s.product_count,
    s.last_updated_at,
    round(n.distance_m)::integer
  from nearby n
  join public.store_summary s on s.id = n.store_id
  order by
    (s.is_active and coalesce(s.product_count, 0) > 0) desc,
    n.distance_m,
    s.name
$$;

comment on function public.stores_near(double precision, double precision, integer) is
  'Chains with an active branch within p_radius_m (capped at 50 km) of a point: the '
  'store_summary columns plus nearest_m. Chains with prices first, then by distance.';

revoke all on function public.stores_near(double precision, double precision, integer) from public;
grant execute on function public.stores_near(double precision, double precision, integer) to anon, authenticated;
