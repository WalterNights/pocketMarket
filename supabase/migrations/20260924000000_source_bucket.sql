-- Keep the bucket the source filed each product under.
--
-- Our taxonomy is deduced from the product name, and those rules change every
-- time a product turns up on the wrong shelf. Re-deriving them meant asking
-- Éxito for its whole catalogue again, which is both slow and rude: the source
-- owes us one visit a day, not one per idea.
--
-- With the source bucket stored, the classifier can be re-run over the
-- catalogue already here. It is also plain provenance: it says where the store
-- itself put the product, which is evidence our rules cannot reconstruct.

alter table public.store_product
  add column if not exists source_bucket text;

comment on column public.store_product.source_bucket is
  'Coarse category the SOURCE assigned, before our own classification. Kept so '
  'products can be reclassified without fetching the catalogue again.';
