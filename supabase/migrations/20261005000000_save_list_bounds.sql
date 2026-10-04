-- save_list: bound what the client can send.
--
-- save_list is callable by any signed-in user with any payload, and the app's
-- own limits (60-character names, quantities up to 99) are just UI. Without
-- server bounds:
--   * 'NaN' passes `quantity > 0` (NaN sorts above every number in Postgres),
--     lands in list_item, and then poisons list_totals: round(price * NaN)
--     cannot be cast to integer, so the whole list stops loading;
--   * a 100k-item payload is one transaction holding locks for as long as it
--     takes;
--   * a megabyte-long name is stored and shipped to every device.
--
-- Same signature, same `security invoker`, same search_path: only the guards
-- are new. CREATE OR REPLACE keeps the existing grants and comment.
--
-- Each limit has its own SQLSTATE, so the client never mistakes one for
-- "add at least one product" (22023):
--   54000 program_limit_exceeded       -> too many items
--   22001 string_data_right_truncation -> name too long
--   22003 numeric_value_out_of_range   -> quantity missing, NaN or out of range

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
  -- Generous over the app's own limits: these stop abuse, not users.
  c_max_items      constant integer := 500;
  c_max_name       constant integer := 100;
  c_min_quantity   constant numeric := 0.001;
  c_max_quantity   constant numeric := 999;

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

  if jsonb_array_length(p_items) > c_max_items then
    raise exception 'Una lista admite como máximo % productos', c_max_items
      using errcode = '54000';
  end if;

  if length(trim(p_name)) > c_max_name then
    raise exception 'El nombre admite como máximo % caracteres', c_max_name
      using errcode = '22001';
  end if;

  -- 'NaN' is checked by name: it compares greater than every number, so a
  -- range test alone reads it as "too big" only by accident.
  if exists (
    select 1
      from parse_list_items(p_items) i
     where i.quantity is null
        or i.quantity = 'NaN'::numeric
        or i.quantity < c_min_quantity
        or i.quantity > c_max_quantity
  ) then
    raise exception 'Cantidad inválida: debe estar entre % y %', c_min_quantity, c_max_quantity
      using errcode = '22003';
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
