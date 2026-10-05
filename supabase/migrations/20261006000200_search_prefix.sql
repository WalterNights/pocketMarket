-- Search-as-you-type: match by word PREFIX, not by Spanish stem.
--
-- `search_vector` is built with the `spanish` configuration, which stores
-- stems. Prefix-matching against stems is noise: "pera" is stemmed to "per",
-- and "per:*" also finds "perros" — the first page for "pera" was dog toys.
--
-- This column keeps the words as written (config `simple`: lowercased, no
-- stemming, no stopword removal), unaccented like the other one. A query term
-- "gom:*" then finds "gomitas" and "pera:*" finds "pera" and "peras", nothing
-- else. `search_vector` stays for whole-word, stemmed search.

alter table public.store_product
  add column search_prefix tsvector generated always as (
    to_tsvector(
      'simple',
      public.immutable_unaccent(coalesce(name, '') || ' ' || coalesce(brand, ''))
    )
  ) stored;

create index store_product_search_prefix_idx
  on public.store_product using gin (search_prefix);

-- Same view, one more column at the end. security_invoker is restated on
-- purpose: without it the view would run as its owner (rule 21).
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
  public.price_for(sp.id, public.current_region()) as price_cop,
  sp.search_prefix
from public.store_product sp
join public.store st on st.id = sp.store_id
left join public.category cat on cat.id = sp.category_id;
