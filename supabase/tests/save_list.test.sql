-- save_list and list_summary: happy path, price freezing, and denied access.
--
-- Run with:  pnpm run db:test

begin;

select plan(17);

-- ---------------------------------------------------------------------------
-- Fixtures: two users, two priced products, one list belonging to Beto
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
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Mercado de Beto');

insert into public.list_item (list_id, store_product_id, quantity, price_cop_at_add)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 1, 0);

-- Holds the id of the list Ana creates, across role switches.
create temp table saved (id uuid);
grant all on saved to authenticated;

-- ---------------------------------------------------------------------------
-- Anonymous: no saving without an account
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok(
  $$ select public.save_list('x', '[{"store_product_id":"33333333-3333-3333-3333-333333333333","quantity":1}]') $$,
  '42501',
  null,
  'anon NO puede ejecutar save_list'
);

select throws_ok(
  $$ select * from public.list_summary $$,
  '42501',
  null,
  'anon NO puede leer list_summary'
);

-- ---------------------------------------------------------------------------
-- Ana creates a list
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

insert into saved
select public.save_list(
  '  Mercado quincenal  ',
  '[{"store_product_id":"33333333-3333-3333-3333-333333333333","quantity":2}]'
);

select is(
  (select name from public.shopping_list where id = (select id from saved)),
  'Mercado quincenal',
  'save_list crea la lista a nombre de quien llama, con el nombre recortado'
);

select is(
  (select owner_id from public.shopping_list where id = (select id from saved)),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'el dueño sale de auth.uid(), no del cliente'
);

select is(
  (select price_cop_at_add from public.list_item where list_id = (select id from saved)),
  4200,
  'el precio de referencia lo pone el servidor'
);

select throws_ok(
  $$ select public.save_list('Vacía', '[]') $$,
  '22023',
  null,
  'una lista guardada necesita al menos un producto'
);

-- ---------------------------------------------------------------------------
-- The price moves; Ana edits the list
-- ---------------------------------------------------------------------------

reset role;
insert into public.price_snapshot (store_product_id, region_code, price_cop)
values ('33333333-3333-3333-3333-333333333333', 'NACIONAL', 5000);
refresh materialized view public.current_price;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select public.save_list(
       'Mercado del mes',
       '[{"store_product_id":"33333333-3333-3333-3333-333333333333","quantity":3},
         {"store_product_id":"44444444-4444-4444-4444-444444444444","quantity":1}]',
       (select id from saved)) $$,
  'Ana edita su lista: cambia cantidad y añade un producto'
);

select is(
  (select name from public.shopping_list where id = (select id from saved)),
  'Mercado del mes',
  'la edición renombra la lista'
);

select results_eq(
  $$ select quantity, price_cop_at_add from public.list_item
     where list_id = (select id from saved)
       and store_product_id = '33333333-3333-3333-3333-333333333333' $$,
  $$ values (3::numeric(10,3), 4200) $$,
  'un producto que se queda conserva su precio de referencia aunque el precio haya subido'
);

select is(
  (select price_cop_at_add from public.list_item
   where list_id = (select id from saved)
     and store_product_id = '44444444-4444-4444-4444-444444444444'),
  15000,
  'un producto nuevo toma el precio de hoy'
);

select results_eq(
  $$ select item_count, total_cop, total_at_add_cop from public.list_summary
     where id = (select id from saved) $$,
  $$ values (2, 30000, 27600) $$,
  'list_summary calcula el total con precios de hoy y con los de referencia'
);

select lives_ok(
  $$ select public.save_list(
       'Mercado del mes',
       '[{"store_product_id":"44444444-4444-4444-4444-444444444444","quantity":1}]',
       (select id from saved)) $$,
  'Ana quita un producto'
);

select is(
  (select count(*)::int from public.list_item where list_id = (select id from saved)),
  1,
  'el producto quitado ya no está en la lista'
);

-- ---------------------------------------------------------------------------
-- Denied: Beto's list is not Ana's to see or edit
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.save_list(
       'Secuestrada',
       '[{"store_product_id":"44444444-4444-4444-4444-444444444444","quantity":9}]',
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  'P0002',
  null,
  'Ana NO puede editar la lista de Beto: responde "no encontrada"'
);

select is(
  (select count(*)::int from public.list_summary),
  1,
  'Ana solo ve su propia lista en list_summary'
);

select throws_ok(
  $$ insert into public.list_reminder (list_id, owner_id, frequency, weekday, time_local)
     values ((select id from saved), '11111111-1111-1111-1111-111111111111', 'weekly', 6, '08:00'),
            ((select id from saved), '11111111-1111-1111-1111-111111111111', 'weekly', 7, '09:00') $$,
  '23505',
  null,
  'una lista tiene como máximo un recordatorio'
);

reset role;

select results_eq(
  $$ select name, (select count(*)::int from public.list_item
                   where list_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
     from public.shopping_list where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  $$ values ('Mercado de Beto'::text, 1) $$,
  'la lista de Beto sigue intacta'
);

select * from finish();

rollback;
