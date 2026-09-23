-- Derived reads: current price, price resolution and list totals.

-- ---------------------------------------------------------------------------
-- current_price — latest snapshot per (product, region)
-- ---------------------------------------------------------------------------
-- The app ALWAYS reads this. Never "ORDER BY captured_at DESC LIMIT 1" per
-- product: that is an N+1 in disguise (rules/known-issues.md).

create materialized view public.current_price as
select distinct on (store_product_id, region_code)
  store_product_id,
  region_code,
  price_cop,
  list_price_cop,
  captured_at
from public.price_snapshot
order by store_product_id, region_code, captured_at desc;

-- REFRESH ... CONCURRENTLY requires a unique index.
create unique index current_price_pk_idx
  on public.current_price (store_product_id, region_code);

comment on materialized view public.current_price is
  'Refreshed at the end of every ingestion run. Materialized views do not honour '
  'RLS, which is fine: the catalogue is readable by all authenticated users.';

-- Called by the ingestion pipeline after writing snapshots.
create or replace function public.refresh_current_price()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.current_price;
end;
$$;

revoke execute on function public.refresh_current_price() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- price_for — region resolution in ONE place
-- ---------------------------------------------------------------------------
-- Falls back to NACIONAL when the store has no price for the user's region.
-- Keeping this rule in a function stops it being re-implemented per query.

create or replace function public.price_for(
  p_store_product_id uuid,
  p_region_code      text
)
returns integer
language sql
stable
parallel safe
as $$
  select cp.price_cop
  from public.current_price cp
  where cp.store_product_id = p_store_product_id
    and cp.region_code in (p_region_code, 'NACIONAL')
  order by (cp.region_code = p_region_code) desc
  limit 1
$$;

-- ---------------------------------------------------------------------------
-- list_item.price_cop_at_add — set by the server, never by the client
-- ---------------------------------------------------------------------------

create or replace function public.set_list_item_price()
returns trigger
language plpgsql
as $$
declare
  v_region text;
  v_price  integer;
begin
  select p.region_code
    into v_region
  from public.shopping_list l
  join public.profile p on p.id = l.owner_id
  where l.id = new.list_id;

  v_region := coalesce(v_region, 'NACIONAL');
  v_price  := public.price_for(new.store_product_id, v_region);

  if v_price is null then
    raise exception 'Sin precio conocido para el producto % en la región %',
      new.store_product_id, v_region
      using errcode = 'P0001',
            hint = 'El producto no tiene snapshot de precio todavía.';
  end if;

  -- Whatever the client sent is discarded on purpose.
  new.price_cop_at_add := v_price;
  return new;
end;
$$;

create trigger list_item_set_price
  before insert on public.list_item
  for each row execute function public.set_list_item_price();

-- Updating an item (quantity, note, checked) must not re-freeze the price.
create or replace function public.keep_list_item_price()
returns trigger
language plpgsql
as $$
begin
  new.price_cop_at_add := old.price_cop_at_add;
  return new;
end;
$$;

create trigger list_item_keep_price
  before update on public.list_item
  for each row execute function public.keep_list_item_price();

-- ---------------------------------------------------------------------------
-- list_totals — totals are COMPUTED, never stored
-- ---------------------------------------------------------------------------
-- A stored total goes stale the moment a price changes, which is the opposite
-- of this app's purpose.
--
-- security_invoker = true is MANDATORY: without it the view runs as its owner
-- and silently bypasses RLS on list_item, exposing every user's lists.

create view public.list_totals
with (security_invoker = true) as
select
  li.list_id,
  sp.store_id,
  st.slug                                   as store_slug,
  st.name                                   as store_name,
  count(*)::integer                         as item_count,
  sum(
    round(
      coalesce(
        public.price_for(li.store_product_id, coalesce(pr.region_code, 'NACIONAL')),
        li.price_cop_at_add          -- product lost its price: fall back to the frozen one
      ) * li.quantity
    )
  )::integer                                as subtotal_cop,
  sum(round(li.price_cop_at_add * li.quantity))::integer as subtotal_at_add_cop
from public.list_item li
join public.shopping_list l  on l.id  = li.list_id
join public.profile pr       on pr.id = l.owner_id
join public.store_product sp on sp.id = li.store_product_id
join public.store st         on st.id = sp.store_id
group by li.list_id, sp.store_id, st.slug, st.name;

comment on view public.list_totals is
  'Per-store subtotal for a list. The overall total is the sum of these rows. '
  'subtotal_at_add_cop enables showing how much the list drifted since it was built.';
