-- Extensions, shared helpers and the region catalogue.
-- See docs/domain/01-data-model.md

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- Trigram matching: typo-tolerant product search ("arros" -> "arroz").
create extension if not exists pg_trgm with schema extensions;

-- Accent-insensitive search: "platano" must find "plátano".
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- unaccent() is STABLE, not IMMUTABLE, so Postgres refuses it inside a generated
-- column or an expression index. This wrapper pins the dictionary, which makes the
-- call deterministic and therefore safe to mark IMMUTABLE.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- Keeps updated_at honest. The device clock is never trusted (see rules/supabase.md).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- region
-- ---------------------------------------------------------------------------
-- Price scope. 'NACIONAL' is the fallback: hard discounters publish a single
-- country-wide price, while Éxito varies by city.

create table public.region (
  code text primary key,
  name text not null,
  sort_order smallint not null default 100
);

comment on table public.region is
  'Price scope. NACIONAL is the fallback when a store has no regional pricing.';

insert into public.region (code, name, sort_order) values
  ('NACIONAL', 'Nacional',      0),
  ('BOG',      'Bogotá',       10),
  ('MDE',      'Medellín',     20),
  ('CLO',      'Cali',         30),
  ('BAQ',      'Barranquilla', 40),
  ('CTG',      'Cartagena',    50),
  ('BGA',      'Bucaramanga',  60);
