-- Read model for the catalogue.
--
-- PostgREST cannot infer a relationship to current_price: it is a materialized
-- view and has no foreign key. Rather than making the client stitch product and
-- price together (an N+1 over the radio), the join happens here.
--
-- security_invoker = true so RLS on store_product still applies. Mandatory for
-- any view the app reads (rule 21 in CLAUDE.md).

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
  -- Region resolution lives in one place: the caller's profile, falling back to
  -- NACIONAL. Evaluated per returned row, so keep queries paginated.
  public.price_for(
    sp.id,
    coalesce((select p.region_code from public.profile p where p.id = auth.uid()), 'NACIONAL')
  ) as price_cop
from public.store_product sp
join public.store st on st.id = sp.store_id
left join public.category cat on cat.id = sp.category_id;

comment on view public.catalog_product is
  'Product + current price for the caller''s region. Always query with a LIMIT: '
  'price_for() runs per returned row.';

grant select on public.catalog_product to authenticated;
