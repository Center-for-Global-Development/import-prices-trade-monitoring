import { useMemo, useState } from "react"
import { BASE_LABEL, getPriceSeries, type Product } from "@/data/tracker"
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function PriceTrendsChart({ products }: { products: Product[] }) {
  // Only products with a BLS price series can be plotted.
  const plottable = useMemo(
    () => products.filter((p) => p.hasPriceSeries),
    [products],
  )

  const [selected, setSelected] = useState<string[]>(() =>
    plottable.slice(0, 3).map((p) => p.hs),
  )

  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = {}
    plottable.forEach((p, i) => {
      c[p.hs] = { label: `${p.hs} · ${p.name}`, color: PALETTE[i % PALETTE.length] }
    })
    return c
  }, [plottable])

  const data = useMemo(() => {
    const active = plottable.filter((p) => selected.includes(p.hs))
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
  }, [plottable, selected])

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
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Indexed to {BASE_LABEL}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              {selected.length} of {plottable.length} products
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-2">
              <div className="text-sm font-medium">Show products</div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {plottable.map((p) => (
                  <label
                    key={p.hs}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={selected.includes(p.hs)}
                      onCheckedChange={() => toggle(p.hs)}
                    />
                    <span className="font-mono text-xs">{p.hs}</span>
                    <span className="truncate">{p.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
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
                value: e.label,
                position: "insideTopLeft",
                fontSize: 11,
                fill: "var(--muted-foreground)",
              }}
            />
          ))}
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {plottable
            .filter((p) => selected.includes(p.hs))
            .map((p) => (
              <Line
                key={p.hs}
                type="monotone"
                dataKey={p.hs}
                stroke={`var(--color-${p.hs})`}
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
            ))}
        </LineChart>
      </ChartContainer>
    </div>
  )
}
