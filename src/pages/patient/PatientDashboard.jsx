import { useEffect, useState } from 'react'
import AppShell from '../../components/AppShell'
import StatusPill from '../../components/StatusPill'
import { SkeletonTable } from '../../components/Skeleton'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

export default function PatientDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState([])
  const [noPatientRecord, setNoPatientRecord] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('linked_user_id', user.id)
        .maybeSingle()

      if (!patient) {
        if (mounted) {
          setNoPatientRecord(true)
          setLoading(false)
        }
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
      ) : noPatientRecord ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-10 text-center">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Account not linked yet</h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto">
            Your login hasn't been connected to a patient record yet. Ask your
            clinician to link your account.
          </p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-10 text-center">
          <h3 className="text-sm font-semibold text-text-primary mb-1">No results yet</h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto">
            Your test results will appear here once your clinician enters them.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-card">
          <div className="grid grid-cols-[1.3fr_1fr_1.2fr_0.8fr_0.9fr] gap-4 px-5 py-3 border-b border-line bg-canvas text-xs font-semibold text-text-muted uppercase tracking-wide">
            <span>Analyte</span>
            <span>Value</span>
            <span>Normal range</span>
            <span>Flag</span>
            <span>Date</span>
          </div>
          {results.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1.3fr_1fr_1.2fr_0.8fr_0.9fr] items-center gap-4 px-5 py-3.5 border-b border-line last:border-b-0 text-sm"
            >
              <span className="text-text-primary font-medium truncate">{r.analyte}</span>
              <span className="text-text-secondary tabular">{r.value} {r.unit}</span>
              <span className="text-text-muted tabular">{r.ref_low}–{r.ref_high} {r.unit}</span>
              <StatusPill
                status={r.is_abnormal ? 'abnormal' : 'normal'}
                label={r.is_abnormal ? 'Abnormal' : 'Normal'}
              />
              <span className="text-text-secondary tabular">{r.test_date}</span>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  )
}
