-- Denied-access tests for every RLS policy.
-- A policy nobody tried to break is not a verified policy (.claude/rules/supabase.md).
--
-- Run with:  pnpm run db:test      (supabase test db)

begin;

select plan(18);

-- ---------------------------------------------------------------------------
-- Fixtures: two users, one list each, one product with a price
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, instance_id, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'beto@test.local',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

-- profile rows are created by the on_auth_user_created trigger.

insert into public.store_product (id, store_id, external_id, name, brand, unit_kind, unit_value, unit_measure)
select
  '33333333-3333-3333-3333-333333333333',
  s.id, 'TEST-SKU-1', 'Arroz blanco', 'Marca Test', 'weight', 500, 'g'
from public.store s where s.slug = 'exito';

insert into public.price_snapshot (store_product_id, region_code, price_cop)
values ('33333333-3333-3333-3333-333333333333', 'NACIONAL', 4200);

refresh materialized view public.current_price;

insert into public.shopping_list (id, owner_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Mercado de Ana'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Mercado de Beto');

insert into public.list_item (list_id, store_product_id, quantity, price_cop_at_add)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 1, 0);

-- ---------------------------------------------------------------------------
-- Act as Ana
-- ---------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- --- Lists -----------------------------------------------------------------

select is(
  (select count(*) from public.shopping_list)::int, 1,
  'Ana solo ve su propia lista'
);

select is(
  (select count(*) from public.shopping_list
   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int, 0,
  'Ana NO ve la lista de Beto'
);

select throws_ok(
  $$ insert into public.shopping_list (owner_id, name)
     values ('22222222-2222-2222-2222-222222222222', 'Lista falsificada') $$,
  '42501',
  null,
  'Ana NO puede crear una lista a nombre de Beto (WITH CHECK)'
);

-- Un UPDATE bloqueado por RLS no lanza error: afecta 0 filas en silencio.
-- El DML debe ir en un CTE; Postgres no lo admite en una subconsulta.
with attempted as (
  update public.shopping_list set name = 'Secuestrada'
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  returning 1
)
select is(
  (select count(*)::int from attempted), 0,
  'Ana NO puede editar la lista de Beto'
);

with attempted as (
  delete from public.shopping_list
  where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  returning 1
)
select is(
  (select count(*)::int from attempted), 0,
  'Ana NO puede borrar la lista de Beto'
);

-- --- List items ------------------------------------------------------------

select is(
  (select count(*) from public.list_item)::int, 0,
  'Ana NO ve los ítems de la lista de Beto'
);

select throws_ok(
  $$ insert into public.list_item (list_id, store_product_id, quantity)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
             '33333333-3333-3333-3333-333333333333', 1) $$,
  '42501',
  null,
  'Ana NO puede añadir ítems a la lista de Beto'
);

select lives_ok(
  $$ insert into public.list_item (list_id, store_product_id, quantity)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
             '33333333-3333-3333-3333-333333333333', 2) $$,
  'Ana SÍ puede añadir ítems a su propia lista'
);

-- --- price_cop_at_add is server-side ---------------------------------------

select is(
  (select price_cop_at_add from public.list_item
   where list_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  4200,
  'El trigger fija price_cop_at_add desde current_price'
);

with attempted as (
  insert into public.list_item (list_id, store_product_id, quantity, price_cop_at_add)
  values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          '33333333-3333-3333-3333-333333333333', 1, 999999)
  on conflict (list_id, store_product_id) do nothing
  returning 1
)
select is(
  (select count(*)::int from attempted), 0,
  'Un producto no se duplica dentro de la misma lista'
);

update public.list_item set quantity = 5
where list_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

select is(
  (select price_cop_at_add from public.list_item
   where list_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  4200,
  'Actualizar la cantidad NO recongela el precio'
);

-- --- Totals respect RLS (security_invoker) ---------------------------------

select is(
  (select count(*) from public.list_totals
   where list_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')::int, 0,
  'list_totals NO filtra la lista de Beto (security_invoker activo)'
);

select is(
  (select subtotal_cop from public.list_totals
   where list_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  21000,
  'El subtotal por tienda se calcula en servidor (4200 x 5)'
);

-- --- Catalogue is read only ------------------------------------------------

select ok(
  (select count(*) from public.store_product) > 0,
  'El catálogo es legible por un usuario autenticado'
);

select throws_ok(
  $$ update public.store_product set name = 'Producto envenenado'
     where external_id = 'TEST-SKU-1' $$,
  '42501',
  null,
  'Un cliente NO puede modificar el catálogo'
);

select throws_ok(
  $$ insert into public.price_snapshot (store_product_id, region_code, price_cop)
     values ('33333333-3333-3333-3333-333333333333', 'NACIONAL', 1) $$,
  '42501',
  null,
  'Un cliente NO puede inventar precios'
);

select throws_ok(
  $$ delete from public.store_product where external_id = 'TEST-SKU-1' $$,
  '42501',
  null,
  'Un cliente NO puede borrar productos del catálogo'
);

-- --- Profiles --------------------------------------------------------------

select is(
  (select count(*) from public.profile
   where id = '22222222-2222-2222-2222-222222222222')::int, 0,
  'Ana NO ve el perfil de Beto'
);

select * from finish();

rollback;
