import { hs2For, type Product } from "@/data/seriesByCountry"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

function usdBn(n: number) {
  return `$${n.toFixed(2)}B`
}

type Group = {
  code: string
  name: string
  products: Product[]
  importValueYTD: number
}

function groupByHS2(products: Product[]): Group[] {
  const groups = new Map<string, Group>()
  for (const p of products) {
    const { code, name } = hs2For(p.hs)
    let g = groups.get(code)
    if (!g) {
      g = { code, name, products: [], importValueYTD: 0 }
      groups.set(code, g)
    }
    g.products.push(p)
    g.importValueYTD += p.importValueYTD
  }
  const out = [...groups.values()]
  out.forEach((g) =>
    g.products.sort((a, b) => (b.shareToUS ?? -1) - (a.shareToUS ?? -1)),
  )
  // Order groups by total import value, descending.
  out.sort((a, b) => b.importValueYTD - a.importValueYTD)
  return out
}

export function TopProductsTable({ products }: { products: Product[] }) {
  const groups = groupByHS2(products)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[180px]">HS</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Share to U.S.</TableHead>
          <TableHead className="text-right">Current price index</TableHead>
          <TableHead className="text-right">Total import value YTD</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => (
          <HS2Group key={g.code} group={g} />
        ))}
      </TableBody>
    </Table>
  )
}

function HS2Group({ group }: { group: Group }) {
  return (
    <>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableCell className="font-mono font-medium">{group.code}</TableCell>
        <TableCell className="font-medium">{group.name}</TableCell>
        <TableCell />
        <TableCell />
        <TableCell className="text-right font-medium tabular-nums">
          {usdBn(group.importValueYTD)}
        </TableCell>
      </TableRow>
      {group.products.map((p) => {
        const last = p.priceSeries.length
          ? p.priceSeries[p.priceSeries.length - 1].idx
          : null
        return (
          <TableRow key={p.hs}>
            <TableCell className="pl-8 font-mono text-muted-foreground">{p.hs}</TableCell>
            <TableCell>{p.name}</TableCell>
            <TableCell className="text-right">
              {p.shareToUS === null ? (
                <span className="text-xs text-muted-foreground">n/a</span>
              ) : (
                <Badge variant="secondary">{Math.round(p.shareToUS * 100)}%</Badge>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {last === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                last.toFixed(1)
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{usdBn(p.importValueYTD)}</TableCell>
          </TableRow>
        )
      })}
    </>
  )
}
