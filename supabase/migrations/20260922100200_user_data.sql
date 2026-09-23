-- User data: private, RLS by auth.uid().

-- ---------------------------------------------------------------------------
-- profile
-- ---------------------------------------------------------------------------

create table public.profile (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  region_code  text not null default 'NACIONAL' references public.region(code),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profile_set_updated_at
  before update on public.profile
  for each row execute function public.set_updated_at();

-- Create the profile row automatically on sign-up. Without this, the app would
-- have to create it client-side and handle the race on first launch.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- shopping_list
-- ---------------------------------------------------------------------------

create table public.shopping_list (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  notes       text,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger shopping_list_set_updated_at
  before update on public.shopping_list
  for each row execute function public.set_updated_at();

create index shopping_list_owner_idx on public.shopping_list (owner_id) where not is_archived;

-- ---------------------------------------------------------------------------
-- list_item
-- ---------------------------------------------------------------------------

create table public.list_item (
  id               uuid primary key default gen_random_uuid(),
  list_id          uuid not null references public.shopping_list(id) on delete cascade,
  store_product_id uuid not null references public.store_product(id),

  -- numeric, not integer: some products are sold by weight (0.5 kg of meat).
  quantity         numeric(10,3) not null default 1 check (quantity > 0),
  note             text,
  is_checked       boolean not null default false,
  position         integer not null default 0,

  -- Price frozen when the product was added. Lets the app show "went up $400
  -- since you added it" instead of silently swapping the number.
  -- Written by a trigger, NEVER by the client (rules/supabase.md).
  price_cop_at_add integer not null,

  created_at       timestamptz not null default now(),

  constraint list_item_unique_product unique (list_id, store_product_id)
);

comment on column public.list_item.price_cop_at_add is
  'Set by trigger from current_price. If the client could send it, it could fake '
  'the price variation.';

create index list_item_list_idx on public.list_item (list_id);

-- ---------------------------------------------------------------------------
-- list_reminder
-- ---------------------------------------------------------------------------
-- The definition lives here so it survives a reinstall and syncs across devices.
-- Actual scheduling happens on-device with local notifications
-- (docs/domain/03-reminders.md).

create table public.list_reminder (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.shopping_list(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,

  frequency    text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  weekday      smallint check (weekday is null or weekday between 1 and 7),
  day_of_month smallint check (day_of_month is null or day_of_month between 1 and 31),
  time_local   time not null,
  -- Anchor for the 14-day count. Biweekly has no native OS trigger.
  anchor_date  date,

  is_enabled   boolean not null default true,
  created_at   timestamptz not null default now(),

  -- Each frequency needs its own field and must not carry the others'.
  constraint list_reminder_schedule_shape check (
    (frequency in ('weekly', 'biweekly') and weekday is not null and day_of_month is null)
    or (frequency = 'monthly' and day_of_month is not null and weekday is null)
  ),
  constraint list_reminder_biweekly_anchor check (
    frequency <> 'biweekly' or anchor_date is not null
  )
);

comment on constraint list_reminder_biweekly_anchor on public.list_reminder is
  'Biweekly reminders need an anchor: there is no native "every 14 days" trigger '
  'on iOS or Android, so the client schedules occurrences in batches from it.';

create index list_reminder_owner_idx on public.list_reminder (owner_id) where is_enabled;
create index list_reminder_list_idx  on public.list_reminder (list_id);
