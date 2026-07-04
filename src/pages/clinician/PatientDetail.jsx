import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { SkeletonLine, SkeletonTable } from '../../components/Skeleton'
import { supabase } from '../../lib/supabaseClient'

export default function PatientDetail() {
  const { patientId } = useParams()
  const [loading, setLoading] = useState(true)
  const [patient, setPatient] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return
        if (error || !data) setNotFound(true)
        else setPatient(data)
        setLoading(false)
      })
    return () => { mounted = false }
  }, [patientId])

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
          <header className="mb-6">
            <h1 className="text-xl font-semibold text-text-primary">{patient.full_name}</h1>
            <p className="text-sm text-text-secondary mt-0.5 tabular">
              {patient.medical_number}
              {patient.date_of_birth && <> · DOB {patient.date_of_birth}</>}
              {patient.gender && <> · {patient.gender}</>}
            </p>
          </header>

          <div className="bg-surface border border-line rounded-xl p-5 shadow-card mb-6">
            <p className="text-sm text-text-secondary">
              Portal access:{' '}
              <span className={patient.linked_user_id ? 'text-teal font-medium' : 'text-text-muted'}>
                {patient.linked_user_id ? 'Linked to a patient login' : 'Not linked yet'}
              </span>
            </p>
          </div>

          <div className="bg-surface border border-dashed border-line rounded-xl p-10 text-center">
            <h3 className="text-sm font-semibold text-text-primary mb-1">Lab results coming soon</h3>
            <p className="text-sm text-text-secondary max-w-sm mx-auto">
              Result entry, abnormality detection, and trend history for this patient will appear
              here once that phase is built.
            </p>
          </div>
        </>
      )}
    </AppShell>
  )
}
