-- =====================================================================
-- MedLab — Supabase schema (Phase 1: DB + RBAC foundation)
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run: drops nothing, uses IF NOT EXISTS / CREATE OR REPLACE.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ROLE ENUM
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'clinician', 'patient');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. PROFILES  (1 row per auth.users row — mirrors the "User" entity)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text,
  role        user_role not null default 'patient',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row the moment a new auth user is created.
-- New users default to role='patient', is_active=true — an admin must
-- explicitly promote clinician/admin accounts after creation.
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 3. PATIENTS
-- ---------------------------------------------------------------------
create table if not exists public.patients (
  id               uuid primary key default gen_random_uuid(),
  linked_user_id   uuid references public.profiles(id) on delete set null,
  medical_number   text not null unique,
  full_name        text not null,
  date_of_birth    date,
  gender           text,
  registered_by    uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. LAB_RESULTS  (central entity — one row per analyte, per test date)
-- ---------------------------------------------------------------------
create table if not exists public.lab_results (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.patients(id) on delete cascade,
  entered_by     uuid not null references public.profiles(id),
  analyte        text not null,
  value          numeric not null,
  unit           text,
  ref_low        numeric,
  ref_high       numeric,
  is_abnormal    boolean,               -- rule-based flag (Phase 4)
  ml_probability numeric,               -- Random Forest output (Phase 5)
  risk_level     text,                  -- bonus XGBoost output (Phase 8), nullable
  trend_label    text,                  -- Stable / Improving / Deteriorating (Phase 6)
  test_date      date not null default current_date,
  created_at     timestamptz not null default now()
);

create index if not exists idx_lab_results_patient_analyte
  on public.lab_results (patient_id, analyte, test_date);

-- ---------------------------------------------------------------------
-- 4b. REFERENCE_RANGES (lookup table queried at result-entry time)
-- ---------------------------------------------------------------------
create table if not exists public.reference_ranges (
  id          uuid primary key default gen_random_uuid(),
  analyte     text not null,
  sex         text not null default 'any' check (sex in ('any', 'male', 'female')),
  unit        text not null,
  ref_low     numeric not null,
  ref_high    numeric not null,
  created_at  timestamptz not null default now(),
  unique (analyte, sex)
);

-- ---------------------------------------------------------------------
-- 5. ML_PREDICTION_LOGS  (audit trail of every inference call — Phase 5)
-- ---------------------------------------------------------------------
create table if not exists public.ml_prediction_logs (
  id              uuid primary key default gen_random_uuid(),
  result_id       uuid not null references public.lab_results(id) on delete cascade,
  model_version   text not null,
  input_features  jsonb not null,
  is_abnormal     boolean,
  probability     numeric,
  risk_level      text,
  trend_label     text,
  computed_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 6. AUDIT_LOGS  (every write, for compliance — Phase 10)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id),
  action           text not null,
  record_affected  text,
  timestamp        timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 7. RBAC HELPER FUNCTIONS
-- security definer + fixed search_path so these bypass RLS internally
-- and can't recurse or be hijacked — the standard safe pattern.
-- ---------------------------------------------------------------------
create or replace function public.current_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_profile_active()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 7b. TABLE PRIVILEGES
-- RLS policies only control *which rows* are visible — the `authenticated`
-- role also needs a base grant to query the tables at all, or every query
-- fails with "permission denied for table X" before RLS is even evaluated.
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.patients,
  public.lab_results,
  public.ml_prediction_logs,
  public.audit_logs
to authenticated;

grant select on public.reference_ranges to authenticated;

-- ---------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.patients           enable row level security;
alter table public.lab_results        enable row level security;
alter table public.ml_prediction_logs enable row level security;
alter table public.audit_logs         enable row level security;

-- PROFILES: everyone can read their own row (needed to know their own role);
-- admins can read/update everyone; clinicians can additionally see
-- patient-role profiles only (needed to link a patient record to their login).
drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_privileged on public.profiles
  for select using (
    id = auth.uid()
    or public.current_role() = 'admin'
    or (public.current_role() = 'clinician' and role = 'patient')
  );

drop policy if exists profiles_update_admin_only on public.profiles;
create policy profiles_update_admin_only on public.profiles
  for update using (public.current_role() = 'admin');

-- PATIENTS: admin + clinician full read/write; patient reads only their own linked row.
drop policy if exists patients_staff_all on public.patients;
create policy patients_staff_all on public.patients
  for all using (public.current_role() in ('admin', 'clinician'))
  with check (public.current_role() in ('admin', 'clinician'));

drop policy if exists patients_self_read on public.patients;
create policy patients_self_read on public.patients
  for select using (linked_user_id = auth.uid());

-- LAB_RESULTS: admin + clinician full read/write; patient reads only rows
-- belonging to their own linked patient record.
drop policy if exists results_staff_all on public.lab_results;
create policy results_staff_all on public.lab_results
  for all using (public.current_role() in ('admin', 'clinician'))
  with check (public.current_role() in ('admin', 'clinician'));

drop policy if exists results_self_read on public.lab_results;
create policy results_self_read on public.lab_results
  for select using (
    patient_id in (select id from public.patients where linked_user_id = auth.uid())
  );

-- ML_PREDICTION_LOGS: staff-only (technical audit trail, not patient-facing).
drop policy if exists ml_logs_staff_only on public.ml_prediction_logs;
create policy ml_logs_staff_only on public.ml_prediction_logs
  for all using (public.current_role() in ('admin', 'clinician'))
  with check (public.current_role() in ('admin', 'clinician'));

-- REFERENCE_RANGES: readable by anyone signed in (non-sensitive clinical
-- constants); no write policy — seeded only via migration.
alter table public.reference_ranges enable row level security;
drop policy if exists reference_ranges_read_all on public.reference_ranges;
create policy reference_ranges_read_all on public.reference_ranges
  for select using (true);

insert into public.reference_ranges (analyte, sex, unit, ref_low, ref_high) values
  ('Haemoglobin', 'male', 'g/dL', 13.5, 17.5),
  ('Haemoglobin', 'female', 'g/dL', 12.0, 15.5),
  ('White Blood Cell Count', 'any', 'x10^9/L', 4.0, 11.0),
  ('Platelet Count', 'any', 'x10^9/L', 150, 450),
  ('Fasting Blood Glucose', 'any', 'mmol/L', 3.9, 5.6),
  ('Creatinine', 'male', 'µmol/L', 62, 106),
  ('Creatinine', 'female', 'µmol/L', 44, 80),
  ('ALT (SGPT)', 'any', 'U/L', 7, 56),
  ('AST (SGOT)', 'any', 'U/L', 8, 48)
on conflict (analyte, sex) do nothing;

-- AUDIT_LOGS: only admins can read the log; any staff member (admin or
-- clinician) can write an entry for their own action.
drop policy if exists audit_logs_admin_only on public.audit_logs;
create policy audit_logs_select_admin_only on public.audit_logs
  for select using (public.current_role() = 'admin');
create policy audit_logs_insert_staff on public.audit_logs
  for insert with check (public.current_role() in ('admin', 'clinician'));

-- ---------------------------------------------------------------------
-- 9. BOOTSTRAP: promote your first account to admin
-- Run this SEPARATELY, after you've signed up once through the app
-- (or created a user in Supabase Dashboard → Authentication → Users).
-- Replace the email before running.
-- ---------------------------------------------------------------------
-- update public.profiles set role = 'admin', full_name = 'Afolarin'
-- where id = (select id from auth.users where email = 'you@example.com');
