import type { ImportPoint } from "@/data/tracker"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

// One metric across all panels -> one hue everywhere; the panel title
// carries the year.
const config: ChartConfig = {
  yoy: { label: "YoY change", color: "var(--chart-1)" },
}

type Row = { month: string; yoy: number | null }
type Panel = { year: number; rows: Row[] }

function monthlyByYear(data: ImportPoint[]): Record<number, (number | undefined)[]> {
  const out: Record<number, (number | undefined)[]> = {}
  for (const pt of data) {
    const [year, month] = pt.date.split("-")
    const y = parseInt(year, 10)
    const m = parseInt(month, 10) - 1
    if (!out[y]) out[y] = Array(12).fill(undefined)
    out[y][m] = pt.usdBn
  }
  return out
}

// YoY % change per the methodology doc: each month's import value vs the same
// month one year earlier (removes seasonality; NOT cumulative YTD).
function toPanels(data: ImportPoint[]): Panel[] {
  const byYear = monthlyByYear(data)
  // A year gets a panel when both it and the prior year have data.
  const years = Object.keys(byYear)
    .map(Number)
    .filter((y) => byYear[y - 1])
    .sort()
    .slice(-3)
  return years.map((year) => ({
    year,
    rows: MONTH_LABELS.map((month, m) => {
      const a = byYear[year][m]
      const b = byYear[year - 1][m]
      const yoy =
        a === undefined || b === undefined || b === 0
          ? null
          : Math.round((a / b - 1) * 1000) / 10
      return { month, yoy }
    }),
  }))
}

export function ImportValueChart({ data }: { data: ImportPoint[] }) {
  const panels = toPanels(data)
  if (panels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough history to compute year-over-year changes.
      </p>
    )
  }

  // Shared y-domain so the panels are comparable at a glance.
  const values = panels.flatMap((p) => p.rows.map((r) => r.yoy)).filter(
    (v): v is number => v !== null,
  )
  const pad = 5
  const domain: [number, number] = [
    Math.floor(Math.min(...values, 0) / pad) * pad - pad,
    Math.ceil(Math.max(...values, 0) / pad) * pad + pad,
  ]

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {panels.map((p) => (
        <div key={p.year}>
          <div className="mb-1 text-sm font-medium">{p.year}</div>
          <ChartContainer config={config} className="h-44 w-full">
            <LineChart data={p.rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                ticks={["Jan", "Apr", "Jul", "Oct"]}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tick={{ fontSize: 11 }}
                unit="%"
                width={42}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => [
                  `${(value as number).toFixed(1)}%`,
                  `${p.year} YoY`,
                ]}
              />
              <Line
                dataKey="yoy"
                stroke="var(--color-yoy)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ChartContainer>
        </div>
      ))}
    </div>
  )
}
