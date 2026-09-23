-- Make the catalogue readable without an account.
--
-- These are prices the stores already publish. Forcing a sign-up to look one up
-- is friction with no security benefit: the anon key is public anyway, so the
-- only thing the previous restriction bought was an extra tap.
--
-- User data is untouched and stays private: reading a price needs no account,
-- saving a list does.

grant select on public.region             to anon;
grant select on public.store              to anon;
grant select on public.category           to anon;
grant select on public.store_product      to anon;
grant select on public.price_snapshot     to anon;
grant select on public.equivalence_group  to anon;
grant select on public.equivalence_member to anon;
grant select on public.current_price      to anon;
grant select on public.catalog_product    to anon;

-- Still no insert/update/delete policy anywhere in the catalogue: that absence
-- is what stops anyone poisoning prices, and it is unchanged.
create policy "catálogo: regiones legibles sin cuenta"
  on public.region for select to anon using (true);

create policy "catálogo: tiendas legibles sin cuenta"
  on public.store for select to anon using (true);

create policy "catálogo: categorías legibles sin cuenta"
  on public.category for select to anon using (true);

create policy "catálogo: productos legibles sin cuenta"
  on public.store_product for select to anon using (true);

create policy "catálogo: histórico de precios legible sin cuenta"
  on public.price_snapshot for select to anon using (true);

create policy "catálogo: grupos de equivalencia legibles sin cuenta"
  on public.equivalence_group for select to anon using (true);

create policy "catálogo: miembros de equivalencia legibles sin cuenta"
  on public.equivalence_member for select to anon using (true);

-- catalog_product resolves the region from the caller's profile. With no
-- session auth.uid() is null, so the subquery yields nothing and price_for()
-- falls back to NACIONAL — exactly the behaviour we want for a guest.
