// Statistical trend analysis — NOT machine learning. Percentage change,
// moving average, and slope over a patient's historical results for one
// analyte. Kept deliberately separate from the Random Forest module
// (src/pages/clinician/ResultEntry.jsx / api/predict.py), per the
// supervisor's explicit guidance that trend analysis should not be ML.
//
// "Improving" vs "Deteriorating" is direction-aware relative to the
// center of the normal range, not just "value going up/down" — a rising
// haemoglobin from a low result is improving; a rising glucose from a
// normal result is deteriorating. Both are captured the same way by
// tracking distance-from-center (severity) over time, reusing the same
// range-normalization approach as the Random Forest features.

const SLOPE_THRESHOLD = 0.05 // severity units per test; see docstring above

export function computeTrend(results, refLow, refHigh) {
  // results: array of { value, test_date }, any order, for ONE analyte.
  // Returns null if fewer than 3 points — matches the stated requirement
  // that a trend label only appears once there's enough history.
  if (!results || results.length < 3) return null

  const sorted = [...results].sort(
    (a, b) => new Date(a.test_date) - new Date(b.test_date)
  )
  const mid = (refLow + refHigh) / 2
  const half = (refHigh - refLow) / 2

  const severity = sorted.map((r) => Math.abs((r.value - mid) / half))
  const n = severity.length

  // Simple linear regression of severity against test sequence (not
  // calendar time — test-over-test trend is what clinicians read
  // trend charts for, and it avoids irregular-interval distortion).
  const xs = severity.map((_, i) => i)
  const xMean = xs.reduce((a, b) => a + b, 0) / n
  const yMean = severity.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (severity[i] - yMean)
    den += (xs[i] - xMean) ** 2
  }
  const slope = den === 0 ? 0 : num / den

  const movingWindow = severity.slice(-3)
  const movingAverage = movingWindow.reduce((a, b) => a + b, 0) / movingWindow.length

  // Expressed as % of the half-range moved, not % relative to the starting
  // value — a relative-to-baseline percentage blows up (e.g. "9400%")
  // whenever a patient started close to the center of the normal range,
  // which is a common case, not a rare one. This measure stays bounded
  // and interpretable regardless of where the series starts.
  const first = severity[0]
  const last = severity[n - 1]
  const percentChange = (last - first) * 100

  let label
  if (slope <= -SLOPE_THRESHOLD) label = 'Improving'
  else if (slope >= SLOPE_THRESHOLD) label = 'Deteriorating'
  else label = 'Stable'

  return {
    label,
    slope,
    percentChange,
    movingAverage,
    pointsUsed: n,
    latestValue: sorted[n - 1].value,
    latestDate: sorted[n - 1].test_date,
  }
}

// Groups a flat list of lab_results rows (mixed analytes) into
// { [analyte]: trendResult } for every analyte with enough history.
export function computeTrendsByAnalyte(results) {
  const byAnalyte = {}
  for (const r of results) {
    if (!byAnalyte[r.analyte]) byAnalyte[r.analyte] = []
    byAnalyte[r.analyte].push(r)
  }

  const trends = {}
  for (const [analyte, rows] of Object.entries(byAnalyte)) {
    if (rows.length < 3) continue
    // Use the most recent row's reference range (ranges don't typically
    // change, but this is the defensible choice if they ever do).
    const latest = [...rows].sort(
      (a, b) => new Date(b.test_date) - new Date(a.test_date)
    )[0]
    const trend = computeTrend(rows, latest.ref_low, latest.ref_high)
    if (trend) trends[analyte] = trend
  }
  return trends
}
