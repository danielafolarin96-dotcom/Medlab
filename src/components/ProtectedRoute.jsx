import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FullScreenLoader from './FullScreenLoader'

/**
 * Wrap a route element with this to require login and (optionally) a specific role.
 * Frontend gating is a UX convenience only — Supabase Row Level Security is the
 * real access boundary, enforced server-side regardless of what the UI does.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { session, role, isActive, loading } = useAuth()

  if (loading) return <FullScreenLoader />

  if (!session) return <Navigate to="/login" replace />

  if (!isActive) {
    return <Navigate to="/login" replace state={{ deactivated: true }} />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/login" replace />
  }

  return children
}
