-- Store list: what the user picks before browsing products.
--
-- Counting products per store client-side would mean one query per store, so
-- the aggregate happens here. security_invoker keeps RLS in play, and every
-- table it touches is public catalogue — no profile lookup, so it works
-- without a session (see current_region() for why that matters).

create or replace view public.store_summary
with (security_invoker = true) as
select
  st.id,
  st.slug,
  st.name,
  st.logo_path,
  st.source_type,
  st.is_active,
  count(sp.id) filter (where sp.is_available)::integer as product_count,
  max(sp.last_seen_at) filter (where sp.is_available)  as last_updated_at
from public.store st
left join public.store_product sp on sp.store_id = st.id
group by st.id, st.slug, st.name, st.logo_path, st.source_type, st.is_active;

comment on view public.store_summary is
  'Stores with how many products they have and how fresh the data is. '
  'product_count is 0 for stores whose adapter is not built yet.';

grant select on public.store_summary to anon, authenticated;
