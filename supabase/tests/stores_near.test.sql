-- stores_near: one row per chain, chains with prices first, bounded radius,
-- and anon may call it but still cannot write the catalogue.
--
-- Run with:  pnpm run db:test

begin;

select plan(10);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------------------
-- Origin for every query: Parque de la 93, Bogotá (4.6766, -74.0482).

-- The real branches are hidden for this test only — everything here runs in a
-- transaction that is rolled back — so the results depend on the fixtures.
update public.store_branch set is_active = false;

insert into public.store (slug, name, source_type, is_active) values
  ('tst-priced', 'Prueba con precios',  'api',    true),   -- browsable, 5 km away
  ('tst-soon-a', 'Prueba próxima A',    'manual', false),  -- no prices, closest
  ('tst-soon-b', 'Prueba próxima B',    'manual', false),  -- no prices, 1 km
  ('tst-far',    'Prueba a 40 km',      'manual', false),  -- outside the default radius
  ('tst-faraway','Prueba a 60 km',      'manual', false);  -- outside even the cap

insert into public.store_product (id, store_id, external_id, name, unit_kind, unit_value, unit_measure)
select '77777777-7777-7777-7777-777777777777', s.id, 'TST-SKU-1', 'Panela', 'weight', 500, 'g'
from public.store s where s.slug = 'tst-priced';

insert into public.price_snapshot (store_product_id, region_code, price_cop)
values ('77777777-7777-7777-7777-777777777777', 'NACIONAL', 4900);

refresh materialized view public.current_price;

insert into public.store_branch (store_id, external_id, name, city, location, source, is_active)
select s.id, v.ext, v.name, 'Bogotá',
       extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326)::extensions.geography,
       'manual', v.active
from (values
  ('tst-priced',  'P-5KM',   'Con precios a 5 km', 4.7216, -74.0482, true),
  ('tst-soon-a',  'A-200M',  'A a 200 m',          4.6784, -74.0482, true),
  ('tst-soon-a',  'A-3KM',   'A a 3 km',           4.7036, -74.0482, true),   -- same chain, further
  ('tst-soon-a',  'A-CLOSED','A cerrada',          4.6767, -74.0482, false),  -- closest, inactive
  ('tst-soon-b',  'B-1KM',   'B a 1 km',           4.6856, -74.0482, true),
  ('tst-far',     'F-40KM',  'A 40 km',            5.0366, -74.0482, true),
  ('tst-faraway', 'FF-60KM', 'A 60 km',            5.2166, -74.0482, true)
) as v(slug, ext, name, lat, lng, active)
join public.store s on s.slug = v.slug;

-- ---------------------------------------------------------------------------
-- As anon: the caller of the home screen without an account
-- ---------------------------------------------------------------------------

set local role anon;

select lives_ok(
  $$ select * from public.stores_near(4.6766, -74.0482) $$,
  'anon puede ejecutar stores_near'
);

select results_eq(
  $$ select slug from public.stores_near(4.6766, -74.0482) $$,
  $$ values ('tst-priced'::text), ('tst-soon-a'), ('tst-soon-b') $$,
  'una fila por cadena: primero las que tienen precios, después por distancia'
);

select ok(
  (select nearest_m between 150 and 250 from public.stores_near(4.6766, -74.0482)
   where slug = 'tst-soon-a'),
  'nearest_m es la sucursal activa más cercana de la cadena, no una cerrada'
);

select is(
  (select product_count from public.stores_near(4.6766, -74.0482) where slug = 'tst-priced'),
  1,
  'trae las columnas de store_summary'
);

select is(
  (select count(*)::int from public.stores_near(4.6766, -74.0482, 45000) where slug = 'tst-far'),
  1,
  'con un radio mayor entra la cadena a 40 km'
);

select is(
  (select count(*)::int from public.stores_near(4.6766, -74.0482, 10000000)
   where slug = 'tst-faraway'),
  0,
  'un radio absurdo se acota a 50 km en el servidor'
);

-- Leticia: no fixture (and no real branch, all hidden) anywhere near.
select is(
  (select count(*)::int from public.stores_near(-4.2153, -69.9406)),
  0,
  'sin sucursales cerca devuelve 0 filas'
);

select throws_ok(
  $$ insert into public.store (slug, name, source_type, is_active)
     values ('tst-hack', 'Falsa', 'manual', true) $$,
  '42501',
  null,
  'anon NO puede crear cadenas'
);

select throws_ok(
  $$ update public.store set name = 'Secuestrada' where slug = 'tst-priced' $$,
  '42501',
  null,
  'anon NO puede editar cadenas'
);

select throws_ok(
  $$ insert into public.store_branch (store_id, external_id, name, location, source)
     select id, 'T-HACK', 'Falsa',
            extensions.st_setsrid(extensions.st_makepoint(-74.05, 4.67), 4326)::extensions.geography,
            'manual'
     from public.store where slug = 'tst-priced' $$,
  '42501',
  null,
  'anon NO puede crear sucursales'
);

select * from finish();

rollback;
