import type { CountryData, Product } from "@/data/seriesByCountry"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

function pct(n: number) {
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(1)}%`
}

function priceChangeYTD(products: Product[]): number {
  if (products.length === 0) return 0
  const changes = products.map((p) => {
    const series = p.priceSeries
    const last = series[series.length - 1].idx
    return ((last - 100) / 100) * 100
  })
  return changes.reduce((a, b) => a + b, 0) / changes.length
}

function priceChangeYoY(products: Product[]): number {
  if (products.length === 0) return 0
  const changes = products.map((p) => {
    const series = p.priceSeries
    const last = series[series.length - 1]
    const yearAgo = series.find(
      (pt) =>
        pt.date ===
        `${parseInt(last.date.slice(0, 4)) - 1}-${last.date.slice(5)}`,
    )
    if (!yearAgo) return 0
    return ((last.idx - yearAgo.idx) / yearAgo.idx) * 100
  })
  return changes.reduce((a, b) => a + b, 0) / changes.length
}

function importChangeYTD(data: CountryData): number {
  const series = data.importValue
  const first = series[0].usdBn
  const last = series[series.length - 1].usdBn
  return ((last - first) / first) * 100
}

function topProductByShare(products: Product[]): string {
  if (products.length === 0) return "—"
  const top = products[0]
  return `${top.hs} · ${top.name}`
}

export function SummaryStats({
  data,
  qualifying,
}: {
  data: CountryData
  qualifying: Product[]
}) {
  const stats = [
    { label: "Avg. price index, YTD", value: pct(priceChangeYTD(qualifying)) },
    { label: "Avg. price index, YoY", value: pct(priceChangeYoY(qualifying)) },
    { label: "Imports, YTD change", value: pct(importChangeYTD(data)) },
    { label: "Top product (share)", value: topProductByShare(qualifying) },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {s.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{s.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
