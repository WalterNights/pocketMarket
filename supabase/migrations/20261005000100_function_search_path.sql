-- Pin search_path on the remaining functions that left it open.
--
-- A function without `set search_path` resolves names through the CALLER's
-- search_path. For a trigger that runs on a user's insert, that is a name the
-- caller could shadow with an object in a schema they control. The Supabase
-- linter flags it (function_search_path_mutable).
--
-- ALTER, not CREATE OR REPLACE: the bodies do not change at all. Every name
-- they use is already schema-qualified (public.current_price,
-- public.shopping_list, public.profile, public.price_for) or lives in
-- pg_catalog (now()), which is always searched first, so an empty search_path
-- leaves their behaviour identical.
--
-- price_for is a scalar SQL function with ORDER BY/LIMIT, which Postgres never
-- inlines anyway, so pinning the setting costs list_totals nothing.

alter function public.set_updated_at()                set search_path = '';
alter function public.price_for(uuid, text)            set search_path = '';
alter function public.set_list_item_price()            set search_path = '';
alter function public.keep_list_item_price()           set search_path = '';
