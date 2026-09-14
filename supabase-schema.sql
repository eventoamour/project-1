-- Empire Group staff and walk-in customer schema
-- Fresh-project setup only. Do not run this as a migration on an existing database.
-- Column names match the deployed table verified on 2026-09-14.
create extension if not exists pgcrypto;

do $$ begin
  create type public.staff_role as enum ('admin', 'manager');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role public.staff_role not null default 'manager',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customer_visits (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(trim(customer_name)) between 1 and 120),
  phone text not null check (char_length(trim(phone)) between 3 and 40),
  guests integer not null check (guests > 0),
  visit_date date not null default current_date,
  manager_name text not null,
  event_type text check (event_type is null or event_type in ('Wedding','Walima','Mehndi','Nikkah','Engagement','Birthday','Corporate Event','Other')),
  venue_name text,
  hall_number text,
  event_timing text check (event_timing is null or event_timing in ('Morning','Evening')),
  menu_package text check (menu_package is null or menu_package in ('Chicken one dish', 'Mutton one dish')),
  menu_extras text[] not null default '{}',
  other_extras text check (other_extras is null or char_length(other_extras) <= 500),
  quoted_rate numeric(12,2) check (quoted_rate is null or quoted_rate >= 0),
  rate_basis text not null default 'per_guest' check (rate_basis in ('per_guest', 'total_event')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists customer_visits_visit_date_idx on public.customer_visits (visit_date desc);
create index if not exists customer_visits_created_by_idx on public.customer_visits (created_by);
create index if not exists customer_visits_event_type_idx on public.customer_visits (event_type);
create index if not exists customer_visits_customer_name_idx on public.customer_visits (lower(customer_name));
create index if not exists customer_visits_phone_idx on public.customer_visits (phone);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'manager')); $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;

create or replace function public.current_staff_name()
returns text language sql stable security definer set search_path = public
as $$ select full_name from public.profiles where id = auth.uid() and role in ('admin', 'manager'); $$;

create or replace function public.set_customer_visit_metadata()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Only authorized staff can manage customer visits';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    -- Preserve compatibility with older clients that omit the manager field.
    new.manager_name := coalesce(nullif(trim(new.manager_name), ''), public.current_staff_name());
  else
    new.created_by := old.created_by;
    new.manager_name := nullif(trim(new.manager_name), '');
  end if;
  if new.manager_name is null or char_length(new.manager_name) > 120 then
    raise exception 'Enter a manager name between 1 and 120 characters';
  end if;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists customer_visits_metadata on public.customer_visits;
create trigger customer_visits_metadata before insert or update on public.customer_visits for each row execute function public.set_customer_visit_metadata();

alter table public.profiles enable row level security;
alter table public.customer_visits enable row level security;

drop policy if exists profiles_read_own_or_admin on public.profiles;
create policy profiles_read_own_or_admin on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists profiles_admin_insert on public.profiles;
create policy profiles_admin_insert on public.profiles for insert to authenticated with check (public.is_admin());
drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.is_admin());

drop policy if exists customer_visits_staff_read on public.customer_visits;
create policy customer_visits_staff_read on public.customer_visits for select to authenticated using (public.is_staff());
drop policy if exists customer_visits_staff_insert on public.customer_visits;
create policy customer_visits_staff_insert on public.customer_visits for insert to authenticated with check (public.is_staff() and created_by = auth.uid());
drop policy if exists customer_visits_staff_update on public.customer_visits;
create policy customer_visits_staff_update on public.customer_visits for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists customer_visits_admin_delete on public.customer_visits;
create policy customer_visits_admin_delete on public.customer_visits for delete to authenticated using (public.is_admin());

-- Authenticated users cannot create their own profile or alter their own role.
-- Add profiles after creating Auth users, using the SQL Editor as an owner/admin.
