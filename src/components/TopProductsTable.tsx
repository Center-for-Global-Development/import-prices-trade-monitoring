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
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

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

// ---------------------------------------------------------------- sorting

type SortKey = "hs" | "name" | "share" | "tariff" | "price" | "imports"
type Dir = "asc" | "desc"
type Sort = { key: SortKey; dir: Dir }

// HS code order is the default (the research lead's ask), and the only order
// in which the HS2 chapter rows make sense as containers.
const DEFAULT_SORT: Sort = { key: "hs", dir: "asc" }

// Direction a column starts in when first clicked: biggest-first for the
// numeric columns, A→Z / 00→99 for text and codes, tariffed-first for status.
const FIRST_DIR: Record<SortKey, Dir> = {
  hs: "asc",
  name: "asc",
  share: "desc",
  tariff: "asc",
  price: "desc",
  imports: "desc",
}

const VALUE: Record<SortKey, (p: Product) => string | number | null> = {
  hs: (p) => p.hs,
  name: (p) => p.name,
  share: (p) => p.shareToUS,
  tariff: (p) => p.exemptPct,
  price: (p) => p.priceChangePct,
  imports: (p) => p.usImportsYtd,
}

function sortProducts(products: Product[], sort: Sort): Product[] {
  const get = VALUE[sort.key]
  const sign = sort.dir === "asc" ? 1 : -1
  return [...products].sort((a, b) => {
    const va = get(a)
    const vb = get(b)
    // Missing values sink to the bottom whichever way the column is sorted.
    if (va === null && vb === null) return a.hs.localeCompare(b.hs)
    if (va === null) return 1
    if (vb === null) return -1
    const cmp =
      typeof va === "number" && typeof vb === "number"
        ? va - vb
        : String(va).localeCompare(String(vb))
    return cmp !== 0 ? sign * cmp : a.hs.localeCompare(b.hs)
  })
}

// Rows shown before the "Show all" toggle kicks in. Countries can have 170+
// tracked products (Canada, Mexico), which makes the page unwieldy if
// rendered in full by default. Under a column sort this doubles as a
// "top 20 by …" view.
const COLLAPSED_ROW_TARGET = 20

// A display row: either an HS2 chapter header (only in HS order) or a product.
type Row =
  | { kind: "chapter"; code: string; name: string }
  | { kind: "product"; product: Product }

function buildRows(products: Product[], sort: Sort): Row[] {
  const sorted = sortProducts(products, sort)
  if (sort.key !== "hs") return sorted.map((product) => ({ kind: "product", product }))
  // Grouped: a chapter row precedes the first product of each HS2. Products
  // are already in code order, so chapters fall out in order too.
  const rows: Row[] = []
  let current: string | null = null
  for (const product of sorted) {
    const { code, name } = hs2For(product.hs)
    if (code !== current) {
      rows.push({ kind: "chapter", code, name })
      current = code
    }
    rows.push({ kind: "product", product })
  }
  return rows
}

// ---------------------------------------------------------------- table

export function TopProductsTable({ products }: { products: Product[] }) {
  const [showAll, setShowAll] = useState(false)
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT)

  const rows = buildRows(products, sort)
  let visible = rows
  if (!showAll) {
    // Count only product rows against the target so chapter headers don't
    // eat into the 20.
    visible = []
    let remaining = COLLAPSED_ROW_TARGET
    for (const r of rows) {
      if (r.kind === "product") {
        if (remaining <= 0) break
        remaining--
      }
      visible.push(r)
    }
  }
  const shown = visible.filter((r) => r.kind === "product").length
  const hiddenCount = products.length - shown

  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: FIRST_DIR[key] },
    )

  const grouped = sort.key === "hs"

  return (
    <div className="space-y-3">
      <Table>
        <TableHeader>
          <TableRow>
            <SortHead className="w-[80px]" col="hs" sort={sort} onSort={onSort}>
              HS
            </SortHead>
            <SortHead col="name" sort={sort} onSort={onSort}>
              Product
            </SortHead>
            <SortHead col="share" sort={sort} onSort={onSort} align="right">
              Share of exports to the US ({SHARE_BASIS})
            </SortHead>
            <SortHead col="tariff" sort={sort} onSort={onSort} align="right">
              Tariff status
            </SortHead>
            <SortHead col="price" sort={sort} onSort={onSort} align="right">
              Price change since Mar 2025
            </SortHead>
            <SortHead col="imports" sort={sort} onSort={onSort} align="right">
              US imports ({ytdLabel(IMPORTS_YTD_THROUGH)})
            </SortHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((r) =>
            r.kind === "chapter" ? (
              <TableRow key={`ch-${r.code}`} className="bg-muted/50 hover:bg-muted/50">
                <TableCell className="font-mono font-medium">{r.code}</TableCell>
                <TableCell className="font-medium" colSpan={5}>
                  {r.name}
                </TableCell>
              </TableRow>
            ) : (
              <ProductRow key={r.product.hs} product={r.product} indented={grouped} />
            ),
          )}
        </TableBody>
      </Table>
      {hiddenCount > 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
          Show all {products.length} products ({hiddenCount} more)
        </Button>
      )}
      {showAll && products.length > COLLAPSED_ROW_TARGET && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll(false)}>
          Collapse
        </Button>
      )}
      <TariffKey />
    </div>
  )
}

// Clickable column header. The whole cell is the button so the hit target is
// generous; aria-sort tells screen readers the current order.
function SortHead({
  col,
  sort,
  onSort,
  align,
  className,
  children,
}: {
  col: SortKey
  sort: Sort
  onSort: (key: SortKey) => void
  align?: "right"
  className?: string
  children: React.ReactNode
}) {
  const active = sort.key === col
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown
  return (
    <TableHead
      className={[className ?? "", align === "right" ? "text-right" : ""].join(" ")}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={[
          "inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground",
          align === "right" ? "flex-row-reverse" : "",
          active ? "text-foreground" : "",
        ].join(" ")}
      >
        {children}
        <Icon
          className={["h-3.5 w-3.5 shrink-0", active ? "" : "opacity-40"].join(" ")}
          aria-hidden="true"
        />
      </button>
    </TableHead>
  )
}

function ProductRow({ product: p, indented }: { product: Product; indented: boolean }) {
  return (
    <TableRow>
      <TableCell
        className={["font-mono text-muted-foreground", indented ? "pl-8" : ""].join(" ")}
      >
        {p.hs}
      </TableCell>
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
  )
}

// Placeholder key until the researcher's designer supplies one.
function TariffKey() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
      <span className="font-medium">Tariff status key:</span>
      <span className="flex items-center gap-1.5">
        <Badge variant="destructive">Tariffed</Badge> no exemption under Executive Orders
      </span>
      <span className="flex items-center gap-1.5">
        <Badge className="border-transparent bg-(--status-caution)/25 text-foreground">
          n% exempt
        </Badge>{" "}
        share of the HS4's US import value that is exempt
      </span>
      <span className="flex items-center gap-1.5">
        <Badge className="border-transparent bg-(--status-good)/12 text-(--status-good)">
          Exempt
        </Badge>{" "}
        fully exempt under Executive Orders
      </span>
    </div>
  )
}
