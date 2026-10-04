-- store_branch and nearest_branches: public read, no client writes, and the
-- query's ordering and bounds.
--
-- Run with:  pnpm run db:test

begin;

select plan(12);

-- ---------------------------------------------------------------------------
-- Fixtures (as postgres): four branches around Bogotá, one in Medellín
-- ---------------------------------------------------------------------------
-- Origin for every query: Parque de la 93, Bogotá (4.6766, -74.0482).

-- The table may already hold the real chains (pnpm run branches). Hidden for
-- this test only — everything here runs in a transaction that is rolled back —
-- so the assertions depend on the fixtures, not on what was loaded.
update public.store_branch set is_active = false;

insert into public.store_branch (store_id, external_id, name, city, location, source, is_active)
select s.id, v.ext, v.name, v.city,
       extensions.st_setsrid(extensions.st_makepoint(v.lng, v.lat), 4326)::extensions.geography,
       'manual', v.active
from (values
  ('exito', 'T-NEAR',   'Éxito cerca',      'Bogotá',   4.6780, -74.0490, true),   -- ~180 m
  ('d1',    'T-MID',    'D1 a 2 km',        'Bogotá',   4.6950, -74.0480, true),   -- ~2 km
  ('ara',   'T-FAR',    'Ara a 20 km',      'Bogotá',   4.5000, -74.1200, true),   -- ~21 km
  ('d1',    'T-CLOSED', 'D1 cerrado',       'Bogotá',   4.6770, -74.0485, false),  -- closest, inactive
  ('exito', 'T-MDE',    'Éxito Medellín',   'Medellín', 6.2442, -75.5812, true)    -- ~240 km
) as v(slug, ext, name, city, lat, lng, active)
join public.store s on s.slug = v.slug;

-- ---------------------------------------------------------------------------
-- Integrity
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.store_branch (store_id, external_id, name, location, source)
     select id, 'T-MADRID', 'Fuera del país',
            extensions.st_setsrid(extensions.st_makepoint(-3.70, 40.41), 4326)::extensions.geography,
            'manual'
     from public.store where slug = 'exito' $$,
  '23514',
  null,
  'una coordenada fuera de Colombia se rechaza'
);

-- ---------------------------------------------------------------------------
-- As anon: reads, never writes
-- ---------------------------------------------------------------------------

set local role anon;

select ok(
  (select count(*) from public.store_branch) >= 5,
  'anon lee las sucursales'
);

select throws_ok(
  $$ insert into public.store_branch (store_id, external_id, name, location, source)
     select id, 'T-HACK', 'Falsa',
            extensions.st_setsrid(extensions.st_makepoint(-74.05, 4.67), 4326)::extensions.geography,
            'manual'
     from public.store where slug = 'exito' $$,
  '42501',
  null,
  'anon NO puede crear sucursales'
);

-- No UPDATE / DELETE grant at all, so these fail loudly before RLS is even
-- consulted — stronger than the silent 0-row result a policy would give.
select throws_ok(
  $$ update public.store_branch set name = 'Secuestrada' where external_id = 'T-NEAR' $$,
  '42501',
  null,
  'anon NO puede editar sucursales'
);

select throws_ok(
  $$ delete from public.store_branch where external_id = 'T-NEAR' $$,
  '42501',
  null,
  'anon NO puede borrar sucursales'
);

select results_eq(
  $$ select name from public.nearest_branches(4.6766, -74.0482, 25000, 30)
     where name in ('Éxito cerca', 'D1 a 2 km', 'Ara a 20 km') $$,
  $$ values ('Éxito cerca'::text), ('D1 a 2 km'), ('Ara a 20 km') $$,
  'nearest_branches devuelve la más cercana primero'
);

select is(
  (select count(*)::int from public.nearest_branches(4.6766, -74.0482, 25000, 30)
   where name = 'D1 cerrado'),
  0,
  'una sucursal inactiva no aparece, aunque sea la más cercana'
);

select is(
  (select count(*)::int from public.nearest_branches(4.6766, -74.0482, 25000, 30)
   where name = 'Éxito Medellín'),
  0,
  'lo que está más allá del radio no aparece'
);

select is(
  (select count(*)::int from public.nearest_branches(4.6766, -74.0482, 3000, 30)
   where name in ('Éxito cerca', 'D1 a 2 km', 'Ara a 20 km')),
  2,
  'con 3 km solo entran las dos cercanas'
);

select is(
  (select count(*)::int from public.nearest_branches(4.6766, -74.0482, 25000, 1)),
  1,
  'el límite se respeta'
);

select ok(
  (select count(*) from public.nearest_branches(4.6766, -74.0482, 10000000, 10000)) <= 100,
  'radio y límite absurdos se acotan en el servidor'
);

select is(
  (select has_prices from public.nearest_branches(4.6766, -74.0482, 25000, 30)
   where name = 'Éxito cerca'),
  true,
  'has_prices refleja que la cadena tiene catálogo'
);

select * from finish();

rollback;
