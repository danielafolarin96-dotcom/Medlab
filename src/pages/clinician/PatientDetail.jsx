import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusPill from '../../components/StatusPill'
import TrendChart from '../../components/TrendChart'
import { SkeletonLine, SkeletonTable } from '../../components/Skeleton'
import { supabase } from '../../lib/supabaseClient'
import { computeTrendsByAnalyte, groupByAnalyte } from '../../lib/trend'

export default function PatientDetail() {
  const { patientId } = useParams()
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState(null)
  const [results, setResults] = useState([])
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let mounted = true
    Promise.all([
      supabase.from('patients').select('*').eq('id', patientId).maybeSingle(),
      supabase
        .from('lab_results')
        .select('id, analyte, value, unit, ref_low, ref_high, is_abnormal, ml_probability, test_date')
        .eq('patient_id', patientId)
        .order('test_date', { ascending: false }),
    ]).then(([{ data: p, error }, { data: r }]) => {
      if (!mounted) return
      if (error || !p) setNotFound(true)
      else setPatient(p)
      setResults(r ?? [])
      setLoading(false)
    })
    return () => { mounted = false }
  }, [patientId])

  const trends = useMemo(() => computeTrendsByAnalyte(results), [results])
  const chartGroups = useMemo(() => {
    const grouped = groupByAnalyte(results)
    // Only worth charting with at least 2 points on a line.
    return Object.entries(grouped).filter(([, rows]) => rows.length >= 2)
  }, [results])

  return (
    <AppShell>
      <div className="mb-6">
        <Link to="/clinician/patients" className="text-sm text-teal font-medium hover:underline">
          ← All patients
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          <SkeletonLine width={220} height={22} />
          <SkeletonLine width={160} height={14} />
          <div className="mt-4"><SkeletonTable rows={3} /></div>
        </div>
      ) : notFound ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-10 text-center">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Patient not found</h3>
          <p className="text-sm text-text-secondary">
            This record may have been removed, or the link is incorrect.
          </p>
        </div>
      ) : (
        <>
          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-text-primary">{patient.full_name}</h1>
              <p className="text-sm text-text-secondary mt-0.5 tabular">
                {patient.medical_number}
                {patient.date_of_birth && <> · DOB {patient.date_of_birth}</>}
                {patient.gender && <> · {patient.gender}</>}
              </p>
            </div>
            <Link
              to={`/clinician/results/new?patient=${patient.id}`}
              className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors shrink-0"
            >
              Log result
            </Link>
          </header>

          <div className="bg-surface border border-line rounded-xl p-5 shadow-card mb-6">
            <p className="text-sm text-text-secondary">
              Portal access:{' '}
              <span className={patient.linked_user_id ? 'text-teal font-medium' : 'text-text-muted'}>
                {patient.linked_user_id ? 'Linked to a patient login' : 'Not linked yet'}
              </span>
            </p>
          </div>

          {Object.keys(trends).length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Trends</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {Object.entries(trends).map(([analyte, t]) => (
                  <div key={analyte} className="bg-surface border border-line rounded-xl p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-medium text-text-primary">{analyte}</p>
                      <StatusPill status={t.label.toLowerCase()} label={t.label} />
                    </div>
                    <p className="text-xs text-text-muted tabular">
                      Distance from normal range moved {t.percentChange >= 0 ? '+' : ''}
                      {t.percentChange.toFixed(0)} points over last {t.pointsUsed} tests
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-text-muted mt-2">
                Statistical trend, not machine learning — based on percentage change, moving
                average, and slope of each result's distance from the normal range over time.
              </p>
            </div>
          )}

          {chartGroups.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-3">Charts</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {chartGroups.map(([analyte, rows]) => {
                  const latest = [...rows].sort(
                    (a, b) => new Date(b.test_date) - new Date(a.test_date)
                  )[0]
                  return (
                    <div key={analyte} className="bg-surface border border-line rounded-xl p-4 shadow-card">
                      <p className="text-sm font-medium text-text-primary mb-2">{analyte}</p>
                      <TrendChart
                        results={rows}
                        refLow={latest.ref_low}
                        refHigh={latest.ref_high}
                        unit={latest.unit}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-card">
            <div className="grid grid-cols-[1.2fr_0.9fr_1.1fr_0.8fr_0.9fr_0.9fr] gap-4 px-5 py-3 border-b border-line bg-canvas text-xs font-semibold text-text-muted uppercase tracking-wide">
              <span>Analyte</span>
              <span>Value</span>
              <span>Normal range</span>
              <span>Flag</span>
              <span>RF probability</span>
              <span>Date</span>
            </div>

            {results.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-text-secondary">
                No results logged yet for this patient.
              </div>
            ) : (
              results.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-[1.2fr_0.9fr_1.1fr_0.8fr_0.9fr_0.9fr] items-center gap-4 px-5 py-3.5 border-b border-line last:border-b-0 text-sm"
                >
                  <span className="text-text-primary font-medium truncate">{r.analyte}</span>
                  <span className="text-text-secondary tabular">{r.value} {r.unit}</span>
                  <span className="text-text-muted tabular">{r.ref_low}–{r.ref_high} {r.unit}</span>
                  <StatusPill
                    status={r.is_abnormal ? 'abnormal' : 'normal'}
                    label={r.is_abnormal ? 'Abnormal' : 'Normal'}
                  />
                  <span className="text-text-secondary tabular">
                    {r.ml_probability !== null && r.ml_probability !== undefined
                      ? `${Math.round(r.ml_probability * 100)}%`
                      : '—'}
                  </span>
                  <span className="text-text-secondary tabular">{r.test_date}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </AppShell>
  )
}

