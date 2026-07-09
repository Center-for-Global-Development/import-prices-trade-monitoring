import { useState } from "react"
import { getPriceSeries, hs2For, SHARE_YEAR, type Product } from "@/data/tracker"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

function usd(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function TariffBadge({ exemptPct }: { exemptPct: number | null }) {
  if (exemptPct === null) {
    return <span className="text-xs text-muted-foreground">n/a</span>
  }
  if (exemptPct === 0) return <Badge variant="destructive">Tariffed</Badge>
  if (exemptPct === 100) return <Badge variant="outline">Exempt</Badge>
  return <Badge variant="secondary">{Math.round(exemptPct)}% exempt</Badge>
}

type Group = {
  code: string
  name: string
  products: Product[]
}

function groupByHS2(products: Product[]): Group[] {
  const groups = new Map<string, Group>()
  for (const p of products) {
    const { code, name } = hs2For(p.hs)
    let g = groups.get(code)
    if (!g) {
      g = { code, name, products: [] }
      groups.set(code, g)
    }
    g.products.push(p)
  }
  const out = [...groups.values()]
  out.forEach((g) => g.products.sort((a, b) => b.shareToUS - a.shareToUS))
  // Order groups by the US-bound export value of the qualifying products in
  // them (a display ordering only — NOT a true chapter total, since products
  // below the 10% share threshold are excluded).
  const sum = (g: Group) => g.products.reduce((n, p) => n + p.usExports, 0)
  out.sort((a, b) => sum(b) - sum(a))
  return out
}

// Rows shown before the "Show all" toggle kicks in. Countries can have
// 1,000+ qualifying products (Canada, Mexico), which makes the page unusable
// if rendered in full by default.
const COLLAPSED_ROW_TARGET = 20

export function TopProductsTable({ products }: { products: Product[] }) {
  const [showAll, setShowAll] = useState(false)
  const groups = groupByHS2(products)

  let visible = groups
  if (!showAll) {
    visible = []
    let remaining = COLLAPSED_ROW_TARGET
    for (const g of groups) {
      if (remaining <= 0) break
      const take = g.products.slice(0, remaining)
      visible.push({ ...g, products: take })
      remaining -= take.length
    }
  }
  const hiddenCount =
    products.length - visible.reduce((n, g) => n + g.products.length, 0)

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">HS</TableHead>
            <TableHead>Product</TableHead>
            <TableHead className="text-right">Share to U.S.</TableHead>
            <TableHead className="text-right">Tariff status</TableHead>
            <TableHead className="text-right">Price index (latest)</TableHead>
            <TableHead className="text-right">Exports to U.S. ({SHARE_YEAR})</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((g) => (
            <HS2Group key={g.code} group={g} />
          ))}
        </TableBody>
      </Table>
      {hiddenCount > 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
          Show all {products.length} products ({hiddenCount} more)
        </Button>
      )}
      {showAll && groups.length > 1 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(false)}>
          Collapse
        </Button>
      )}
    </div>
  )
}

function HS2Group({ group }: { group: Group }) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell className="font-mono font-medium">{group.code}</TableCell>
        <TableCell className="font-medium" colSpan={5}>
          {group.name}
        </TableCell>
      </TableRow>
      {group.products.map((p) => {
        const series = p.hasPriceSeries ? getPriceSeries(p.hs) : []
        const last = series.length ? series[series.length - 1].idx : null
        return (
          <TableRow key={p.hs}>
            <TableCell className="pl-8 font-mono text-muted-foreground">{p.hs}</TableCell>
            <TableCell className="max-w-[340px] whitespace-normal">{p.name}</TableCell>
            <TableCell className="text-right">
              <Badge variant="secondary">{Math.round(p.shareToUS * 100)}%</Badge>
            </TableCell>
            <TableCell className="text-right">
              <TariffBadge exemptPct={p.exemptPct} />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {last === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                last.toFixed(1)
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{usd(p.usExports)}</TableCell>
          </TableRow>
        )
      })}
    </>
  )
}
