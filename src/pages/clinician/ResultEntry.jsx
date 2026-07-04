import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import StatusPill from '../../components/StatusPill'
import { SkeletonLine } from '../../components/Skeleton'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

export default function ResultEntry() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const presetPatientId = searchParams.get('patient') ?? ''

  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState([])
  const [ranges, setRanges] = useState([]) // all reference_ranges rows

  const [patientId, setPatientId] = useState(presetPatientId)
  const [analyte, setAnalyte] = useState('')
  const [value, setValue] = useState('')
  const [testDate, setTestDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // { isAbnormal, refLow, refHigh, unit, analyte, value }

  useEffect(() => {
    let mounted = true
    Promise.all([
      supabase.from('patients').select('id, full_name, medical_number, gender').order('full_name'),
      supabase.from('reference_ranges').select('*'),
    ]).then(([{ data: p }, { data: r }]) => {
      if (!mounted) return
      setPatients(p ?? [])
      setRanges(r ?? [])
      setLoading(false)
    })
    return () => { mounted = false }
  }, [])

  const analyteNames = useMemo(
    () => [...new Set(ranges.map((r) => r.analyte))].sort(),
    [ranges]
  )

  const selectedPatient = patients.find((p) => p.id === patientId)

  const matchedRange = useMemo(() => {
    if (!analyte) return null
    const candidates = ranges.filter((r) => r.analyte === analyte)
    const gender = selectedPatient?.gender
    const order =
      gender === 'Male' ? ['male', 'any', 'female'] :
      gender === 'Female' ? ['female', 'any', 'male'] :
      ['any', 'female', 'male']
    for (const sex of order) {
      const match = candidates.find((c) => c.sex === sex)
      if (match) return match
    }
    return candidates[0] ?? null
  }, [analyte, ranges, selectedPatient])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!patientId) return setError('Select a patient.')
    if (!analyte) return setError('Select an analyte.')
    if (value === '' || Number.isNaN(Number(value))) return setError('Enter a numeric value.')
    if (!matchedRange) return setError('No reference range found for this analyte.')

    setSubmitting(true)
    const numericValue = Number(value)
    const isAbnormal = numericValue < matchedRange.ref_low || numericValue > matchedRange.ref_high

    const { error: insertErr } = await supabase.from('lab_results').insert({
      patient_id: patientId,
      entered_by: user.id,
      analyte,
      value: numericValue,
      unit: matchedRange.unit,
      ref_low: matchedRange.ref_low,
      ref_high: matchedRange.ref_high,
      is_abnormal: isAbnormal,
      test_date: testDate,
    })

    if (insertErr) {
      setError(insertErr.message)
      setSubmitting(false)
      return
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: `Logged ${analyte} result for ${selectedPatient?.full_name ?? 'patient'}`,
      record_affected: patientId,
    })

    setResult({
      isAbnormal,
      refLow: matchedRange.ref_low,
      refHigh: matchedRange.ref_high,
      unit: matchedRange.unit,
      analyte,
      value: numericValue,
    })
    setAnalyte('')
    setValue('')
    setSubmitting(false)
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link to="/clinician/patients" className="text-sm text-teal font-medium hover:underline">
          ← All patients
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Enter lab result</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          The normal/abnormal flag is calculated instantly from the reference range below —
          this is a rule-based check, separate from the Random Forest model.
        </p>
      </header>

      {loading ? (
        <div className="bg-surface border border-line rounded-xl p-5 shadow-card space-y-4">
          <SkeletonLine width="100%" height={40} />
          <SkeletonLine width="100%" height={40} />
          <SkeletonLine width="40%" height={40} />
        </div>
      ) : patients.length === 0 ? (
        <div className="bg-surface border border-dashed border-line rounded-xl p-10 text-center">
          <h3 className="text-sm font-semibold text-text-primary mb-1">No patients registered yet</h3>
          <p className="text-sm text-text-secondary mb-4">
            Register a patient first before logging a result.
          </p>
          <Link
            to="/clinician/patients"
            className="inline-block px-4 py-2 rounded-lg bg-teal-light text-teal text-sm font-semibold hover:bg-teal hover:text-white transition-colors"
          >
            Register a patient
          </Link>
        </div>
      ) : (
        <>
          {result && (
            <div className="bg-surface border border-line rounded-xl p-5 shadow-card mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-text-primary mb-1">
                  {result.analyte}: <span className="tabular">{result.value} {result.unit}</span>
                </p>
                <p className="text-xs text-text-muted tabular">
                  Normal range: {result.refLow}–{result.refHigh} {result.unit}
                </p>
              </div>
              <StatusPill
                status={result.isAbnormal ? 'abnormal' : 'normal'}
                label={result.isAbnormal ? 'Abnormal' : 'Normal'}
              />
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-xl p-5 shadow-card space-y-4">
            {error && (
              <div className="px-3 py-2.5 rounded-lg bg-crimson-light text-crimson text-sm">{error}</div>
            )}

            <Field label="Patient">
              <select
                required
                value={patientId}
                disabled={!!presetPatientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm disabled:opacity-70"
              >
                <option value="">Select a patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name} — {p.medical_number}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Analyte">
                <select
                  required
                  value={analyte}
                  onChange={(e) => setAnalyte(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm"
                >
                  <option value="">Select an analyte</option>
                  {analyteNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Test date">
                <input
                  type="date"
                  required
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm"
                />
              </Field>
            </div>

            <Field label={`Value${matchedRange ? ` (${matchedRange.unit})` : ''}`}>
              <input
                required
                type="number"
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm tabular"
                placeholder="e.g. 12.4"
              />
              {matchedRange && (
                <p className="text-xs text-text-muted mt-1.5 tabular">
                  Normal range applied: {matchedRange.ref_low}–{matchedRange.ref_high} {matchedRange.unit}
                  {matchedRange.sex !== 'any' && ` (${matchedRange.sex})`}
                </p>
              )}
            </Field>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save result'}
            </button>
          </form>
        </>
      )}
    </AppShell>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-text-primary mb-1.5">{label}</span>
      {children}
    </label>
  )
}
