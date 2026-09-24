-- Saving and editing a list, and the summary "Mis listas" reads.
--
-- One function does both create and edit, so the client never assembles a list
-- out of three separate requests: a failure halfway would leave a list with
-- half its products. Everything here runs as the CALLER (security invoker), so
-- the RLS policies on shopping_list and list_item still decide what is allowed.

-- ---------------------------------------------------------------------------
-- The payload, parsed once
-- ---------------------------------------------------------------------------
-- [{ "store_product_id": uuid, "quantity": number }, ...] in display order.
-- A product sent twice keeps its LAST quantity: the list holds each product
-- once (list_item_unique_product), and the last word is what the user saw.

create or replace function public.parse_list_items(p_items jsonb)
returns table (store_product_id uuid, quantity numeric, "position" integer)
language sql
immutable
set search_path = ''
as $$
  select distinct on (e.store_product_id)
    e.store_product_id,
    e.quantity,
    (e.ord - 1)::integer
  from (
    select
      (item ->> 'store_product_id')::uuid as store_product_id,
      (item ->> 'quantity')::numeric      as quantity,
      ord
    from jsonb_array_elements(p_items) with ordinality as t(item, ord)
  ) e
  order by e.store_product_id, e.ord desc
$$;

-- ---------------------------------------------------------------------------
-- save_list — create (p_list_id null) or replace name and products (edit)
-- ---------------------------------------------------------------------------

create or replace function public.save_list(
  p_name    text,
  p_items   jsonb,
  p_list_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner   uuid := auth.uid();
  v_list_id uuid;
begin
  if v_owner is null then
    raise exception 'Hace falta iniciar sesión para guardar una lista'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Una lista guardada necesita al menos un producto'
      using errcode = '22023';
  end if;

  if p_list_id is null then
    insert into shopping_list (owner_id, name)
    values (v_owner, trim(p_name))
    returning id into v_list_id;
  else
    -- RLS hides other people's lists, so "not mine" and "does not exist" look
    -- the same from here. Both are 'not found': telling them apart would
    -- confirm that someone else's list id is real.
    update shopping_list
       set name = trim(p_name)
     where id = p_list_id
       and not is_archived
    returning id into v_list_id;

    if v_list_id is null then
      raise exception 'Lista no encontrada' using errcode = 'P0002';
    end if;
  end if;

  delete from list_item li
   where li.list_id = v_list_id
     and li.store_product_id not in (select i.store_product_id from parse_list_items(p_items) i);

  -- Existing products: quantity and order only. price_cop_at_add is left alone
  -- (keep_list_item_price enforces it too): it is what "went up $400 since you
  -- added it" is measured against.
  update list_item li
     set quantity   = i.quantity,
         "position" = i."position"
    from parse_list_items(p_items) i
   where li.list_id = v_list_id
     and li.store_product_id = i.store_product_id;

  -- New products only. NOT an upsert: the price trigger fires BEFORE INSERT
  -- even when ON CONFLICT turns the row into an update, and it raises for a
  -- product that lost its price — which would make any list holding one
  -- impossible to edit.
  insert into list_item (list_id, store_product_id, quantity, "position")
  select v_list_id, i.store_product_id, i.quantity, i."position"
    from parse_list_items(p_items) i
   where not exists (
     select 1 from list_item li
      where li.list_id = v_list_id
        and li.store_product_id = i.store_product_id
   );

  return v_list_id;
end;
$$;

comment on function public.save_list(text, jsonb, uuid) is
  'Creates a list, or replaces the name and products of one the caller owns. '
  'Kept products keep their price_cop_at_add. Runs as the caller: RLS applies.';

revoke all on function public.parse_list_items(jsonb)       from public, anon;
revoke all on function public.save_list(text, jsonb, uuid)  from public, anon;
grant execute on function public.parse_list_items(jsonb)      to authenticated;
grant execute on function public.save_list(text, jsonb, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- list_summary — one row per list for "Mis listas"
-- ---------------------------------------------------------------------------
-- Totals come from list_totals, computed from current prices (rule 17). They
-- are never stored: a stored total is stale the moment a price moves.
-- security_invoker is mandatory (rule 21): without it the view runs as its
-- owner and shows every user's lists.

create view public.list_summary
with (security_invoker = true) as
select
  l.id,
  l.name,
  l.updated_at,
  coalesce(sum(t.item_count), 0)::integer          as item_count,
  count(t.store_id)::integer                       as store_count,
  coalesce(sum(t.subtotal_cop), 0)::integer        as total_cop,
  coalesce(sum(t.subtotal_at_add_cop), 0)::integer as total_at_add_cop
from public.shopping_list l
left join public.list_totals t on t.list_id = l.id
where not l.is_archived
group by l.id, l.name, l.updated_at;

comment on view public.list_summary is
  'Saved lists with their current total and the total when their products were '
  'added. Computed on read, never stored.';

revoke all on public.list_summary from anon, authenticated;
grant select on public.list_summary to authenticated;

-- ---------------------------------------------------------------------------
-- One reminder per list
-- ---------------------------------------------------------------------------
-- The app offers a single "remind me" per list, and the client upserts it on
-- list_id. Without the constraint a retried request would leave two reminders
-- and the phone would ring twice.

alter table public.list_reminder
  add constraint list_reminder_one_per_list unique (list_id);
