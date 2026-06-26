import type { ImportPoint } from "@/data/seriesByCountry"
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

// Dummy per-month factors used to synthesize a prior year (2024) that we don't
// have real data for, so the 2025 YoY line isn't flat. Rough sense only.
const DUMMY_PRIOR_FACTOR = [
  0.86, 0.89, 0.84, 0.91, 0.88, 0.93, 0.87, 0.9, 0.85, 0.92, 0.88, 0.86,
]

const config: ChartConfig = {
  yoy2025: { label: "2025 YoY", color: "var(--chart-1)" },
  yoy2026: { label: "2026 YoY", color: "var(--chart-2)" },
}

type Row = { month: string; yoy2025: number | null; yoy2026: number | null }

function monthlyByYear(data: ImportPoint[]): Record<string, (number | undefined)[]> {
  const out: Record<string, (number | undefined)[]> = {}
  for (const pt of data) {
    const [year, month] = pt.date.split("-")
    const m = parseInt(month, 10) - 1
    if (!out[year]) out[year] = Array(12).fill(undefined)
    out[year][m] = pt.usdBn
  }
  return out
}

// Running cumulative YTD; null for months with no data.
function cumulative(monthly: (number | undefined)[]): (number | null)[] {
  let running = 0
  return monthly.map((v) => {
    if (v === undefined) return null
    running += v
    return running
  })
}

// YoY % change of cumulative YTD: this year's YTD-through-month vs prior year's.
function yoy(
  monthly: (number | undefined)[],
  prior: (number | undefined)[],
): (number | null)[] {
  const cur = cumulative(monthly)
  const prev = cumulative(prior)
  return MONTH_LABELS.map((_, m) => {
    const a = cur[m]
    const b = prev[m]
    if (a == null || b == null || b === 0) return null
    return Math.round((a / b - 1) * 1000) / 10
  })
}

function toYoYRows(data: ImportPoint[]): Row[] {
  const byYear = monthlyByYear(data)
  const m2025 = byYear["2025"] ?? Array(12).fill(undefined)
  const m2026 = byYear["2026"] ?? Array(12).fill(undefined)
  // 2024 is synthesized from 2025 since we have no real data for it.
  const m2024 = m2025.map((v, i) => (v === undefined ? undefined : v * DUMMY_PRIOR_FACTOR[i]))

  const yoy2025 = yoy(m2025, m2024)
  const yoy2026 = yoy(m2026, m2025)
  return MONTH_LABELS.map((month, m) => ({
    month,
    yoy2025: yoy2025[m],
    yoy2026: yoy2026[m],
  }))
}

export function ImportValueChart({ data }: { data: ImportPoint[] }) {
  const rows = toYoYRows(data)
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <LineChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} unit="%" />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          content={<ChartTooltipContent />}
          formatter={(value, name) => [`${(value as number).toFixed(1)}%`, name]}
        />
        <Line
          dataKey="yoy2025"
          name="2025 YoY"
          stroke="var(--color-yoy2025)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          dataKey="yoy2026"
          name="2026 YoY"
          stroke="var(--color-yoy2026)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  )
}
