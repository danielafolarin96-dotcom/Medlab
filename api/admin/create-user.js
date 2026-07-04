import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('MISSING ENV VARS. SUPABASE_URL set:', !!supabaseUrl, 'SUPABASE_SERVICE_ROLE_KEY set:', !!serviceRoleKey)
    return res.status(500).json({ error: 'Server misconfigured: missing Supabase service credentials' })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey)

  const { data: { user: caller }, error: callerErr } = await admin.auth.getUser(token)
  if (callerErr || !caller) {
    console.error('CALLER IDENTITY CHECK FAILED:', callerErr?.message)
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
  console.log('Caller identified:', caller.id, caller.email)

  const { data: callerProfile, error: profileErr } = await admin
    .from('profiles')
    .select('role, is_active')
    .eq('id', caller.id)
    .single()

  if (profileErr) {
    console.error('PROFILE LOOKUP FAILED:', profileErr.message, profileErr.code)
    return res.status(403).json({ error: 'Admin access required' })
  }
  if (!callerProfile) {
    console.error('NO PROFILE ROW FOUND for caller id:', caller.id)
    return res.status(403).json({ error: 'Admin access required' })
  }
  console.log('Caller profile:', callerProfile)

  if (callerProfile.role !== 'admin' || !callerProfile.is_active) {
    console.error('ROLE/ACTIVE CHECK FAILED. role:', callerProfile.role, 'is_active:', callerProfile.is_active)
    return res.status(403).json({ error: 'Admin access required' })
  }

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

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (createErr) {
    console.error('CREATE USER FAILED:', createErr.message)
    return res.status(400).json({ error: createErr.message })
  }

  const newUserId = created.user.id

  const { error: updateErr } = await admin
    .from('profiles')
    .update({ role, full_name: fullName, email })
    .eq('id', newUserId)

  if (updateErr) {
    console.error('PROFILE UPDATE FAILED:', updateErr.message)
    return res.status(500).json({ error: `Account created but profile update failed: ${updateErr.message}` })
  }

  await admin.from('audit_logs').insert({
    user_id: caller.id,
    action: `Created ${role} account for ${email}`,
    record_affected: newUserId,
  })

  return res.status(200).json({ id: newUserId, email, fullName, role })
}
