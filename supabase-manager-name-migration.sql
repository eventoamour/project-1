-- Allow authorized staff to set the enquiry's manager name.
-- Run in Supabase SQL Editor. No rows are deleted; creator IDs and RLS are preserved.
begin;
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
commit;
