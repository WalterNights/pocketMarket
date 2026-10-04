-- save_list rejects payloads the app would never send but anyone could.
--
-- Run with:  pnpm run db:test

begin;

select plan(9);

insert into auth.users (id, email, instance_id, aud, role)
values ('11111111-1111-1111-1111-111111111111', 'ana@test.local',
        '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

insert into public.store_product (id, store_id, external_id, name, unit_kind)
select '33333333-3333-3333-3333-333333333333', s.id, 'TEST-ARROZ', 'Arroz', 'unit'
from public.store s where s.slug = 'exito';

insert into public.price_snapshot (store_product_id, region_code, price_cop)
values ('33333333-3333-3333-3333-333333333333', 'NACIONAL', 4200);

refresh materialized view public.current_price;

set local role authenticated;
set local "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- --- Quantity ---------------------------------------------------------------

-- NaN passes `quantity > 0` in Postgres and then breaks list_totals.
select throws_ok(
  $$ select public.save_list('x', '[{"store_product_id":"33333333-3333-3333-3333-333333333333","quantity":"NaN"}]') $$,
  '22003', null,
  'una cantidad NaN se rechaza'
);

select throws_ok(
  $$ select public.save_list('x', '[{"store_product_id":"33333333-3333-3333-3333-333333333333","quantity":1000}]') $$,
  '22003', null,
  'una cantidad mayor que 999 se rechaza'
);

select throws_ok(
  $$ select public.save_list('x', '[{"store_product_id":"33333333-3333-3333-3333-333333333333","quantity":0.0001}]') $$,
  '22003', null,
  'una cantidad menor que 0.001 se rechaza'
);

select throws_ok(
  $$ select public.save_list('x', '[{"store_product_id":"33333333-3333-3333-3333-333333333333","quantity":-2}]') $$,
  '22003', null,
  'una cantidad negativa se rechaza'
);

select throws_ok(
  $$ select public.save_list('x', '[{"store_product_id":"33333333-3333-3333-3333-333333333333"}]') $$,
  '22003', null,
  'un producto sin cantidad se rechaza'
);

-- --- Size -------------------------------------------------------------------

select throws_ok(
  $$ select public.save_list(
       'x',
       (select jsonb_agg(jsonb_build_object(
                 'store_product_id', gen_random_uuid(), 'quantity', 1))
          from generate_series(1, 501))) $$,
  '54000', null,
  'más de 500 productos se rechaza'
);

select throws_ok(
  $$ select public.save_list(repeat('a', 101), '[{"store_product_id":"33333333-3333-3333-3333-333333333333","quantity":1}]') $$,
  '22001', null,
  'un nombre de más de 100 caracteres se rechaza'
);

-- --- Within bounds still works ----------------------------------------------

select lives_ok(
  $$ select public.save_list(repeat('a', 100), '[{"store_product_id":"33333333-3333-3333-3333-333333333333","quantity":0.5}]') $$,
  'en los límites (100 caracteres, 0.5 kg) se guarda'
);

select is(
  (select count(*)::int from public.shopping_list
    where owner_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'ninguna lista rechazada quedó a medio guardar'
);

select * from finish();

rollback;
