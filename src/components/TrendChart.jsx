import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  CartesianGrid,
} from 'recharts'

// Postgres `numeric` columns arrive as JSON strings (see src/lib/trend.js
// for the full explanation) — explicitly coerce everything here too, so
// this component is correct regardless of what shape the caller passes in.
// Recharts' automatic Y-axis tick generation can degenerate on small or
// tightly-spaced numeric ranges — verified in testing, where it produced
// three duplicate tick labels on a real chart. Computing ticks explicitly
// removes that failure mode entirely rather than hoping the library's
// internal "nice number" algorithm behaves for every possible range.
function computeTicks(min, max, count = 5) {
  const step = (max - min) / (count - 1)
  const decimals = Math.abs(max - min) < 20 ? 1 : 0
  const raw = Array.from({ length: count }, (_, i) => Number((min + step * i).toFixed(decimals)))
  return [...new Set(raw)] // guard against rounding ever collapsing two ticks to the same value
}

export default function TrendChart({ results, refLow, refHigh, unit }) {
  const refLowNum = Number(refLow)
  const refHighNum = Number(refHigh)

  const data = [...results]
    .map((r) => ({ ...r, value: Number(r.value) }))
    .sort((a, b) => new Date(a.test_date) - new Date(b.test_date))

  const values = data.map((d) => d.value)
  const dataMin = Math.min(...values, refLowNum)
  const dataMax = Math.max(...values, refHighNum)
  const padding = (dataMax - dataMin) * 0.15 || 1
  const yMin = dataMin - padding
  const yMax = dataMax + padding
  const yTicks = computeTicks(yMin, yMax)

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#E4E8EE" vertical={false} />
          <XAxis
            dataKey="test_date"
            tick={{ fontSize: 11, fill: '#5B6472' }}
            tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          />
          <YAxis
            domain={[yMin, yMax]}
            ticks={yTicks}
            tick={{ fontSize: 11, fill: '#5B6472' }}
            width={44}
          />
          <ReferenceArea
            y1={refLowNum}
            y2={refHighNum}
            fill="#0F8B8D"
            fillOpacity={0.08}
            stroke="none"
          />
          <Tooltip
            formatter={(value) => [`${value} ${unit}`, 'Value']}
            labelFormatter={(d) => new Date(d).toLocaleDateString()}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E4E8EE' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#12233D"
            strokeWidth={2}
            dot={{ r: 3, fill: '#12233D' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
