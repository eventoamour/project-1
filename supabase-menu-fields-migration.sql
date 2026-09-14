-- Run once in Supabase SQL Editor. Adds optional fields; preserves rows and RLS.
begin;
alter table public.customer_visits
  add column if not exists menu_package text check (menu_package is null or menu_package in ('Chicken one dish', 'Mutton one dish')),
  add column if not exists menu_extras text[] not null default '{}',
  add column if not exists other_extras text check (other_extras is null or char_length(other_extras) <= 500),
  add column if not exists quoted_rate numeric(12,2) check (quoted_rate is null or quoted_rate >= 0),
  add column if not exists rate_basis text not null default 'per_guest' check (rate_basis in ('per_guest', 'total_event'));
notify pgrst, 'reload schema';
commit;
