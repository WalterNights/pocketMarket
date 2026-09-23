-- Categories available within a store, with how many products each holds.
--
-- Browsing a flat catalogue mixes dairy with grains; picking a category first
-- is how people actually shop. Counting per category client-side would be one
-- query per category, so the aggregate lives here.
--
-- Only categories that actually have products show up: an empty category is a
-- dead end.

create or replace view public.store_category_summary
with (security_invoker = true) as
select
  st.slug                                             as store_slug,
  c.id                                                as category_id,
  c.slug                                              as category_slug,
  c.name                                              as category_name,
  c.sort_order,
  count(sp.id)::integer                               as product_count
from public.store st
join public.store_product sp on sp.store_id = st.id and sp.is_available
join public.category c       on c.id = sp.category_id
group by st.slug, c.id, c.slug, c.name, c.sort_order;

comment on view public.store_category_summary is
  'Categories with products, per store. Empty categories are excluded on purpose.';

grant select on public.store_category_summary to anon, authenticated;
