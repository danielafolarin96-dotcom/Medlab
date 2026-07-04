import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../../components/AppShell'
import { SkeletonListRow } from '../../components/Skeleton'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabaseClient'

const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say']

export default function ClinicianPatients() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [patients, setPatients] = useState([])
  const [patientProfiles, setPatientProfiles] = useState([]) // role='patient' accounts
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null) // patient row being edited, or null for new
  const [error, setError] = useState('')

  async function loadData() {
    setLoading(true)
    const [{ data: patientRows, error: pErr }, { data: profileRows, error: prErr }] = await Promise.all([
      supabase.from('patients').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'patient'),
    ])
    if (!pErr) setPatients(patientRows ?? [])
    if (!prErr) setPatientProfiles(profileRows ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const linkedUserIds = new Set(patients.map((p) => p.linked_user_id).filter(Boolean))

  function availableProfilesFor(currentPatient) {
    return patientProfiles.filter(
      (p) => !linkedUserIds.has(p.id) || p.id === currentPatient?.linked_user_id
    )
  }

  async function handleSave(formData) {
    setError('')
    const payload = {
      full_name: formData.fullName,
      medical_number: formData.medicalNumber,
      date_of_birth: formData.dateOfBirth || null,
      gender: formData.gender || null,
      linked_user_id: formData.linkedUserId || null,
    }

    if (editing) {
      const { error: updateErr } = await supabase
        .from('patients')
        .update(payload)
        .eq('id', editing.id)
      if (updateErr) {
        setError(friendlyError(updateErr))
        return false
      }
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: `Updated patient record for ${payload.full_name}`,
        record_affected: editing.id,
      })
    } else {
      const { data: created, error: insertErr } = await supabase
        .from('patients')
        .insert({ ...payload, registered_by: user.id })
        .select()
        .single()
      if (insertErr) {
        setError(friendlyError(insertErr))
        return false
      }
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: `Registered patient ${payload.full_name} (${payload.medical_number})`,
        record_affected: created.id,
      })
    }

    setShowForm(false)
    setEditing(null)
    loadData()
    return true
  }

  return (
    <AppShell>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Patients</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Register patients and link their portal accounts.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null)
            setError('')
            setShowForm((v) => !v)
          }}
          className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors shrink-0"
        >
          {showForm && !editing ? 'Close' : 'Register patient'}
        </button>
      </header>

      {showForm && (
        <PatientForm
          key={editing?.id ?? 'new'}
          initial={editing}
          availableProfiles={availableProfilesFor(editing)}
          error={error}
          onCancel={() => {
            setShowForm(false)
            setEditing(null)
            setError('')
          }}
          onSave={handleSave}
        />
      )}

      <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-card mt-6">
        <div className="grid grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.9fr_0.6fr] gap-4 px-5 py-3 border-b border-line bg-canvas text-xs font-semibold text-text-muted uppercase tracking-wide">
          <span>Name</span>
          <span>Medical number</span>
          <span>Date of birth</span>
          <span>Gender</span>
          <span>Portal access</span>
          <span></span>
        </div>

        {loading ? (
          <>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </>
        ) : patients.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-text-secondary">
            No patients registered yet.
          </div>
        ) : (
          patients.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[1.3fr_1fr_0.9fr_0.9fr_0.9fr_0.6fr] items-center gap-4 px-5 py-3.5 border-b border-line last:border-b-0 text-sm"
            >
              <Link to={`/clinician/patients/${p.id}`} className="text-ink font-medium hover:underline truncate">
                {p.full_name}
              </Link>
              <span className="text-text-secondary tabular">{p.medical_number}</span>
              <span className="text-text-secondary tabular">{p.date_of_birth ?? '—'}</span>
              <span className="text-text-secondary">{p.gender ?? '—'}</span>
              <span className={p.linked_user_id ? 'text-teal font-medium' : 'text-text-muted'}>
                {p.linked_user_id ? 'Linked' : 'Not linked'}
              </span>
              <button
                onClick={() => {
                  setEditing(p)
                  setError('')
                  setShowForm(true)
                }}
                className="text-xs font-semibold text-teal hover:underline text-left"
              >
                Edit
              </button>
            </div>
          ))
        )}
      </div>
    </AppShell>
  )
}

function friendlyError(err) {
  if (err.code === '23505') return 'That medical number is already registered to another patient.'
  return err.message
}

function PatientForm({ initial, availableProfiles, error, onCancel, onSave }) {
  const [fullName, setFullName] = useState(initial?.full_name ?? '')
  const [medicalNumber, setMedicalNumber] = useState(initial?.medical_number ?? '')
  const [dateOfBirth, setDateOfBirth] = useState(initial?.date_of_birth ?? '')
  const [gender, setGender] = useState(initial?.gender ?? '')
  const [linkedUserId, setLinkedUserId] = useState(initial?.linked_user_id ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    await onSave({ fullName, medicalNumber, dateOfBirth, gender, linkedUserId })
    setSubmitting(false)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface border border-line rounded-xl p-5 shadow-card mb-2 space-y-4"
    >
      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-crimson-light text-crimson text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full name">
          <input
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm"
            placeholder="e.g. Chidinma Okafor"
          />
        </Field>
        <Field label="Medical number">
          <input
            required
            value={medicalNumber}
            onChange={(e) => setMedicalNumber(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm tabular"
            placeholder="e.g. MRN-00123"
          />
        </Field>
        <Field label="Date of birth">
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm"
          />
        </Field>
        <Field label="Gender">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm"
          >
            <option value="">Not specified</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label="Portal account (optional)">
          <select
            value={linkedUserId}
            onChange={(e) => setLinkedUserId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-line bg-canvas text-sm"
          >
            <option value="">No portal access yet</option>
            {availableProfiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>
            ))}
          </select>
          {availableProfiles.length === 0 && (
            <p className="text-xs text-text-muted mt-1.5">
              No unlinked patient accounts yet — create one from Admin → User accounts first.
            </p>
          )}
        </Field>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-semibold hover:bg-ink/90 transition-colors disabled:opacity-60"
        >
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Register patient'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg border border-line text-sm font-semibold text-text-secondary hover:bg-canvas transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
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
