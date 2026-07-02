// Reusable skeleton primitives. Compose these to build a loading state that
// mirrors the exact shape of the real content — never a generic spinner.

export function SkeletonLine({ width = '100%', height = 14, className = '' }) {
  return (
    <div
      className={`skeleton rounded-md ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCircle({ size = 40, className = '' }) {
  return (
    <div
      className={`skeleton rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  )
}

// Mirrors a stat/summary card
export function SkeletonStatCard() {
  return (
    <div className="bg-surface border border-line rounded-xl p-5 shadow-card">
      <SkeletonLine width={90} height={12} className="mb-3" />
      <SkeletonLine width={70} height={26} />
    </div>
  )
}

// Mirrors one row of a lab-result table: analyte name, value, range, flag pill
export function SkeletonResultRow() {
  return (
    <div className="grid grid-cols-[1.5fr_1fr_1.2fr_0.8fr] items-center gap-4 px-5 py-4 border-b border-line last:border-b-0">
      <SkeletonLine width="70%" />
      <SkeletonLine width="50%" />
      <SkeletonLine width="60%" />
      <SkeletonLine width={64} height={22} className="rounded-full" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden shadow-card">
      <div className="grid grid-cols-[1.5fr_1fr_1.2fr_0.8fr] gap-4 px-5 py-3 border-b border-line bg-canvas">
        <SkeletonLine width={80} height={11} />
        <SkeletonLine width={60} height={11} />
        <SkeletonLine width={90} height={11} />
        <SkeletonLine width={50} height={11} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonResultRow key={i} />
      ))}
    </div>
  )
}

// Mirrors a patient/user list row: avatar + name + meta
export function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-line last:border-b-0">
      <SkeletonCircle size={36} />
      <div className="flex-1">
        <SkeletonLine width="40%" height={13} className="mb-2" />
        <SkeletonLine width="25%" height={11} />
      </div>
    </div>
  )
}

// Mirrors a chart panel
export function SkeletonChart({ heightPx = 220 }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-5 shadow-card">
      <SkeletonLine width={140} height={13} className="mb-4" />
      <div className="skeleton rounded-lg" style={{ height: heightPx }} aria-hidden="true" />
    </div>
  )
}

// Full dashboard skeleton: stat row + table, used as the top-level loading state per role
export function SkeletonDashboard() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      <SkeletonTable rows={6} />
    </div>
  )
}
