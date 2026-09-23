-- Rework the taxonomy into how people actually shop in Colombia.
--
-- The old one was too coarse and used words nobody says: "Víveres y abarrotes"
-- is not how anyone describes rice, and eggs sat inside dairy so a carton
-- showed up next to yoghurt.
--
-- Now each category is one aisle you would actually walk to. Eggs stand alone
-- because they are bought alone, and "Gaseosas" is its own thing rather than
-- being buried in a generic "Bebidas".

-- Products point at categories, so detach before replacing them.
update public.store_product set category_id = null;
delete from public.category;

insert into public.category (slug, name, sort_order) values
  -- Frescos
  ('frutas',            'Frutas',                 10),
  ('verduras',          'Verduras y hortalizas',  20),

  -- Proteínas
  ('carnes',            'Carnes',                 30),
  ('pollo',             'Pollo',                  40),
  ('pescados',          'Pescados y mariscos',    50),
  ('embutidos',         'Embutidos y fiambres',   60),
  ('huevos',            'Huevos',                 70),

  -- Lácteos, separados entre sí
  ('leche',             'Leche',                  80),
  ('quesos',            'Quesos',                 90),
  ('yogures',           'Yogur y postres',       100),
  ('mantequilla',       'Mantequilla y margarina', 110),

  -- Despensa, desglosada
  ('arroz',             'Arroz',                 120),
  ('granos',            'Granos y legumbres',    130),
  ('pastas',            'Pastas',                140),
  ('aceites',           'Aceites y vinagres',    150),
  ('azucar-panela',     'Azúcar y panela',       160),
  ('sal-condimentos',   'Sal, salsas y condimentos', 170),
  ('enlatados',         'Enlatados y conservas', 180),
  ('sopas',             'Sopas, cremas y caldos',185),
  ('mermeladas',        'Mermeladas y untables', 187),
  ('harinas',           'Harinas y mezclas',     190),
  ('cafe-chocolate',    'Café y chocolate',      200),
  ('cereales',          'Cereales y avena',      210),
  ('te-aromaticas',     'Té y aromáticas',       215),

  -- Panadería
  ('pan',               'Pan',                   220),
  ('arepas',            'Arepas y tortillas',    230),
  ('galletas',          'Galletas y ponqués',    240),

  -- Bebidas, desglosadas
  ('gaseosas',          'Gaseosas',              250),
  ('jugos',             'Jugos y refrescos',     260),
  ('agua',              'Agua',                  270),
  ('licores',           'Cervezas y licores',    280),

  -- Otros
  ('snacks',            'Pasabocas',             290),
  ('dulces',            'Dulces y chocolatinas', 300),
  ('congelados',        'Congelados',            310),
  ('aseo-hogar',        'Aseo del hogar',        320),
  ('cuidado-personal',  'Cuidado personal',      330),
  ('bebes',             'Bebés',                 340),
  ('mascotas',          'Mascotas',              350),
  ('otros',             'Otros',                 999);

comment on table public.category is
  'Colombian grocery aisles. Deliberately granular: eggs are not dairy, and '
  'gaseosas are not just "bebidas" — that is how people look for them.';
