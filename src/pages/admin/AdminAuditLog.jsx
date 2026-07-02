import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import { SkeletonListRow } from '../../components/Skeleton'
import { supabase } from '../../lib/supabaseClient'

export default function AdminAuditLog() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState([])

  useEffect(() => {
    let mounted = true
    supabase
      .from('audit_logs')
      .select('id, action, record_affected, timestamp, profiles(full_name)')
      .order('timestamp', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!mounted) return
        if (!error) setEntries(data ?? [])
        setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Audit log</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Every account and record change made through MedLab, most recent first.
        </p>
      </header>

      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-card">
        {loading ? (
          <>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </>
        ) : entries.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-secondary">
            No activity logged yet.
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="px-5 py-3.5 border-b border-line last:border-b-0">
              <p className="text-sm text-text-primary">{entry.action}</p>
              <p className="text-xs text-text-muted mt-0.5">
                {entry.profiles?.full_name ?? 'System'} ·{' '}
                {new Date(entry.timestamp).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
    </AppShell>
  )
}
