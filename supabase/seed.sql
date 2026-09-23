-- Development seed. Runs after migrations on `pnpm run db:reset`.
--
-- Fake catalogue data so the app has something to render before the Éxito
-- adapter exists. Prices are plausible COP values, NOT real store prices.
-- Real data only ever arrives through the ingestion pipeline.

do $$
declare
  v_exito     uuid;
  v_viveres   uuid;
  v_lacteos   uuid;
  v_bebidas   uuid;
  v_product   uuid;
  v_seed record;
begin
  select id into v_exito   from public.store    where slug = 'exito';
  select id into v_viveres from public.category where slug = 'viveres';
  select id into v_lacteos from public.category where slug = 'lacteos';
  select id into v_bebidas from public.category where slug = 'bebidas';

  for v_seed in
    select * from (values
      ('SEED-001', 'Arroz blanco',        'Diana',    v_viveres, 'weight', 500::numeric, 'g',  4200, null::integer),
      ('SEED-002', 'Arroz blanco',        'Diana',    v_viveres, 'weight', 1000::numeric,'g',  7800, null::integer),
      ('SEED-003', 'Aceite de girasol',   'Premier',  v_viveres, 'volume', 1000::numeric,'ml',12900, 14500),
      ('SEED-004', 'Lentejas',            'Del Campo',v_viveres, 'weight', 500::numeric, 'g',  3600, null::integer),
      ('SEED-005', 'Panela pulverizada',  'Doña Panela', v_viveres,'weight',500::numeric,'g',  4900, null::integer),
      ('SEED-006', 'Leche entera',        'Alquería', v_lacteos, 'volume', 1100::numeric,'ml', 4800, null::integer),
      ('SEED-007', 'Queso campesino',     'Alpina',   v_lacteos, 'weight', 250::numeric, 'g',  8900, null::integer),
      ('SEED-008', 'Huevos AA x 30',      'Kikes',    v_lacteos, 'unit',   30::numeric,  'un',18500, 21000),
      ('SEED-009', 'Café molido',         'Sello Rojo', v_bebidas,'weight',500::numeric, 'g', 16400, null::integer),
      ('SEED-010', 'Chocolate de mesa',   'Corona',   v_bebidas, 'weight', 500::numeric, 'g',  9200, null::integer)
    ) as t(external_id, name, brand, category_id, unit_kind, unit_value, unit_measure, price_cop, list_price_cop)
  loop
    insert into public.store_product
      (store_id, external_id, name, brand, category_id, unit_kind, unit_value, unit_measure)
    values
      (v_exito, v_seed.external_id, v_seed.name, v_seed.brand, v_seed.category_id,
       v_seed.unit_kind, v_seed.unit_value, v_seed.unit_measure)
    on conflict (store_id, external_id) do update set name = excluded.name
    returning id into v_product;

    insert into public.price_snapshot (store_product_id, region_code, price_cop, list_price_cop)
    values (v_product, 'NACIONAL', v_seed.price_cop, v_seed.list_price_cop);
  end loop;

  -- A second, older snapshot for one product so the app can show a price change.
  select id into v_product
  from public.store_product
  where store_id = v_exito and external_id = 'SEED-001';

  insert into public.price_snapshot (store_product_id, region_code, price_cop, captured_at)
  values (v_product, 'NACIONAL', 3800, now() - interval '30 days');
end $$;

refresh materialized view public.current_price;
