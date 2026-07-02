import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { SkeletonDashboard } from '../../components/Skeleton'
import { supabase } from '../../lib/supabaseClient'

export default function ClinicianDashboard() {
  const [loading, setLoading] = useState(true)
  const [patientCount, setPatientCount] = useState(0)

  useEffect(() => {
    let mounted = true
    supabase
      .from('patients')
      .select('*', { count: 'exact', head: true })
      .then(({ count }) => {
        if (!mounted) return
        setPatientCount(count ?? 0)
        setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  return (
    <AppShell>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Overview</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Your registered patients and recent lab activity.
          </p>
        </div>
        <Link
          to="/clinician/results/new"
          className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors"
        >
          Enter result
        </Link>
      </header>

      {loading ? (
        <SkeletonDashboard />
      ) : patientCount === 0 ? (
        <EmptyState
          title="No patients registered yet"
          body="Register your first patient to begin entering lab results and tracking trends."
          actionLabel="Register a patient"
          actionTo="/clinician/patients"
        />
      ) : (
        <div className="bg-surface border border-line rounded-xl p-5 shadow-card">
          <p className="text-sm text-text-secondary">
            {patientCount} patient{patientCount === 1 ? '' : 's'} registered.
          </p>
        </div>
      )}
    </AppShell>
  )
}

function EmptyState({ title, body, actionLabel, actionTo }) {
  return (
    <div className="bg-surface border border-dashed border-line rounded-xl p-10 text-center">
      <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-secondary mb-4 max-w-sm mx-auto">{body}</p>
      <Link
        to={actionTo}
        className="inline-block px-4 py-2 rounded-lg bg-teal-light text-teal text-sm font-semibold hover:bg-teal hover:text-white transition-colors"
      >
        {actionLabel}
      </Link>
    </div>
  )
}
