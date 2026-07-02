const STYLES = {
  normal: 'bg-teal-light text-teal',
  abnormal: 'bg-crimson-light text-crimson',
  moderate: 'bg-amber-light text-amber',
  low: 'bg-teal-light text-teal',
  high: 'bg-crimson-light text-crimson',
  stable: 'bg-teal-light text-teal',
  improving: 'bg-teal-light text-teal',
  deteriorating: 'bg-crimson-light text-crimson',
}

export default function StatusPill({ status, label }) {
  const key = (status ?? '').toLowerCase()
  const style = STYLES[key] ?? 'bg-line text-text-secondary'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${style}`}>
      {label ?? status}
    </span>
  )
}
