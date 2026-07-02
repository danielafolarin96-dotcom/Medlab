-- Run once in Supabase SQL Editor. Safe to re-run.

alter table public.profiles add column if not exists email text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email);
  return new;
end;
$$;

-- Backfill email for the two accounts you already created
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;
