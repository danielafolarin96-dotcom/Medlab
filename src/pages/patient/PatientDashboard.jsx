import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import { SkeletonTable } from '../../components/Skeleton'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

export default function PatientDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState([])

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('linked_user_id', user.id)
        .maybeSingle()

      if (!patient) {
        if (mounted) setLoading(false)
        return
      }

      const { data } = await supabase
        .from('lab_results')
        .select('id, analyte, value, unit, ref_low, ref_high, is_abnormal, test_date')
        .eq('patient_id', patient.id)
        .order('test_date', { ascending: false })

      if (!mounted) return
      setResults(data ?? [])
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [user.id])

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">My results</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          These results are for your information only and are not a diagnosis.
          Always discuss them with your clinician.
        </p>
      </header>

      {loading ? (
        <SkeletonTable rows={4} />
      ) : results.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-10 text-center">
          <h3 className="text-sm font-semibold text-text-primary mb-1">No results yet</h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto">
            Your test results will appear here once your clinician enters them.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-card">
          {results.map((r) => (
            <div key={r.id} className="px-5 py-4 border-b border-line last:border-b-0">
              {r.analyte} — {r.value} {r.unit}
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}
