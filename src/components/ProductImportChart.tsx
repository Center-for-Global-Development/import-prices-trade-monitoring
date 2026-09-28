import { TariffEventKey } from "@/components/TariffEventKey"
import { useMemo, useState } from "react"
import {
  getProductImportSeries,
  tariffCode,
  type ImportPoint,
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
import { TariffLineKey } from "@/components/PriceTrendsChart"
import { DASH } from "@/lib/tariffDash"
import { useSeriesColors } from "@/lib/seriesColors"

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

const pct = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`

// Per-product US import value from the country: the researcher's monthly
// cumulative-YTD YoY series per country×HS4 (Sep 2026 drop), laid out like
// the country-level import chart — one panel per calendar year, months on
// the x-axis, % on the y — with the price chart's add/drop product picker
// and tariff-status encoding so the two charts read the same way.
export function ProductImportChart({ iso, products }: { iso: string; products: Product[] }) {
  // Only products the file carries a monthly series for. Pairs with no
  // year-earlier imports have no ratio at all and can't be plotted.
  const series = useMemo(() => {
    const m = new Map<string, ImportPoint[]>()
    for (const p of products) {
      const s = getProductImportSeries(iso, p.hs)
      if (s.some((pt) => pt.cumYoy !== null)) m.set(p.hs, s)
    }
    return m
  }, [iso, products])
  const plottable = useMemo(
    () => products.filter((p) => series.has(p.hs)),
    [products, series],
  )

  // Default to the three largest by import value — the products that matter
  // most for the country's trade with the US.
  const [selected, setSelected] = useState<string[]>(() =>
    [...plottable]
      .sort((a, b) => (b.usImportsYtd ?? 0) - (a.usImportsYtd ?? 0))
      .slice(0, 3)
      .map((p) => p.hs),
  )

  const colors = useSeriesColors(selected)
  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = {}
    plottable.forEach((p) => {
      const code = tariffCode(p)
      c[p.hs] = {
        label: `${p.hs} · ${p.name}${code ? ` (${code})` : ""}`,
        color: colors[p.hs],
      }
    })
    return c
  }, [plottable, colors])

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

  // Panels cover the years any plottable product has data for (last three),
  // so they don't jump around as the selection changes. Rows are
  // month -> { hs4: yoy } for the selected products only.
  const years = useMemo(() => {
    const ys = new Set<number>()
    for (const s of series.values())
      for (const pt of s) if (pt.cumYoy !== null) ys.add(parseInt(pt.date, 10))
    return [...ys].sort().slice(-3)
  }, [series])

  const panels = useMemo(
    () =>
      years.map((year) => ({
        year,
        rows: MONTH_LABELS.map((month, m) => {
          const row: Record<string, string | number | null> = { month }
          const date = `${year}-${String(m + 1).padStart(2, "0")}`
          for (const p of active) {
            row[p.hs] = series.get(p.hs)?.find((pt) => pt.date === date)?.cumYoy ?? null
          }
          return row
        }),
      })),
    [years, active, series],
  )

  if (plottable.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No product-level import history for this country.
      </p>
    )
  }

  // Shared y-domain across the panels so they compare at a glance. Tiny
  // trade flows can swing thousands of percent; the axis follows the
  // selection rather than clipping, so readers see what they picked.
  const values = panels
    .flatMap((p) => p.rows.flatMap((r) => active.map((a) => r[a.hs])))
    .filter((v): v is number => typeof v === "number")
  const pad = 5
  const domain: [number, number] = values.length
    ? [
        Math.floor(Math.min(...values, 0) / pad) * pad - pad,
        Math.ceil(Math.max(...values, 0) / pad) * pad + pad,
      ]
    : [-pad, pad]

  const toggle = (hs: string) =>
    setSelected((curr) =>
      curr.includes(hs) ? curr.filter((x) => x !== hs) : [...curr, hs],
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Cumulative year-to-date vs a year earlier, %
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
      <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {panels.map((panel) => (
          <div key={panel.year} className="min-w-0">
            <div className="mb-1 text-sm font-medium">{panel.year}</div>
            <ChartContainer config={config} className="h-56 w-full">
              <LineChart data={panel.rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
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
                  width={48}
                />
                <ReferenceLine y={0} stroke="var(--cgd-teal-gray)" />
                {TARIFF_EVENTS.filter((e) => e.month.startsWith(`${panel.year}-`)).map((e) => (
                  <ReferenceLine
                    key={e.month}
                    x={MONTH_LABELS[parseInt(e.month.slice(5), 10) - 1]}
                    stroke="var(--cgd-teal-gray)"
                    strokeDasharray="10 4"
                    label={{
                      value: String(TARIFF_EVENTS.indexOf(e) + 1),
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: "var(--muted-foreground)",
                    }}
                  />
                ))}
                <ChartTooltip
                  wrapperStyle={{ zIndex: 20 }}
                  content={<TrimmedTooltip year={panel.year} config={config} />}
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
                      // Small dots so a product with a single month of
                      // history (a lone point) is still visible.
                      dot={{ r: 2, strokeWidth: 0, fill: `var(--color-${p.hs})` }}
                      activeDot={{ r: 4 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )
                })}
              </LineChart>
            </ChartContainer>
          </div>
        ))}
      </div>
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

// Same treatment as the price chart: readers can select every product at
// once, so cap the tooltip at the highest values and say how many are hidden.
const TOOLTIP_MAX_ROWS = 10

function TrimmedTooltip({
  year,
  config,
  ...props
}: React.ComponentProps<typeof ChartTooltipContent> & { year: number; config: ChartConfig }) {
  const { active, payload, label } = props
  if (!active || !payload?.length) return null
  const sorted = payload
    .filter((i) => i.type !== "none" && i.value !== null && i.value !== undefined)
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
  const top = sorted.slice(0, TOOLTIP_MAX_ROWS)
  const hidden = sorted.length - top.length
  return (
    <div>
      <ChartTooltipContent
        {...props}
        payload={top}
        labelFormatter={() => `${label} ${year}, YTD vs year earlier`}
        formatter={(value, name) => (
          <div className="flex flex-1 items-center justify-between gap-4 leading-none">
            <span className="text-muted-foreground">
              {config[name as string]?.label ?? String(name)}
            </span>
            <span className="font-mono font-medium tabular-nums text-foreground">
              {pct(value as number)}
            </span>
          </div>
        )}
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
