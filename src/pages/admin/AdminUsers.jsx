import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import StatusPill from '../../components/StatusPill'
import { SkeletonListRow } from '../../components/Skeleton'
import { supabase } from '../../lib/supabaseClient'
import { generateTempPassword } from '../../lib/generatePassword'

export default function AdminUsers() {
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [createdCredentials, setCreatedCredentials] = useState(null)

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, is_active, created_at')
      .order('created_at', { ascending: false })
    if (!error) setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function toggleActive(user) {
    // Optimistic update so the UI feels instant, roll back on failure.
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
    )
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)

    if (error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_active: user.is_active } : u))
      )
      alert(`Couldn't update account: ${error.message}`)
    }
  }

  return (
    <AppShell>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">User accounts</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Create clinician and patient accounts, and deactivate access when needed.
          </p>
        </div>
        <button
          onClick={() => {
            setCreatedCredentials(null)
            setShowForm((v) => !v)
          }}
          className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors shrink-0"
        >
          {showForm ? 'Close' : 'Add user'}
        </button>
      </header>

      {showForm && (
        <CreateUserForm
          onCreated={(creds) => {
            setCreatedCredentials(creds)
            setShowForm(false)
            loadUsers()
          }}
        />
      )}

      {createdCredentials && (
        <CredentialsCallout creds={createdCredentials} onDismiss={() => setCreatedCredentials(null)} />
      )}

      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-card mt-6">
        <div className="grid grid-cols-[1.4fr_1.4fr_0.7fr_0.7fr_0.8fr] gap-4 px-5 py-3 border-b border-line bg-canvas text-xs font-semibold text-text-muted uppercase tracking-wide">
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Status</span>
          <span></span>
        </div>

        {loading ? (
          <>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </>
        ) : users.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-secondary">
            No accounts yet.
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              className="grid grid-cols-[1.4fr_1.4fr_0.7fr_0.7fr_0.8fr] items-center gap-4 px-5 py-3.5 border-b border-line last:border-b-0 text-sm"
            >
              <span className="text-text-primary font-medium truncate">{u.full_name || '—'}</span>
              <span className="text-text-secondary truncate">{u.email || '—'}</span>
              <span className="capitalize text-text-secondary">{u.role}</span>
              <StatusPill
                status={u.is_active ? 'normal' : 'abnormal'}
                label={u.is_active ? 'Active' : 'Inactive'}
              />
              {u.role === 'admin' ? (
                <span className="text-xs text-text-muted">—</span>
              ) : (
                <button
                  onClick={() => toggleActive(u)}
                  className="text-xs font-semibold text-teal hover:underline text-left"
                >
                  {u.is_active ? 'Deactivate' : 'Reactivate'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </AppShell>
  )
}

function CreateUserForm({ onCreated }) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generateTempPassword())
  const [role, setRole] = useState('clinician')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setError('Your session expired — sign in again.')
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, password, fullName, role }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error || 'Something went wrong creating the account.')
        setSubmitting(false)
        return
      }
      onCreated({ email, password, fullName, role })
    } catch {
      setError('Could not reach the server. If you are running "npm run dev" locally, this endpoint only works under "vercel dev" or on the deployed site — see the Phase 2 setup notes.')
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-line rounded-xl p-5 shadow-card mb-2 space-y-4"
    >
      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-crimson-light text-crimson text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full name">
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm"
            placeholder="e.g. Dr. Ngozi Eze"
          />
        </Field>
        <Field label="Email">
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm"
            placeholder="name@hospital.edu.ng"
          />
        </Field>
        <Field label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm"
          >
            <option value="clinician">Clinician</option>
            <option value="patient">Patient</option>
          </select>
        </Field>
        <Field label="Temporary password">
          <div className="flex gap-2">
            <input
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm tabular"
            />
            <button
              type="button"
              onClick={() => setPassword(generateTempPassword())}
              className="px-3 py-2 rounded-lg border border-line text-xs font-semibold text-text-secondary hover:bg-canvas shrink-0"
            >
              Regenerate
            </button>
          </div>
        </Field>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-60"
      >
        {submitting ? 'Creating…' : 'Create account'}
      </button>
    </form>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text-primary mb-1.5">{label}</span>
      {children}
    </label>
  )
}

function CredentialsCallout({ creds, onDismiss }) {
  return (
    <div className="bg-teal-light border border-teal/30 rounded-xl p-5 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-teal mb-1">
            {creds.fullName}'s account is ready
          </h3>
          <p className="text-sm text-text-secondary mb-3">
            Share these credentials with them securely (in person or a private
            message). This password will not be shown again after you leave this page.
          </p>
          <div className="bg-surface rounded-lg border border-line px-4 py-3 text-sm space-y-1 tabular">
            <p><span className="text-text-muted">Email:</span> {creds.email}</p>
            <p><span className="text-text-muted">Password:</span> {creds.password}</p>
            <p className="capitalize"><span className="text-text-muted">Role:</span> {creds.role}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-xs font-semibold text-teal hover:underline shrink-0"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
