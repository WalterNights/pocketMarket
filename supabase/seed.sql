-- Development seed. Runs after migrations on `pnpm run db:reset`.
--
-- ⚠️ THESE PRICES ARE INVENTED. Plausible Colombian brands and amounts so the
-- UI can be exercised with a realistic shape, but not a single figure comes
-- from a real store. Real data only ever arrives through the ingestion
-- pipeline (docs/domain/02-ingestion.md).
--
-- Exists so categories, search and totals have enough volume to be judged.
-- Never runs against a remote project.

do $$
declare
  v_exito   uuid;
  v_product uuid;
  v_seed    record;
begin
  select id into v_exito from public.store where slug = 'exito';

  for v_seed in
    select * from (values
      -- Víveres y abarrotes
      ('SEED-001', 'Arroz blanco',            'Diana',      'viveres', 'weight', 500::numeric,  'g',   4200, null::integer),
      ('SEED-002', 'Arroz blanco',            'Diana',      'viveres', 'weight', 1000::numeric, 'g',   7800, null::integer),
      ('SEED-003', 'Arroz premium',           'Roa',        'viveres', 'weight', 1000::numeric, 'g',   8900, 9900),
      ('SEED-004', 'Arroz integral',          'Florhuila',  'viveres', 'weight', 500::numeric,  'g',   5600, null::integer),
      ('SEED-005', 'Lentejas',                'Del Campo',  'viveres', 'weight', 500::numeric,  'g',   3600, null::integer),
      ('SEED-006', 'Fríjol cargamanto',       'Del Campo',  'viveres', 'weight', 500::numeric,  'g',   6900, null::integer),
      ('SEED-007', 'Garbanzo',                'La Especial','viveres', 'weight', 500::numeric,  'g',   7200, null::integer),
      ('SEED-008', 'Aceite de girasol',       'Premier',    'viveres', 'volume', 1000::numeric, 'ml', 12900, 14500),
      ('SEED-009', 'Aceite de oliva extra',   'Olivetto',   'viveres', 'volume', 500::numeric,  'ml', 28900, null::integer),
      ('SEED-010', 'Panela pulverizada',      'Doña Panela','viveres', 'weight', 500::numeric,  'g',   4900, null::integer),
      ('SEED-011', 'Azúcar blanca',           'Manuelita',  'viveres', 'weight', 1000::numeric, 'g',   5400, null::integer),
      ('SEED-012', 'Sal refinada',            'Refisal',    'viveres', 'weight', 1000::numeric, 'g',   2300, null::integer),
      ('SEED-013', 'Pasta espagueti',         'Doria',      'viveres', 'weight', 500::numeric,  'g',   4100, null::integer),
      ('SEED-014', 'Harina de trigo',         'Haz de Oros','viveres', 'weight', 1000::numeric, 'g',   4800, null::integer),
      ('SEED-015', 'Avena en hojuelas',       'Quaker',     'viveres', 'weight', 500::numeric,  'g',   6200, null::integer),
      ('SEED-016', 'Atún en aceite',          'Van Camps',  'viveres', 'weight', 160::numeric,  'g',   6800, 7500),

      -- Lácteos y huevos
      ('SEED-020', 'Leche entera',            'Alquería',   'lacteos', 'volume', 1100::numeric, 'ml',  4800, null::integer),
      ('SEED-021', 'Leche deslactosada',      'Alpina',     'lacteos', 'volume', 1100::numeric, 'ml',  5600, null::integer),
      ('SEED-022', 'Leche entera',            'Colanta',    'lacteos', 'volume', 1000::numeric, 'ml',  4500, null::integer),
      ('SEED-023', 'Queso campesino',         'Alpina',     'lacteos', 'weight', 250::numeric,  'g',   8900, null::integer),
      ('SEED-024', 'Queso doble crema',       'Colanta',    'lacteos', 'weight', 500::numeric,  'g',  16400, 18000),
      ('SEED-025', 'Yogur griego natural',    'Alpina',     'lacteos', 'volume', 150::numeric,  'ml',  3200, null::integer),
      ('SEED-026', 'Mantequilla con sal',     'Colanta',    'lacteos', 'weight', 250::numeric,  'g',   9800, null::integer),
      ('SEED-027', 'Huevos AA x 30',          'Kikes',      'lacteos', 'unit',   30::numeric,   'un', 18500, 21000),
      ('SEED-028', 'Huevos AA x 12',          'Kikes',      'lacteos', 'unit',   12::numeric,   'un',  8200, null::integer),
      ('SEED-029', 'Huevos AAA x 30',         'Santa Reyes','lacteos', 'unit',   30::numeric,   'un', 21900, null::integer),
      ('SEED-030', 'Arequipe',                'Alpina',     'lacteos', 'weight', 250::numeric,  'g',   7400, null::integer),

      -- Carnes y pescados
      ('SEED-040', 'Pechuga de pollo',        'Pimpollo',   'carnes',  'weight', 1000::numeric, 'g',  18900, null::integer),
      ('SEED-041', 'Muslo de pollo',          'Pimpollo',   'carnes',  'weight', 1000::numeric, 'g',  12400, null::integer),
      ('SEED-042', 'Carne de res molida',     'Friogán',    'carnes',  'weight', 500::numeric,  'g',  16800, null::integer),
      ('SEED-043', 'Costilla de cerdo',       'Zenú',       'carnes',  'weight', 1000::numeric, 'g',  21500, 23900),
      ('SEED-044', 'Filete de tilapia',       'Mar Azul',   'carnes',  'weight', 500::numeric,  'g',  19800, null::integer),
      ('SEED-045', 'Jamón de cerdo',          'Zenú',       'carnes',  'weight', 200::numeric,  'g',   8900, null::integer),
      ('SEED-046', 'Salchichas',              'Ranchera',   'carnes',  'weight', 450::numeric,  'g',  11200, null::integer),
      ('SEED-047', 'Chorizo santarrosano',    'Zenú',       'carnes',  'weight', 500::numeric,  'g',  14600, null::integer),

      -- Frutas y verduras
      ('SEED-060', 'Plátano maduro',          null,         'frutas-verduras', 'weight', 1000::numeric, 'g',  3800, null::integer),
      ('SEED-061', 'Banano',                  null,         'frutas-verduras', 'weight', 1000::numeric, 'g',  3200, null::integer),
      ('SEED-062', 'Papa pastusa',            null,         'frutas-verduras', 'weight', 1000::numeric, 'g',  2900, null::integer),
      ('SEED-063', 'Cebolla cabezona',        null,         'frutas-verduras', 'weight', 1000::numeric, 'g',  4100, null::integer),
      ('SEED-064', 'Tomate chonto',           null,         'frutas-verduras', 'weight', 1000::numeric, 'g',  4600, null::integer),
      ('SEED-065', 'Zanahoria',               null,         'frutas-verduras', 'weight', 1000::numeric, 'g',  3400, null::integer),
      ('SEED-066', 'Aguacate hass',           null,         'frutas-verduras', 'unit',   1::numeric,    'un',  4200, null::integer),
      ('SEED-067', 'Limón Tahití',            null,         'frutas-verduras', 'weight', 500::numeric,  'g',   3100, null::integer),
      ('SEED-068', 'Naranja valencia',        null,         'frutas-verduras', 'weight', 1000::numeric, 'g',   3900, null::integer),
      ('SEED-069', 'Manzana roya',            null,         'frutas-verduras', 'weight', 1000::numeric, 'g',   9800, null::integer),

      -- Panadería
      ('SEED-080', 'Pan tajado blanco',       'Bimbo',      'panaderia', 'weight', 450::numeric, 'g',  7200, null::integer),
      ('SEED-081', 'Pan integral',            'Bimbo',      'panaderia', 'weight', 450::numeric, 'g',  8400, null::integer),
      ('SEED-082', 'Arepa de maíz blanco',    'Doña Arepa', 'panaderia', 'unit',   5::numeric,   'un', 4600, null::integer),
      ('SEED-083', 'Tortillas de trigo',      'Bimbo',      'panaderia', 'unit',   10::numeric,  'un', 6900, null::integer),

      -- Bebidas
      ('SEED-100', 'Café molido',             'Sello Rojo', 'bebidas', 'weight', 500::numeric,  'g',  16400, null::integer),
      ('SEED-101', 'Café molido premium',     'Juan Valdez','bebidas', 'weight', 500::numeric,  'g',  28900, 31900),
      ('SEED-102', 'Chocolate de mesa',       'Corona',     'bebidas', 'weight', 500::numeric,  'g',   9200, null::integer),
      ('SEED-103', 'Gaseosa cola',            'Coca-Cola',  'bebidas', 'volume', 1500::numeric, 'ml',  5400, null::integer),
      ('SEED-104', 'Jugo de naranja',         'Hit',        'bebidas', 'volume', 1500::numeric, 'ml',  5900, null::integer),
      ('SEED-105', 'Agua sin gas',            'Cristal',    'bebidas', 'volume', 600::numeric,  'ml',  2200, null::integer),
      ('SEED-106', 'Cerveza lata',            'Águila',     'bebidas', 'volume', 330::numeric,  'ml',  3400, null::integer),

      -- Aseo del hogar
      ('SEED-120', 'Detergente en polvo',     'Fab',        'aseo-hogar', 'weight', 2000::numeric, 'g', 18900, 21000),
      ('SEED-121', 'Jabón lavaplatos',        'Axion',      'aseo-hogar', 'weight', 450::numeric,  'g',  6200, null::integer),
      ('SEED-122', 'Papel higiénico x 12',    'Familia',    'aseo-hogar', 'unit',   12::numeric,   'un', 19800, null::integer),
      ('SEED-123', 'Limpiador multiusos',     'Fabuloso',   'aseo-hogar', 'volume', 1000::numeric, 'ml',  7400, null::integer),

      -- Cuidado personal
      ('SEED-140', 'Shampoo',                 'Head & Shoulders', 'cuidado-personal', 'volume', 375::numeric, 'ml', 18400, null::integer),
      ('SEED-141', 'Jabón de baño x 3',       'Protex',     'cuidado-personal', 'unit',   3::numeric,   'un',  9200, null::integer),
      ('SEED-142', 'Crema dental',            'Colgate',    'cuidado-personal', 'weight', 150::numeric, 'g',   8600, null::integer),
      ('SEED-143', 'Desodorante roll-on',     'Rexona',     'cuidado-personal', 'volume', 50::numeric,  'ml',  9800, null::integer)
    ) as t(external_id, name, brand, category_slug, unit_kind, unit_value, unit_measure, price_cop, list_price_cop)
  loop
    insert into public.store_product
      (store_id, external_id, name, brand, category_id, unit_kind, unit_value, unit_measure)
    values
      (v_exito, v_seed.external_id, v_seed.name, v_seed.brand,
       (select id from public.category where slug = v_seed.category_slug),
       v_seed.unit_kind, v_seed.unit_value, v_seed.unit_measure)
    on conflict (store_id, external_id) do update set name = excluded.name
    returning id into v_product;

    insert into public.price_snapshot (store_product_id, region_code, price_cop, list_price_cop)
    values (v_product, 'NACIONAL', v_seed.price_cop, v_seed.list_price_cop);
  end loop;

  -- An older snapshot for one product, so price-change UI has something to show.
  select id into v_product
  from public.store_product
  where store_id = v_exito and external_id = 'SEED-001';

  insert into public.price_snapshot (store_product_id, region_code, price_cop, captured_at)
  values (v_product, 'NACIONAL', 3800, now() - interval '30 days');
end $$;

refresh materialized view public.current_price;
