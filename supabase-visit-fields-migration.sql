-- Apply once to an existing Supabase project before using the expanded register.
alter table public.customer_visits add column if not exists venue_name text;
alter table public.customer_visits add column if not exists hall_number text;
alter table public.customer_visits add column if not exists event_timing text;

do $$ begin
  alter table public.customer_visits
    add constraint customer_visits_event_timing_check
    check (event_timing is null or event_timing in ('Morning', 'Evening'));
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';