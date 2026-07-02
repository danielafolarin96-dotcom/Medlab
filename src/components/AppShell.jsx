import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_BY_ROLE = {
  admin: [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/users', label: 'User accounts' },
    { to: '/admin/audit', label: 'Audit log' },
  ],
  clinician: [
    { to: '/clinician', label: 'Overview', end: true },
    { to: '/clinician/patients', label: 'Patients' },
    { to: '/clinician/results/new', label: 'Enter result' },
  ],
  patient: [
    { to: '/patient', label: 'My results', end: true },
    { to: '/patient/trends', label: 'Trends' },
  ],
}

export default function AppShell({ children }) {
  const { profile, role, signOut } = useAuth()
  const navItems = NAV_BY_ROLE[role] ?? []

  return (
    <div className="min-h-screen flex bg-canvas">
      <aside className="w-60 shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="px-5 py-6">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-ink flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="font-semibold text-ink tracking-tight">MedLab</span>
          </div>
          <p className="text-xs text-text-muted mt-1 capitalize">{role} workspace</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-light text-teal'
                    : 'text-text-secondary hover:bg-canvas hover:text-text-primary'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 pb-4 pt-3 border-t border-line">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-text-primary truncate">
              {profile?.full_name ?? 'Loading…'}
            </p>
            <p className="text-xs text-text-muted capitalize">{role}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:bg-canvas hover:text-crimson transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
