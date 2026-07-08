import { useEffect, useMemo, useState } from 'react'
import AppShell from '../../components/AppShell'
import StatusPill from '../../components/StatusPill'
import TrendChart from '../../components/TrendChart'
import { SkeletonChart } from '../../components/Skeleton'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { computeTrendsByAnalyte, groupByAnalyte } from '../../lib/trend'

export default function PatientTrends() {
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
        .select('id, analyte, value, unit, ref_low, ref_high, test_date')
        .eq('patient_id', patient.id)
        .order('test_date', { ascending: false })

      if (!mounted) return
      setResults(data ?? [])
      setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [user.id])

  const trends = useMemo(() => computeTrendsByAnalyte(results), [results])
  const chartGroups = useMemo(() => {
    const grouped = groupByAnalyte(results)
    return Object.entries(grouped).filter(([, rows]) => rows.length >= 2)
  }, [results])

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">My trends</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          How your results have changed over time. This is a statistical summary, not a
          diagnosis — always discuss changes with your clinician.
        </p>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SkeletonChart />
          <SkeletonChart />
        </div>
      ) : noPatientRecord ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-10 text-center">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Account not linked yet</h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto">
            Your login hasn't been connected to a patient record yet. Ask your
            clinician to link your account.
          </p>
        </div>
      ) : chartGroups.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-10 text-center">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Not enough results yet</h3>
          <p className="text-sm text-text-secondary max-w-sm mx-auto">
            Trends appear once you have at least two results for the same test.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {chartGroups.map(([analyte, rows]) => {
            const latest = [...rows].sort(
              (a, b) => new Date(b.test_date) - new Date(a.test_date)
            )[0]
            const trend = trends[analyte]
            return (
              <div key={analyte} className="bg-surface border border-line rounded-xl p-4 shadow-card">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-text-primary">{analyte}</p>
                  {trend && <StatusPill status={trend.label.toLowerCase()} label={trend.label} />}
                </div>
                <TrendChart
                  results={rows}
                  refLow={latest.ref_low}
                  refHigh={latest.ref_high}
                  unit={latest.unit}
                />
                <p className="text-xs text-text-muted mt-2">
                  Shaded band shows the normal range for this test.
                </p>
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
