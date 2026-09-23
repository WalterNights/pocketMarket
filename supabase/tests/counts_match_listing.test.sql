-- A product count is a promise about the next screen.
--
-- This broke twice in one day: the summaries counted rows in `store_product`
-- while the product list reads `catalog_product`, which only returns a product
-- once `current_price` has a price for it. The app showed "Arroz 111" and an
-- empty list, and every store sat in "próximamente" while holding thousands of
-- products.
--
-- The invariant under test is simply: what the summary counts is what the
-- listing shows, filtered exactly as the repository filters it: priced AND
-- available. Browsing hides what is not for sale — showing an unavailable
-- product greyed out is for a saved list, which is a different screen.
--
-- Nothing here is about permissions — it is about two queries that must not
-- drift apart again.

begin;

select plan(6);

-- Two products in the same category. Only one of them will get a price.
insert into public.store_product (id, store_id, external_id, name, unit_kind, category_id)
select '77777777-7777-7777-7777-777777777771', s.id, 'COUNT-SKU-CON', 'Arroz con precio', 'unit',
       (select id from public.category where slug = 'arroz')
from public.store s where s.slug = 'exito';

insert into public.store_product (id, store_id, external_id, name, unit_kind, category_id)
select '77777777-7777-7777-7777-777777777772', s.id, 'COUNT-SKU-SIN', 'Arroz sin precio', 'unit',
       (select id from public.category where slug = 'arroz')
from public.store s where s.slug = 'exito';

insert into public.price_snapshot (store_product_id, region_code, price_cop)
values ('77777777-7777-7777-7777-777777777771', 'NACIONAL', 3900);

refresh materialized view public.current_price;

-- 1. The priced one is listed.
select isnt_empty(
  $$select id from public.catalog_product
    where id = '77777777-7777-7777-7777-777777777771' and price_cop is not null$$,
  'el producto con precio aparece en el listado'
);

-- 2. The unpriced one is not — this is what the repository filters on.
select is_empty(
  $$select id from public.catalog_product
    where id = '77777777-7777-7777-7777-777777777772' and price_cop is not null$$,
  'el producto sin precio no tiene precio en el listado'
);

-- 3 y 4. The category count agrees with the listing, not with the table.
select is(
  (select product_count from public.store_category_summary
   where store_slug = 'exito' and category_slug = 'arroz'),
  (select count(*)::integer from public.catalog_product
   where store_slug = 'exito' and category_slug = 'arroz'
     and price_cop is not null and is_available),
  'el contador de la categoría es exactamente lo que el listado devuelve'
);

select ok(
  (select product_count from public.store_category_summary
   where store_slug = 'exito' and category_slug = 'arroz')
  < (select count(*)::integer from public.store_product
     where category_id = (select id from public.category where slug = 'arroz')),
  'y es menor que el total de filas: el producto sin precio no se cuenta'
);

-- 5. Same rule for the store summary.
select is(
  (select product_count from public.store_summary where slug = 'exito'),
  (select count(*)::integer from public.catalog_product
   where store_slug = 'exito' and price_cop is not null and is_available),
  'el contador de la tienda tampoco cuenta lo que no se puede mostrar'
);

-- 6. A store with nothing priced still appears, showing zero. Dropping it
--    would hide a store that exists.
select is(
  (select product_count from public.store_summary where slug = 'd1'),
  0,
  'una tienda sin productos con precio sigue en la lista, en cero'
);

select * from finish();

rollback;
