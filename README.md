# MedLab — Setup Guide (Phase 0/1)

Medical test **result** management with Random Forest-supported abnormality
detection and statistical trend analysis. Decision-support only — does not
diagnose, treat, or replace a clinician.

## Architecture (zero-cost)

- **Frontend:** React + Vite → deployed on **Vercel** (free)
- **Auth + Database:** **Supabase** (free tier) — Postgres + Auth + Row Level Security
- **ML inference:** Python serverless function on **Vercel** (`/api/predict.py`, Phase 5) — no second host needed
- **Charts:** Recharts (bonus risk module: XGBoost, feature-flagged)

Everything lives in one Vercel project + one Supabase project. Total cost: $0.

---

## Step 1 — Create your Supabase project (5 min)

1. Go to supabase.com → sign up (GitHub login is fastest).
2. **New project** → name it `medlab` → pick any region close to you → set a
   database password (save it somewhere) → create.
3. Wait ~2 min for provisioning.
4. Left sidebar → **SQL Editor** → **New query** → paste the entire contents
   of `supabase/schema.sql` from this repo → **Run**. You should see
   "Success. No rows returned."
5. Left sidebar → **Authentication → Providers → Email** → turn **OFF**
   "Confirm email" (so accounts work immediately without email confirmation
   links — you'll re-enable proper email flows later if needed).
6. Left sidebar → **Project Settings → API** → copy:
   - **Project URL**
   - **anon public** key

## Step 2 — Create your first admin account (2 min)

1. Left sidebar → **Authentication → Users → Add user** → enter your own
   email + a password → toggle **Auto Confirm User** → create.
2. Back in **SQL Editor**, run (replace the email):
   ```sql
   update public.profiles set role = 'admin', full_name = 'Afolarin'
   where id = (select id from auth.users where email = 'YOUR-EMAIL-HERE');
   ```
3. You now have one working admin login.

## Step 3 — Run locally

```bash
npm install
cp .env.example .env
# paste your Project URL + anon key into .env
npm run dev
```

Open the local URL shown in the terminal, sign in with the admin account
from Step 2. You should land on the admin Overview page.

## Step 4 — Deploy to Vercel (5 min)

1. Push this project to a new GitHub repo (`git init && git add . && git commit -m "MedLab Phase 0/1" && git remote add origin <your-repo-url> && git push -u origin main`).
2. Go to vercel.com → sign up with GitHub → **Add New → Project** → import
   your `medlab` repo.
3. Framework preset: **Vite**. Leave build settings as detected.
4. **Environment Variables** → add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Deploy. Visit `https://your-project.vercel.app/api/health` — you should
   see a JSON `{"status": "ok", ...}` response confirming the Python
   runtime works, ready for the real Random Forest endpoint in Phase 5.

---

## What's built so far (Phase 0 + 1)

- Full project scaffold (Vite + React + Tailwind + Supabase client)
- Complete DB schema: `profiles`, `patients`, `lab_results`,
  `ml_prediction_logs`, `audit_logs` — matches the ERD in Chapter 3
- Row Level Security enforcing all 3 roles at the database layer (not just
  hidden in the UI — this is the real security boundary)
- Working login, role-based redirect, protected routes
- Admin dashboard shell with live counts
- Clinician + Patient dashboard shells with skeleton loaders + empty states
- Design system: clinical, calm palette, tabular numerals for lab values,
  reusable skeleton components matching each content shape (no generic
  spinners anywhere)

## What's next

- Phase 2: creating clinician/patient accounts from the Admin UI (needs a
  secure server-side endpoint using the Supabase **service role** key —
  never exposed to the browser)
- Phase 3: patient registration/profile CRUD
- Phase 4: lab result entry + reference-range comparison + rule-based flag
- Phase 5: Random Forest abnormality detection (`/api/predict.py`)
- Phase 6/7: trend analysis + charts
