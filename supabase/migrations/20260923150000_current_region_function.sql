-- Fix: catalog_product could not be read without a session.
--
-- The view is security_invoker, which propagates the caller's permissions to
-- EVERY table it touches — including the subquery against `profile`. A visitor
-- with no account cannot read `profile`, so the whole view failed with
-- "permission denied for table profile", even though the catalogue itself is
-- public.
--
-- Opening `profile` to anon would leak user data. Instead the region lookup is
-- wrapped in a security definer function: it takes no arguments and only ever
-- reads the row for the current auth.uid(), so there is no way to ask for
-- somebody else's region.

create or replace function public.current_region()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.region_code from public.profile p where p.id = auth.uid()),
    'NACIONAL'
  )
$$;

comment on function public.current_region() is
  'Region of the calling user, NACIONAL when there is no session. security definer '
  'so it works from a security_invoker view without exposing the profile table.';

grant execute on function public.current_region() to anon, authenticated;

create or replace view public.catalog_product
with (security_invoker = true) as
select
  sp.id,
  sp.store_id,
  st.slug                as store_slug,
  st.name                as store_name,
  sp.category_id,
  cat.slug               as category_slug,
  sp.name,
  sp.brand,
  sp.ean,
  sp.unit_kind,
  sp.unit_value,
  sp.unit_measure,
  sp.image_url,
  sp.is_available,
  sp.last_seen_at,
  sp.search_vector,
  public.price_for(sp.id, public.current_region()) as price_cop
from public.store_product sp
join public.store st on st.id = sp.store_id
left join public.category cat on cat.id = sp.category_id;

grant select on public.catalog_product to anon, authenticated;
