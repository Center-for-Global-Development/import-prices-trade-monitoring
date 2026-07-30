import type { ImportPoint } from "@/data/tracker"
import { TARIFF_EVENTS } from "@/data/events"
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
  yoy: { label: "Cumulative YoY", color: "var(--chart-1)" },
}

type Row = { month: string; yoy: number | null }
type Panel = { year: number; rows: Row[] }

// Cumulative (YTD) YoY per the v2 methodology: imports Jan..M vs the same
// months a year earlier. The values come straight from the researcher's
// Census workbook (ImportPoint.cumYoy), not computed here.
function toPanels(data: ImportPoint[]): Panel[] {
  const byYear: Record<number, (number | null)[]> = {}
  for (const pt of data) {
    if (pt.cumYoy === null) continue
    const y = parseInt(pt.date, 10)
    const m = parseInt(pt.date.slice(5), 10) - 1
    if (!byYear[y]) byYear[y] = Array(12).fill(null)
    byYear[y][m] = pt.cumYoy
  }
  const years = Object.keys(byYear).map(Number).sort().slice(-3)
  return years.map((year) => ({
    year,
    rows: MONTH_LABELS.map((month, m) => ({ month, yoy: byYear[year][m] })),
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
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                ticks={["Jan", "Apr", "Jul", "Oct"]}
                axisLine={{ stroke: "var(--foreground)" }}
                tickLine={false}
              />
              <YAxis
                domain={domain}
                tick={{ fontSize: 11, fill: "var(--foreground)" }}
                axisLine={false}
                tickLine={false}
                unit="%"
                width={42}
              />
              <ReferenceLine y={0} stroke="var(--cgd-teal-gray)" />
              {TARIFF_EVENTS.filter((e) => e.month.startsWith(`${p.year}-`)).map(
                (e) => (
                  <ReferenceLine
                    key={e.month}
                    x={MONTH_LABELS[parseInt(e.month.slice(5), 10) - 1]}
                    stroke="var(--cgd-teal-gray)"
                    strokeDasharray="10 4"
                    label={{
                      value: e.label,
                      position: "insideTopLeft",
                      fontSize: 10,
                      fill: "var(--muted-foreground)",
                    }}
                  />
                ),
              )}
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value) => [
                  `${(value as number).toFixed(1)}%`,
                  `${p.year} YTD YoY`,
                ]}
              />
              <Line
                dataKey="yoy"
                stroke="var(--color-yoy)"
                strokeWidth={2.5}
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
