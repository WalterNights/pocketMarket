-- The catalogue is public; user data is not. A relaxation of permissions is
-- exactly where a test belongs: this asserts the relaxation stopped where it
-- was supposed to.

begin;

select plan(9);

-- Fixtures created as superuser, before dropping to the anon role.
insert into auth.users (id, email, instance_id, aud, role)
values ('44444444-4444-4444-4444-444444444444', 'carla@test.local',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into public.store_product (id, store_id, external_id, name, unit_kind, unit_value, unit_measure)
select '55555555-5555-5555-5555-555555555555', s.id, 'ANON-SKU-1', 'Panela', 'weight', 500, 'g'
from public.store s where s.slug = 'exito';

insert into public.price_snapshot (store_product_id, region_code, price_cop)
values ('55555555-5555-5555-5555-555555555555', 'NACIONAL', 4900);

refresh materialized view public.current_price;

insert into public.shopping_list (id, owner_id, name)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        '44444444-4444-4444-4444-444444444444', 'Lista privada de Carla');

insert into public.list_item (list_id, store_product_id, quantity, price_cop_at_add)
values ('cccccccc-cccc-cccc-cccc-cccccccccccc',
        '55555555-5555-5555-5555-555555555555', 1, 0);

-- ---------------------------------------------------------------------------
-- Act as a visitor with no session
-- ---------------------------------------------------------------------------

set local role anon;

-- --- Can read the catalogue ------------------------------------------------

select ok(
  (select count(*) from public.store_product) > 0,
  'Sin cuenta SÍ se puede leer el catálogo'
);

select ok(
  (select count(*) from public.store) > 0,
  'Sin cuenta SÍ se pueden leer las tiendas'
);

select is(
  (select price_cop from public.catalog_product
   where id = '55555555-5555-5555-5555-555555555555'),
  4900,
  'Sin cuenta el precio cae a NACIONAL (auth.uid() es null)'
);

-- --- Cannot write the catalogue --------------------------------------------

select throws_ok(
  $$ update public.store_product set name = 'Envenenado' where external_id = 'ANON-SKU-1' $$,
  '42501',
  null,
  'Sin cuenta NO se puede modificar el catálogo'
);

select throws_ok(
  $$ insert into public.price_snapshot (store_product_id, region_code, price_cop)
     values ('55555555-5555-5555-5555-555555555555', 'NACIONAL', 1) $$,
  '42501',
  null,
  'Sin cuenta NO se pueden inventar precios'
);

-- --- Cannot touch user data — this is where the relaxation had to stop -----

select throws_ok(
  $$ select count(*) from public.shopping_list $$,
  '42501',
  null,
  'Sin cuenta NO se pueden leer listas de nadie'
);

select throws_ok(
  $$ select count(*) from public.list_item $$,
  '42501',
  null,
  'Sin cuenta NO se pueden leer ítems de listas'
);

select throws_ok(
  $$ select count(*) from public.profile $$,
  '42501',
  null,
  'Sin cuenta NO se pueden leer perfiles'
);

select throws_ok(
  $$ insert into public.shopping_list (owner_id, name)
     values ('44444444-4444-4444-4444-444444444444', 'Lista intrusa') $$,
  '42501',
  null,
  'Sin cuenta NO se pueden crear listas'
);

select * from finish();

rollback;
