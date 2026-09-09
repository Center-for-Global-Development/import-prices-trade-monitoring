import { TariffEventKey } from "@/components/TariffEventKey"
import { useMemo, useState } from "react"
import {
  BASE_LABEL,
  getPriceSeries,
  tariffCode,
  type Product,
  type TariffCode,
} from "@/data/tracker"
import { TARIFF_EVENTS } from "@/data/events"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts"
import { ProductPicker } from "@/components/ProductPicker"
import { LineLegend } from "@/components/LineLegend"
import { DASH } from "@/lib/tariffDash"

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]


export function PriceTrendsChart({ products }: { products: Product[] }) {
  // Only products with a BLS price series can be plotted. The researcher's
  // file already restricts tracked products to those, but guard anyway.
  const plottable = useMemo(
    () => products.filter((p) => getPriceSeries(p.hs).length > 0),
    [products],
  )

  const [selected, setSelected] = useState<string[]>(() =>
    plottable.slice(0, 3).map((p) => p.hs),
  )

  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = {}
    plottable.forEach((p, i) => {
      const code = tariffCode(p)
      c[p.hs] = {
        label: `${p.hs} · ${p.name}${code ? ` (${code})` : ""}`,
        color: PALETTE[i % PALETTE.length],
      }
    })
    return c
  }, [plottable])

  // "All tariffed" / "All exempt" let readers compare the two groups without
  // ticking boxes one by one — the research lead's main ask for this chart.
  const quickSelects = useMemo(() => {
    const byCode = (code: TariffCode) =>
      plottable.filter((p) => tariffCode(p) === code).map((p) => p.hs)
    return [
      { label: "All tariffed", hs: byCode("T") },
      { label: "All exempt", hs: byCode("E") },
      { label: "All partially exempt", hs: byCode("P") },
    ].filter((q) => q.hs.length > 0)
  }, [plottable])

  const active = useMemo(
    () => plottable.filter((p) => selected.includes(p.hs)),
    [plottable, selected],
  )

  const data = useMemo(() => {
    // date -> { hs4: idx } across the selected series (ranges can differ).
    const byDate = new Map<string, Record<string, string | number>>()
    for (const p of active) {
      for (const pt of getPriceSeries(p.hs)) {
        let row = byDate.get(pt.date)
        if (!row) {
          row = { date: pt.date }
          byDate.set(pt.date, row)
        }
        row[p.hs] = pt.idx
      }
    }
    return [...byDate.values()].sort((a, b) =>
      (a.date as string).localeCompare(b.date as string),
    )
  }, [active])

  if (plottable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        BLS does not publish an import price index for any of these products.
      </p>
    )
  }

  const toggle = (hs: string) =>
    setSelected((curr) =>
      curr.includes(hs) ? curr.filter((x) => x !== hs) : [...curr, hs],
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Indexed to {BASE_LABEL}
        </div>
        <ProductPicker
          products={plottable}
          selected={selected}
          onToggle={toggle}
          onSetSelected={setSelected}
          quickSelects={quickSelects}
          tag={tariffCode}
        />
      </div>
      <ChartContainer config={config} className="h-80 w-full">
        <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
          {/* CGD chart furniture: solid light-gray horizontal grid only,
              teal-black axis text, teal-gray separators/indicators. */}
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={{ stroke: "var(--foreground)" }}
            tickLine={false}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <ReferenceLine y={100} stroke="var(--cgd-teal-gray)" />
          {TARIFF_EVENTS.filter((e) =>
            data.some((row) => row.date === e.month),
          ).map((e) => (
            <ReferenceLine
              key={e.month}
              x={e.month}
              stroke="var(--cgd-teal-gray)"
              strokeDasharray="10 4"
              label={{
                value: String(TARIFF_EVENTS.indexOf(e) + 1),
                position: "insideTopRight",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
          ))}
          {/* zIndex: a tooltip taller than the chart spills over the legend,
              key and the next card; without a stacking order those later
              positioned elements paint on top of it and it reads as
              transparent. */}
          <ChartTooltip
            wrapperStyle={{ zIndex: 20 }}
            content={<TrimmedTooltip />}
          />
          {active.map((p) => {
            const code = tariffCode(p)
            return (
              <Line
                key={p.hs}
                type="monotone"
                dataKey={p.hs}
                stroke={`var(--color-${p.hs})`}
                strokeWidth={2.5}
                strokeDasharray={code ? DASH[code] : undefined}
                dot={false}
                connectNulls
              />
            )
          })}
        </LineChart>
      </ChartContainer>
      {/* Legend lives outside the fixed-height chart so long selections wrap
          and grow the card instead of overflowing sideways. Samples show the
          line's colour AND dash, so the legend doubles as a status key. */}
      <TariffEventKey />
      <LineLegend
        items={active.map((p) => {
          const code = tariffCode(p)
          return {
            key: p.hs,
            label: String(config[p.hs]?.label ?? p.hs),
            color: String(config[p.hs]?.color ?? "currentColor"),
            dash: code ? DASH[code] : undefined,
          }
        })}
      />
      <TariffLineKey />
    </div>
  )
}

// Readers can now put 40+ lines on the chart in one click, and a 40-row
// tooltip is unreadable (and taller than the chart). Show the highest values
// at the hovered month and say how many are hidden.
const TOOLTIP_MAX_ROWS = 10

function TrimmedTooltip(props: React.ComponentProps<typeof ChartTooltipContent>) {
  const { active, payload } = props
  if (!active || !payload?.length) return null
  const sorted = payload
    .filter((i) => i.type !== "none")
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
  const top = sorted.slice(0, TOOLTIP_MAX_ROWS)
  const hidden = sorted.length - top.length
  return (
    <div>
      <ChartTooltipContent
        {...props}
        payload={top}
        className={hidden > 0 ? "rounded-b-none" : undefined}
      />
      {hidden > 0 && (
        <div className="rounded-b-lg border border-t-0 border-border/50 bg-background px-2.5 py-1 text-xs text-muted-foreground shadow-xl">
          +{hidden} more — highest {TOOLTIP_MAX_ROWS} shown
        </div>
      )}
    </div>
  )
}

// What the legend letters and line styles mean. Kept next to the chart so
// readers don't have to scroll to the table's key.
export function TariffLineKey() {
  const sample = (dash?: string) => (
    <svg width="28" height="8" aria-hidden="true" className="shrink-0">
      <line
        x1="1"
        y1="4"
        x2="27"
        y2="4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeDasharray={dash}
      />
    </svg>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
      <span className="font-medium">Tariff status:</span>
      <span className="flex items-center gap-1.5">
        {sample()} <span className="font-mono">T</span> tariffed
      </span>
      <span className="flex items-center gap-1.5">
        {sample(DASH.E)} <span className="font-mono">E</span> exempt
      </span>
      <span className="flex items-center gap-1.5">
        {sample(DASH.P)} <span className="font-mono">P</span> partially exempt
      </span>
      <span>Share of the HS4's US import value exempt under Executive Orders.</span>
    </div>
  )
}
