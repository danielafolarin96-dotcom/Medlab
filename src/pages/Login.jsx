import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const HOME_BY_ROLE = { admin: '/admin', clinician: '/clinician', patient: '/patient' }

export default function Login() {
  const { session, role, loading, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const deactivated = location.state?.deactivated

  useEffect(() => {
    setError('')
  }, [email, password])

  if (!loading && session && role && HOME_BY_ROLE[role]) {
    return <Navigate to={HOME_BY_ROLE[role]} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      console.error('Sign-in error:', error.status, error.message)
      setError(
        error.message === 'Email not confirmed'
          ? 'This account has not been confirmed yet. Ask your administrator to confirm it.'
          : 'Incorrect email or password. Check your details and try again.'
      )
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="h-8 w-8 rounded-md bg-ink flex items-center justify-center">
            <span className="text-white text-sm font-bold">M</span>
          </div>
          <span className="font-semibold text-ink text-lg tracking-tight">MedLab</span>
        </div>

        <div className="bg-surface border border-line rounded-2xl shadow-card p-7">
          <h1 className="text-lg font-semibold text-text-primary mb-1">Sign in</h1>
          <p className="text-sm text-text-secondary mb-6">
            Use the account your administrator created for you.
          </p>

          {deactivated && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-amber-light text-amber text-sm">
              This account has been deactivated. Contact your administrator.
            </div>
          )}

          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-lg bg-crimson-light text-crimson text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-canvas text-sm focus:bg-surface transition-colors"
                placeholder="you@hospital.edu.ng"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-line bg-canvas text-sm focus:bg-surface transition-colors"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          MedLab is a decision-support tool. It does not diagnose, treat, or replace
          a licensed clinician.
        </p>
      </div>
    </div>
  )
}
