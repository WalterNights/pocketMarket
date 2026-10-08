-- A product without a price never reaches the app (2026-10-08).
--
-- Until now each repository query added `price_cop is not null` on its own,
-- and the one that did not — the product sheet — showed an error for a
-- product that simply had no price today. A budget calculator has nothing to
-- say about a product without a price, so the catalogue view stops returning
-- them at all: one rule, in one place, for every reader.
--
-- The price is resolved once per row in a LATERAL, not once in SELECT and
-- again in WHERE. Same columns, same order: `create or replace` requires it.

create or replace view public.catalog_product
with (security_invoker = true) as
select
  sp.id,
  sp.store_id,
  st.slug as store_slug,
  st.name as store_name,
  sp.category_id,
  cat.slug as category_slug,
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
  price.price_cop,
  sp.search_prefix
from public.store_product sp
join public.store st on st.id = sp.store_id
left join public.category cat on cat.id = sp.category_id
cross join lateral (
  select public.price_for(sp.id, public.current_region()) as price_cop
) price
where price.price_cop is not null;

comment on view public.catalog_product is
  'What the app may show: products WITH a price for the caller''s region (or the '
  'national one). A product without a price today is not returned at all.';

-- How many of a store's products have no published price. The daily run
-- reads it before and after, so a product left without a price (a failed
-- write, ING-014) is visible in the report and is retried by the next run.
-- Only the ingestion (service_role) needs it.
create or replace function public.unpriced_product_count(p_store_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.store_product sp
  where sp.store_id = p_store_id
    and not exists (
      select 1 from public.current_price cp where cp.store_product_id = sp.id
    )
$$;

revoke all on function public.unpriced_product_count(uuid) from public, anon, authenticated;
grant execute on function public.unpriced_product_count(uuid) to service_role;
