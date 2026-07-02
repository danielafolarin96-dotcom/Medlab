import { createClient } from '@supabase/supabase-js'

// Server-only env vars — deliberately NOT prefixed with VITE_ so Vite never
// bundles them into client-side JS. Set these in Vercel → Project Settings
// → Environment Variables, not in .env (which only feeds the frontend).
const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase service credentials' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  // 1. Identify the caller from their access token.
  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  // 2. Confirm the caller is an active admin. Using the service-role client
  // here deliberately bypasses RLS so we can check the role directly —
  // this is the ONE place that's allowed, because we've just verified
  // the caller's identity above.
  const { data: callerProfile, error: profileErr } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', caller.id)
    .single()

  if (profileErr || !callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
    return res.status(403).json({ error: 'Admin access required' })
  }

  // 3. Validate input.
  const { email, password, fullName, role } = req.body || {}
  if (!email || !password || !fullName || !role) {
    return res.status(400).json({ error: 'email, password, fullName, and role are required' })
  }
  if (!['clinician', 'patient'].includes(role)) {
    return res.status(400).json({ error: 'role must be "clinician" or "patient"' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  // 4. Create the auth user, pre-confirmed (admin-created accounts skip
  // email verification since the admin is vouching for them directly).
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createErr) {
    return res.status(400).json({ error: createErr.message })
  }

  const newUserId = created.user.id

  // 5. The DB trigger already inserted a default profile row (role
  // defaults to 'patient'). Update it to the role the admin actually chose.
  const { error: updateErr } = await admin
    .from('profiles')
    .update({ role, full_name: fullName, email })
    .eq('id', newUserId)

  if (updateErr) {
    return res.status(500).json({ error: `Account created but profile update failed: ${updateErr.message}` })
  }

  // 6. Audit trail.
  await admin.from('audit_logs').insert({
    user_id: caller.id,
    action: `Created ${role} account for ${email}`,
    record_affected: newUserId,
  })

  return res.status(200).json({ id: newUserId, email, fullName, role })
}
