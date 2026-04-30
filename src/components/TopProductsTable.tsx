import type { Product } from "@/data/seriesByCountry"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

function pct(n: number, digits = 1) {
  const sign = n > 0 ? "+" : ""
  return `${sign}${n.toFixed(digits)}%`
}

export function TopProductsTable({ products }: { products: Product[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>HS4</TableHead>
          <TableHead>Product</TableHead>
          <TableHead className="text-right">Share to U.S.</TableHead>
          <TableHead className="text-right">Latest index</TableHead>
          <TableHead className="text-right">YTD %</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((p) => {
          const last = p.priceSeries[p.priceSeries.length - 1].idx
          const ytd = ((last - 100) / 100) * 100
          return (
            <TableRow key={p.hs}>
              <TableCell className="font-mono">{p.hs}</TableCell>
              <TableCell>{p.name}</TableCell>
              <TableCell className="text-right">
                <Badge variant="secondary">{Math.round(p.shareToUS * 100)}%</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{last.toFixed(1)}</TableCell>
              <TableCell className="text-right tabular-nums">{pct(ytd)}</TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
