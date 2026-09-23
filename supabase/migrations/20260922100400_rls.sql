-- Row Level Security.
--
-- The app bundle is public and so is the anon key. These policies are the ONLY
-- real security boundary (docs/architecture/08-security.md).
--
-- Two worlds:
--   CATALOGUE  -> readable by authenticated, writable ONLY by service_role.
--                 The ABSENCE of write policies is deliberate and IS the protection.
--   USER DATA  -> owner and nobody else.

-- ===========================================================================
-- CATALOGUE — read only for the app
-- ===========================================================================

alter table public.region             enable row level security;
alter table public.store              enable row level security;
alter table public.category           enable row level security;
alter table public.store_product      enable row level security;
alter table public.price_snapshot     enable row level security;
alter table public.equivalence_group  enable row level security;
alter table public.equivalence_member enable row level security;

-- Supabase grants broadly on public by default. Be explicit instead: strip
-- everything, then hand back exactly SELECT. Belt and braces with RLS.
revoke all on public.region             from anon, authenticated;
revoke all on public.store              from anon, authenticated;
revoke all on public.category           from anon, authenticated;
revoke all on public.store_product      from anon, authenticated;
revoke all on public.price_snapshot     from anon, authenticated;
revoke all on public.equivalence_group  from anon, authenticated;
revoke all on public.equivalence_member from anon, authenticated;

grant select on public.region             to authenticated;
grant select on public.store              to authenticated;
grant select on public.category           to authenticated;
grant select on public.store_product      to authenticated;
grant select on public.price_snapshot     to authenticated;
grant select on public.equivalence_group  to authenticated;
grant select on public.equivalence_member to authenticated;

create policy "catálogo: regiones legibles"
  on public.region for select to authenticated using (true);

create policy "catálogo: tiendas legibles"
  on public.store for select to authenticated using (true);

create policy "catálogo: categorías legibles"
  on public.category for select to authenticated using (true);

create policy "catálogo: productos legibles"
  on public.store_product for select to authenticated using (true);

create policy "catálogo: histórico de precios legible"
  on public.price_snapshot for select to authenticated using (true);

create policy "catálogo: grupos de equivalencia legibles"
  on public.equivalence_group for select to authenticated using (true);

create policy "catálogo: miembros de equivalencia legibles"
  on public.equivalence_member for select to authenticated using (true);

-- NOTE: no insert/update/delete policy exists above, on purpose.
-- If a client could write prices, anyone could poison every user's data.

-- current_price is a materialized view: RLS does not apply, grants do.
grant select on public.current_price to authenticated;

-- ===========================================================================
-- USER DATA — owner only
-- ===========================================================================

alter table public.profile       enable row level security;
alter table public.shopping_list enable row level security;
alter table public.list_item     enable row level security;
alter table public.list_reminder enable row level security;

revoke all on public.profile       from anon, authenticated;
revoke all on public.shopping_list from anon, authenticated;
revoke all on public.list_item     from anon, authenticated;
revoke all on public.list_reminder from anon, authenticated;

grant select, insert, update          on public.profile       to authenticated;
grant select, insert, update, delete  on public.shopping_list to authenticated;
grant select, insert, update, delete  on public.list_item     to authenticated;
grant select, insert, update, delete  on public.list_reminder to authenticated;

grant select on public.list_totals to authenticated;

-- --------------------------------------------------------------------------
-- profile
-- --------------------------------------------------------------------------
-- No delete policy: the row goes with the auth user via ON DELETE CASCADE.

create policy "perfil: leer el propio"
  on public.profile for select to authenticated
  using (auth.uid() = id);

create policy "perfil: crear el propio"
  on public.profile for insert to authenticated
  with check (auth.uid() = id);

create policy "perfil: editar el propio"
  on public.profile for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- --------------------------------------------------------------------------
-- shopping_list
-- --------------------------------------------------------------------------
-- WITH CHECK on insert/update is what stops a user creating rows owned by
-- someone else. USING alone is not enough.

create policy "listas: leer las propias"
  on public.shopping_list for select to authenticated
  using (auth.uid() = owner_id);

create policy "listas: crear las propias"
  on public.shopping_list for insert to authenticated
  with check (auth.uid() = owner_id);

create policy "listas: editar las propias"
  on public.shopping_list for update to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "listas: borrar las propias"
  on public.shopping_list for delete to authenticated
  using (auth.uid() = owner_id);

-- --------------------------------------------------------------------------
-- list_item — ownership is reached through the list
-- --------------------------------------------------------------------------
-- These subqueries rely on shopping_list's PK and shopping_list_owner_idx.
-- Without them RLS degrades fast as lists grow.

create policy "ítems: leer los de mis listas"
  on public.list_item for select to authenticated
  using (exists (
    select 1 from public.shopping_list l
    where l.id = list_item.list_id and l.owner_id = auth.uid()
  ));

create policy "ítems: crear en mis listas"
  on public.list_item for insert to authenticated
  with check (exists (
    select 1 from public.shopping_list l
    where l.id = list_item.list_id and l.owner_id = auth.uid()
  ));

create policy "ítems: editar los de mis listas"
  on public.list_item for update to authenticated
  using (exists (
    select 1 from public.shopping_list l
    where l.id = list_item.list_id and l.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.shopping_list l
    where l.id = list_item.list_id and l.owner_id = auth.uid()
  ));

create policy "ítems: borrar los de mis listas"
  on public.list_item for delete to authenticated
  using (exists (
    select 1 from public.shopping_list l
    where l.id = list_item.list_id and l.owner_id = auth.uid()
  ));

-- --------------------------------------------------------------------------
-- list_reminder — owner_id AND the list must both belong to the caller
-- --------------------------------------------------------------------------
-- Checking only owner_id would let a user attach a reminder to someone else's
-- list; checking only the list would let them set a foreign owner_id.

create policy "recordatorios: leer los propios"
  on public.list_reminder for select to authenticated
  using (auth.uid() = owner_id);

create policy "recordatorios: crear los propios"
  on public.list_reminder for insert to authenticated
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.shopping_list l
      where l.id = list_reminder.list_id and l.owner_id = auth.uid()
    )
  );

create policy "recordatorios: editar los propios"
  on public.list_reminder for update to authenticated
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (
      select 1 from public.shopping_list l
      where l.id = list_reminder.list_id and l.owner_id = auth.uid()
    )
  );

create policy "recordatorios: borrar los propios"
  on public.list_reminder for delete to authenticated
  using (auth.uid() = owner_id);
