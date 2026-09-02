import { useMemo, useState } from "react"
import { IMPORTS_YTD_THROUGH, ytdLabel, type Product } from "@/data/tracker"
import { TARIFF_EVENTS } from "@/data/events"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { ProductPicker } from "@/components/ProductPicker"

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function usd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

// Per-product U.S. import value from the country, laid out like the
// country-level import chart (one calendar year on the x-axis) with the
// price chart's add/drop product picker.
//
// PLACEHOLDER SHAPE: the researcher's file carries a single cumulative
// Jan–<latest month> import value per product, so each product plots as one
// point at the latest month rather than a line. The chart is built as a
// line chart on purpose — once the file gains a monthly (or YoY) series per
// country×HS4, the same component draws lines with no structural change.
export function ProductImportChart({ products }: { products: Product[] }) {
  const plottable = useMemo(
    () => products.filter((p) => p.usImportsYtd !== null),
    [products],
  )

  // Default to the three largest by import value — the products that matter
  // most for the country's trade with the U.S.
  const [selected, setSelected] = useState<string[]>(() =>
    [...plottable]
      .sort((a, b) => (b.usImportsYtd ?? 0) - (a.usImportsYtd ?? 0))
      .slice(0, 3)
      .map((p) => p.hs),
  )

  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = {}
    plottable.forEach((p, i) => {
      c[p.hs] = { label: `${p.hs} · ${p.name}`, color: PALETTE[i % PALETTE.length] }
    })
    return c
  }, [plottable])

  const year = IMPORTS_YTD_THROUGH.slice(0, 4)
  const ytdMonthIdx = parseInt(IMPORTS_YTD_THROUGH.slice(5), 10) - 1
  const active = plottable.filter((p) => selected.includes(p.hs))

  const rows = MONTH_LABELS.map((month, m) => {
    const row: Record<string, string | number | null> = { month }
    for (const p of active) row[p.hs] = m === ytdMonthIdx ? p.usImportsYtd : null
    return row
  })

  if (plottable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No product-level import values for this country.
      </p>
    )
  }

  const toggle = (hs: string) =>
    setSelected((curr) =>
      curr.includes(hs) ? curr.filter((x) => x !== hs) : [...curr, hs],
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Cumulative {ytdLabel(IMPORTS_YTD_THROUGH)}, USD
        </div>
        <ProductPicker products={plottable} selected={selected} onToggle={toggle} />
      </div>
      <div className="mb-1 text-sm font-medium">{year}</div>
      <ChartContainer config={config} className="h-64 w-full">
        <LineChart data={rows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={{ stroke: "var(--foreground)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, "auto"]}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => usd(v)}
            width={64}
          />
          {TARIFF_EVENTS.filter((e) => e.month.startsWith(`${year}-`)).map((e) => (
            <ReferenceLine
              key={e.month}
              x={MONTH_LABELS[parseInt(e.month.slice(5), 10) - 1]}
              stroke="var(--cgd-teal-gray)"
              strokeDasharray="10 4"
              label={{
                value: e.label,
                position: "insideTopLeft",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
          ))}
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name) => (
                  <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                    <span className="text-muted-foreground">
                      {config[name as string]?.label ?? name}
                    </span>
                    <span className="font-mono font-medium tabular-nums text-foreground">
                      {usd(value as number)}
                    </span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {active.map((p) => (
            <Line
              key={p.hs}
              type="monotone"
              dataKey={p.hs}
              stroke={`var(--color-${p.hs})`}
              strokeWidth={2.5}
              // A single observation per product today, so the dot IS the
              // mark; keep dots on so lines-with-dots read well once monthly
              // data arrives.
              dot={{ r: 5, strokeWidth: 0, fill: `var(--color-${p.hs})` }}
              activeDot={{ r: 6 }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  )
}
