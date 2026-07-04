-- Run once in Supabase SQL Editor. Safe to re-run.

-- 1. Clinicians need to see which patient-role accounts exist, to link a
-- patient record to that patient's own login. Admins already see everyone;
-- this adds a narrow exception for clinicians to see ONLY role='patient'
-- rows, not other clinicians' or admins' profiles.
drop policy if exists profiles_select_own_or_admin on public.profiles;

create policy profiles_select_own_or_privileged on public.profiles
  for select using (
    id = auth.uid()
    or public.current_role() = 'admin'
    or (public.current_role() = 'clinician' and role = 'patient')
  );

-- 2. audit_logs was admin-only for every operation, which meant a
-- clinician's own actions (registering a patient, entering a result)
-- couldn't be logged at all. Split it: only admins can READ the log
-- (unchanged), but any staff member can WRITE an entry for their own action.
drop policy if exists audit_logs_admin_only on public.audit_logs;

create policy audit_logs_select_admin_only on public.audit_logs
  for select using (public.current_role() = 'admin');

create policy audit_logs_insert_staff on public.audit_logs
  for insert with check (public.current_role() in ('admin', 'clinician'));
