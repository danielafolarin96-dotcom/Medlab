-- Run once in Supabase SQL Editor. Safe to re-run.

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

grant select on public.reference_ranges to authenticated;

alter table public.reference_ranges enable row level security;

drop policy if exists reference_ranges_read_all on public.reference_ranges;
create policy reference_ranges_read_all on public.reference_ranges
  for select using (true);

-- Standard adult reference ranges for the analytes named in Chapter 3
-- (haemoglobin, WBC, glucose, creatinine, hepatic enzymes) plus platelets
-- for a complete basic panel. Academic/demo values, not a clinical source.
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
