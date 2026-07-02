import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import { SkeletonDashboard } from '../../components/Skeleton'
import { supabase } from '../../lib/supabaseClient'

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ clinicians: 0, patients: 0, results: 0 })

  useEffect(() => {
    let mounted = true
    async function load() {
      const [{ count: clinicians }, { count: patients }, { count: results }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'clinician'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'patient'),
        supabase.from('lab_results').select('*', { count: 'exact', head: true }),
      ])
      if (!mounted) return
      setStats({ clinicians: clinicians ?? 0, patients: patients ?? 0, results: results ?? 0 })
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Overview</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          System-wide account and activity summary. No clinical result data is shown here.
        </p>
      </header>

      {loading ? (
        <SkeletonDashboard />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Clinicians" value={stats.clinicians} />
          <StatCard label="Patients" value={stats.patients} />
          <StatCard label="Results logged" value={stats.results} />
        </div>
      )}
    </AppShell>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-5 shadow-card">
      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">{label}</p>
      <p className="text-2xl font-semibold text-text-primary tabular">{value}</p>
    </div>
  )
}
