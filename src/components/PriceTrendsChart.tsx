import { useMemo, useState } from "react"
import type { Product } from "@/data/seriesByCountry"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
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
  const [selected, setSelected] = useState<string[]>(() =>
    products.slice(0, 3).map((p) => p.hs),
  )

  const config = useMemo<ChartConfig>(() => {
    const c: ChartConfig = {}
    products.forEach((p, i) => {
      c[p.hs] = { label: `${p.hs} · ${p.name}`, color: PALETTE[i % PALETTE.length] }
    })
    return c
  }, [products])

  const data = useMemo(() => {
    if (products.length === 0) return []
    const dates = products[0].priceSeries.map((pt) => pt.date)
    return dates.map((date, i) => {
      const row: Record<string, string | number> = { date }
      products.forEach((p) => {
        if (selected.includes(p.hs)) {
          row[p.hs] = p.priceSeries[i].idx
        }
      })
      return row
    })
  }, [products, selected])

  const toggle = (hs: string) =>
    setSelected((curr) =>
      curr.includes(hs) ? curr.filter((x) => x !== hs) : [...curr, hs],
    )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Indexed to Jan 2025 = 100
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              {selected.length} of {products.length} products
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-2">
              <div className="text-sm font-medium">Show products</div>
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {products.map((p) => (
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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {products
            .filter((p) => selected.includes(p.hs))
            .map((p) => (
              <Line
                key={p.hs}
                type="monotone"
                dataKey={p.hs}
                stroke={`var(--color-${p.hs})`}
                strokeWidth={2}
                dot={false}
              />
            ))}
        </LineChart>
      </ChartContainer>
    </div>
  )
}
