import { useState } from "react"
import {
  hs2For,
  IMPORTS_YTD_THROUGH,
  SHARE_BASIS,
  ytdLabel,
  type Product,
} from "@/data/tracker"
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

// CGD stoplight palette: tariffed = bad, partially exempt = caution, fully
// exempt = good. The label text is the researcher's preformatted
// tariff_status; the numeric exempt share only picks the colour. Meaning is
// carried by the label, never colour alone.
function TariffBadge({ product: p }: { product: Product }) {
  if (p.exemptPct === null) {
    return <span className="text-xs text-muted-foreground">{p.tariffStatus || "n/a"}</span>
  }
  if (p.exemptPct === 0) return <Badge variant="destructive">{p.tariffStatus}</Badge>
  if (p.exemptPct === 100) {
    return (
      <Badge className="border-transparent bg-(--status-good)/12 text-(--status-good)">
        {p.tariffStatus}
      </Badge>
    )
  }
  return (
    <Badge className="border-transparent bg-(--status-caution)/25 text-foreground">
      {p.tariffStatus}
    </Badge>
  )
}

function fmtChange(delta: number): string {
  const sign = delta >= 0 ? "+" : "−"
  return `${sign}${Math.abs(delta).toFixed(1)}%`
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
  out.forEach((g) => g.products.sort((a, b) => (b.shareToUS ?? 0) - (a.shareToUS ?? 0)))
  // Order groups by the U.S. import value of the tracked products in them (a
  // display ordering only — NOT a true chapter total, since products below
  // the 10% share threshold or without a price series are excluded).
  const sum = (g: Group) => g.products.reduce((n, p) => n + (p.usImportsYtd ?? 0), 0)
  out.sort((a, b) => sum(b) - sum(a))
  return out
}

// Rows shown before the "Show all" toggle kicks in. Countries can have 170+
// tracked products (Canada, Mexico), which makes the page unwieldy if
// rendered in full by default.
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
            <TableHead className="text-right">Share to U.S. ({SHARE_BASIS})</TableHead>
            <TableHead className="text-right">Tariff status</TableHead>
            <TableHead className="text-right">Price change since Mar 2025</TableHead>
            <TableHead className="text-right">
              U.S. imports ({ytdLabel(IMPORTS_YTD_THROUGH)})
            </TableHead>
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
      <TariffKey />
    </div>
  )
}

// Placeholder key until the researcher's designer supplies one.
function TariffKey() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
      <span className="font-medium">Tariff status key:</span>
      <span className="flex items-center gap-1.5">
        <Badge variant="destructive">Tariffed</Badge> no Annex II exemption
      </span>
      <span className="flex items-center gap-1.5">
        <Badge className="border-transparent bg-(--status-caution)/25 text-foreground">
          n% exempt
        </Badge>{" "}
        share of the HS4's U.S. import value that is exempt
      </span>
      <span className="flex items-center gap-1.5">
        <Badge className="border-transparent bg-(--status-good)/12 text-(--status-good)">
          Exempt
        </Badge>{" "}
        fully exempt
      </span>
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
      {group.products.map((p) => (
        <TableRow key={p.hs}>
          <TableCell className="pl-8 font-mono text-muted-foreground">{p.hs}</TableCell>
          <TableCell className="max-w-[340px] whitespace-normal">{p.name}</TableCell>
          <TableCell className="text-right">
            {p.shareToUS === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <Badge variant="secondary">{Math.round(p.shareToUS)}%</Badge>
            )}
          </TableCell>
          <TableCell className="text-right">
            <TariffBadge product={p} />
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {p.priceChangePct === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              fmtChange(p.priceChangePct)
            )}
          </TableCell>
          <TableCell className="text-right tabular-nums">
            {p.usImportsYtd === null ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              usd(p.usImportsYtd)
            )}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}
