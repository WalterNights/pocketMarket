-- Make every product count mean "products you will actually see".
--
-- The app showed "Arroz 111" and then an empty list. Two sources of truth had
-- drifted apart: the summaries counted rows in `store_product`, while the
-- product list reads `catalog_product`, which only returns a product once
-- `current_price` has a price for it (a budget calculator has nothing to say
-- about a product with no price, so the repository filters those out).
--
-- Any gap between "written to the catalogue" and "priced" therefore showed up
-- as a full category with nothing in it. The fix is to count the same thing the
-- list shows, so the number cannot lie.
--
-- A category with no priced product now disappears from the listing instead of
-- being an empty aisle the user can walk into.

create or replace view public.store_category_summary
with (security_invoker = true) as
select
  st.slug as store_slug,
  c.id as category_id,
  c.slug as category_slug,
  c.name as category_name,
  c.sort_order,
  count(distinct sp.id)::integer as product_count
from public.store st
join public.store_product sp
  on sp.store_id = st.id
 and sp.is_available
join public.category c
  on c.id = sp.category_id
-- Same price resolution as `catalog_product`: the caller's region, falling back
-- to the national price.
join public.current_price cp
  on cp.store_product_id = sp.id
 and cp.region_code in (public.current_region(), 'NACIONAL')
group by st.slug, c.id, c.slug, c.name, c.sort_order;

comment on view public.store_category_summary is
  'Aisles of one store with how many priced products each holds. Counts only '
  'what the product list will show: an unpriced product is invisible to the '
  'app, so counting it would promise something the next screen cannot keep.';

create or replace view public.store_summary
with (security_invoker = true) as
select
  st.id,
  st.slug,
  st.name,
  st.logo_path,
  st.source_type,
  st.is_active,
  -- The FILTER is what makes the LEFT JOIN safe: without it every product
  -- would be counted again, priced or not, which is the bug being fixed.
  count(distinct sp.id) filter (where cp.store_product_id is not null)::integer
    as product_count,
  max(sp.last_seen_at) filter (where cp.store_product_id is not null)
    as last_updated_at
from public.store st
-- LEFT JOIN on purpose: a store with no priced products still belongs in the
-- store list, showing zero. Dropping it would hide a store that exists.
left join public.store_product sp
  on sp.store_id = st.id
 and sp.is_available
left join public.current_price cp
  on cp.store_product_id = sp.id
 and cp.region_code in (public.current_region(), 'NACIONAL')
group by st.id, st.slug, st.name, st.logo_path, st.source_type, st.is_active;

comment on view public.store_summary is
  'One row per store with how many priced products it has and how fresh they '
  'are. Same counting rule as store_category_summary.';
