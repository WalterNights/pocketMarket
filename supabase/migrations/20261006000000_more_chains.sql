-- More chains for the MVP (plan 0003, ADR-0008).
--
-- Four chains carry prices: Éxito, D1, Olímpica and Supermú. The rest exist so
-- their shops can be drawn on the map and listed as "Próximamente"; a chain
-- becomes browsable the day its adapter ships and this flag flips.

-- D1 publishes its catalogue through the same public VTEX API as Éxito: no
-- browser needed after all (researched 2026-10-04).
update public.store
set source_type = 'api', is_active = true
where slug = 'd1';

insert into public.store (slug, name, source_type, is_active) values
  ('olimpica',        'Olímpica',           'api',    true),
  ('supermu',         'Supermú',            'api',    true),
  ('jumbo',           'Jumbo',              'api',    false),
  ('carulla',         'Carulla',            'api',    false),
  ('vaquita-express', 'La Vaquita Express', 'api',    false),
  ('isimo',           'Ísimo',              'manual', false),
  ('mercado-madrid',  'Mercado Madrid',     'manual', false)
on conflict (slug) do nothing;

comment on column public.store.is_active is
  'The chain has a price adapter running. Inactive chains still have branches on '
  'the map and show as "Próximamente" in the store list (plan 0003).';
