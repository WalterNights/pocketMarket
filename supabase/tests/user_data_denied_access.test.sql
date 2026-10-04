-- Denied-access tests the first RLS suite did not cover: reminders, editing
-- someone else's profile, moving an item into someone else's list, and a
-- signed-in client writing branches.
--
-- UPDATE/DELETE blocked by RLS fail silently (0 rows), so those are counted
-- through a data-modifying CTE; INSERT/UPDATE failing WITH CHECK raise 42501.
--
-- Run with:  pnpm run db:test

begin;

select plan(14);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): Ana and Beto, a list and a reminder each
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, instance_id, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.local',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'beto@test.local',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into public.store_product (id, store_id, external_id, name, unit_kind)
select v.id::uuid, s.id, v.sku, v.name, 'unit'
from public.store s,
     (values ('33333333-3333-3333-3333-333333333333', 'TEST-ARROZ', 'Arroz'),
             ('44444444-4444-4444-4444-444444444444', 'TEST-HUEVOS', 'Huevos')) as v(id, sku, name)
where s.slug = 'exito';

insert into public.price_snapshot (store_product_id, region_code, price_cop) values
  ('33333333-3333-3333-3333-333333333333', 'NACIONAL', 4200),
  ('44444444-4444-4444-4444-444444444444', 'NACIONAL', 15000);

refresh materialized view public.current_price;

insert into public.shopping_list (id, owner_id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Mercado de Ana'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Mercado de Beto');

-- Ana's item uses a product Beto's list does not hold, so moving it fails on
-- RLS and not on the one-product-per-list constraint.
insert into public.list_item (id, list_id, store_product_id, quantity, price_cop_at_add) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '44444444-4444-4444-4444-444444444444', 1, 0),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '33333333-3333-3333-3333-333333333333', 1, 0);

insert into public.list_reminder (id, list_id, owner_id, frequency, weekday, time_local) values
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
   '11111111-1111-1111-1111-111111111111', 'weekly', 6, '08:00'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
   '22222222-2222-2222-2222-222222222222', 'weekly', 7, '09:00');

-- ---------------------------------------------------------------------------
-- Act as Ana
-- ---------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- --- list_reminder -----------------------------------------------------------

select is(
  (select count(*)::int from public.list_reminder
    where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  0,
  'Ana NO ve el recordatorio de Beto'
);

with attempted as (
  update public.list_reminder set time_local = '03:00'
   where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  returning 1
)
select is((select count(*)::int from attempted), 0, 'Ana NO puede editar el recordatorio de Beto');

with attempted as (
  delete from public.list_reminder
   where id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
  returning 1
)
select is((select count(*)::int from attempted), 0, 'Ana NO puede borrar el recordatorio de Beto');

select throws_ok(
  $$ insert into public.list_reminder (list_id, owner_id, frequency, day_of_month, time_local)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222',
             'monthly', 1, '08:00') $$,
  '42501', null,
  'Ana NO puede crear un recordatorio a nombre de Beto'
);

select throws_ok(
  $$ insert into public.list_reminder (list_id, owner_id, frequency, day_of_month, time_local)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111',
             'monthly', 1, '08:00') $$,
  '42501', null,
  'Ana NO puede colgar un recordatorio de la lista de Beto'
);

select throws_ok(
  $$ update public.list_reminder set list_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' $$,
  '42501', null,
  'Ana NO puede mover su recordatorio a la lista de Beto (WITH CHECK)'
);

select is(
  (select count(*)::int from public.list_reminder),
  1,
  'Ana sigue viendo solo su propio recordatorio'
);

-- --- profile -------------------------------------------------------------------

with attempted as (
  update public.profile set region_code = 'NACIONAL'
   where id = '22222222-2222-2222-2222-222222222222'
  returning 1
)
select is((select count(*)::int from attempted), 0, 'Ana NO puede editar el perfil de Beto');

select throws_ok(
  $$ update public.profile set id = '22222222-2222-2222-2222-222222222222'
      where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501', null,
  'Ana NO puede apropiarse del id de perfil de Beto (WITH CHECK)'
);

-- --- list_item -----------------------------------------------------------------

select throws_ok(
  $$ update public.list_item set list_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
      where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' $$,
  '42501', null,
  'Ana NO puede mover un ítem suyo a la lista de Beto (WITH CHECK)'
);

with attempted as (
  update public.list_item set quantity = 99
   where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
  returning 1
)
select is((select count(*)::int from attempted), 0, 'Ana NO puede editar los ítems de Beto');

-- --- store_branch: catalogue, read-only for signed-in users too ---------------

select throws_ok(
  $$ insert into public.store_branch (store_id, external_id, name, location, source)
     select id, 'T-HACK', 'Falsa',
            extensions.st_setsrid(extensions.st_makepoint(-74.05, 4.67), 4326)::extensions.geography,
            'manual'
     from public.store where slug = 'exito' $$,
  '42501', null,
  'authenticated NO puede crear sucursales'
);

select throws_ok(
  $$ update public.store_branch set name = 'Secuestrada' $$,
  '42501', null,
  'authenticated NO puede editar sucursales'
);

select throws_ok(
  $$ delete from public.store_branch $$,
  '42501', null,
  'authenticated NO puede borrar sucursales'
);

select * from finish();

rollback;
