import { useMemo, useState } from "react"
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
import { GLOSSARY, type TermId } from "@/data/glossary"
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react"
import { trackEngagement } from "@/lib/tracking"

function usd(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

// CGD stoplight palette: tariffed = bad, partially exempt = caution, fully
// exempt = good. All three are solid fills so they read as three distinct
// statuses at a glance (researchers found the earlier pale tints for exempt
// and partial too close to each other and to the share pills). The label
// text is the researcher's preformatted tariff_status; the numeric exempt
// share only picks the colour. Meaning is carried by the label, never colour
// alone.
type Status = "T" | "P" | "E"

function statusOf(p: Product): Status | null {
  if (p.exemptPct === null) return null
  return p.exemptPct === 0 ? "T" : p.exemptPct === 100 ? "E" : "P"
}

const STATUS_BADGE: Record<Status, string> = {
  T: "border-transparent bg-(--status-bad) text-white",
  P: "border-transparent bg-(--status-caution) text-foreground",
  E: "border-transparent bg-(--status-good) text-white",
}

function TariffBadge({ product: p }: { product: Product }) {
  const status = statusOf(p)
  if (status === null) {
    return <span className="text-xs text-muted-foreground">{p.tariffStatus || "n/a"}</span>
  }
  return <Badge className={STATUS_BADGE[status]}>{p.tariffStatus}</Badge>
}

// Share of exports to the US on a light-to-dark teal scale so high and low
// shares stand apart. Tracked products all clear the qualifying threshold,
// so the bins span 10–100%. Stepped rather than continuous: every mid-range
// teal is too dark for dark text and too light for white at badge size, so
// the steps skip that band and each label holds ≥4.5:1. The number stays
// printed, so colour is never the only cue.
const SHARE_BINS: { min: number; background: string; color: string }[] = [
  { min: 90, background: "var(--cgd-teal)", color: "#ffffff" },
  { min: 70, background: "color-mix(in srgb, var(--cgd-light-teal) 88%, var(--card))", color: "#ffffff" },
  { min: 50, background: "color-mix(in srgb, var(--cgd-light-teal) 45%, var(--card))", color: "var(--foreground)" },
  { min: 30, background: "color-mix(in srgb, var(--cgd-light-teal) 28%, var(--card))", color: "var(--foreground)" },
  { min: 0, background: "color-mix(in srgb, var(--cgd-light-teal) 12%, var(--card))", color: "var(--foreground)" },
]
const shareBin = (pct: number) => SHARE_BINS.find((b) => pct >= b.min) ?? SHARE_BINS[SHARE_BINS.length - 1]

function ShareBadge({ pct }: { pct: number }) {
  return (
    <Badge className="border-transparent tabular-nums" style={shareBin(pct)}>
      {Math.round(pct)}%
    </Badge>
  )
}

// The researcher's average_tariff_pct is the mean of the HS10 rates under
// the HS4 for this country, so it can land on 8.33 or 4.17; one decimal is
// enough for reading across rows. The header carries the "%" unit.
function fmtRate(pct: number): string {
  return pct.toFixed(1)
}

// ---------------------------------------------------------------- sorting

type SortKey = "hs" | "name" | "share" | "tariff" | "rate" | "imports"
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
  rate: "desc",
  imports: "desc",
}

const VALUE: Record<SortKey, (p: Product) => string | number | null> = {
  hs: (p) => p.hs,
  name: (p) => p.name,
  share: (p) => p.shareToUS,
  tariff: (p) => p.exemptPct,
  rate: (p) => p.avgTariffPct,
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

// ---------------------------------------------------------------- filtering

type StatusFilter = "all" | Status

// `track` is the analytics value (see TRACKING.md).
const STATUS_FILTERS: { value: StatusFilter; label: string; track: string }[] = [
  { value: "all", label: "All", track: "all" },
  { value: "T", label: "Tariffed", track: "tariffed" },
  { value: "P", label: "Partially exempt", track: "partially_exempt" },
  { value: "E", label: "Exempt", track: "exempt" },
]

// Digits match HS codes from the start (so "07" finds chapter 07 and "0702"
// one product); anything else matches within the product name.
function matchesQuery(p: Product, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (/^\d+$/.test(q)) return p.hs.startsWith(q)
  return p.name.toLowerCase().includes(q) || p.hs.startsWith(q)
}

// ---------------------------------------------------------------- table

export function TopProductsTable({ products: all }: { products: Product[] }) {
  const [showAll, setShowAll] = useState(false)
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")

  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: all.length, T: 0, P: 0, E: 0 }
    for (const p of all) {
      const s = statusOf(p)
      if (s) c[s]++
    }
    return c
  }, [all])

  const products = all.filter(
    (p) => (status === "all" || statusOf(p) === status) && matchesQuery(p, query),
  )
  const filtered = products.length !== all.length

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

  const onSort = (key: SortKey) => {
    const dir = sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : FIRST_DIR[key]
    trackEngagement("view_control", "table_sort", `${key}_${dir}`)
    setSort({ key, dir })
  }

  // Search text is free input, so it is never sent. One event marks the
  // start of each search (the box going from empty to non-empty).
  const onQuery = (next: string) => {
    if (!query.trim() && next.trim()) trackEngagement("filter", "table_search")
    setQuery(next)
  }

  const grouped = sort.key === "hs"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Search by HS code or product name</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search HS code or product"
            className="h-8 w-full rounded-md border border-input bg-transparent pr-3 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </label>
        <div
          role="radiogroup"
          aria-label="Filter by tariff status"
          className="flex flex-wrap gap-1.5"
        >
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              role="radio"
              aria-checked={status === f.value}
              variant={status === f.value ? "default" : "outline"}
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => {
                if (f.value !== status) trackEngagement("filter", "table_status_filter", f.track)
                setStatus(f.value)
              }}
            >
              {f.label} ({statusCounts[f.value]})
            </Button>
          ))}
        </div>
      </div>
      {filtered && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {products.length} of {all.length} products match.
        </p>
      )}
      {products.length > 0 && (
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
                <sup className="font-normal">1</sup>
              </SortHead>
              <SortHead col="tariff" sort={sort} onSort={onSort} align="right">
                Tariff status
              </SortHead>
              <SortHead col="rate" sort={sort} onSort={onSort} align="right" wrap>
                Average tariff rate at the HS4 level (%)
                <sup className="font-normal">2</sup>
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
      )}
      {hiddenCount > 0 && (
        <Button variant="outline" size="sm" onClick={() => {
          trackEngagement("detail_open", "table_show_all")
          setShowAll(true)
        }}>
          Show all {products.length} products ({hiddenCount} more)
        </Button>
      )}
      {showAll && products.length > COLLAPSED_ROW_TARGET && (
        <Button variant="ghost" size="sm" onClick={() => {
          trackEngagement("detail_close", "table_show_all")
          setShowAll(false)
        }}>
          Collapse
        </Button>
      )}
      <TariffKey />
      <ValueKey />
      {/* Footnotes are numbered in column reading order, so the share note
          comes before the tariff-rate note. */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <p>
          <sup>1</sup> The percentage of the country's exports of that HS4
          product that were sold to the United States in {SHARE_BASIS}.
        </p>
        <p>
          <sup>2</sup> For every specified country-HS4 combination, the figure
          represents the average of the underlying HS10 tariff rates.
        </p>
      </div>
    </div>
  )
}

// Clickable column header. The whole cell is the button so the hit target is
// generous; aria-sort tells screen readers the current order. `wrap` lets a
// long label break onto two lines instead of widening the table; the label
// is one span so a footnote marker stays after the text in the reversed
// (right-aligned) flex row.
function SortHead({
  col,
  sort,
  onSort,
  align,
  wrap,
  className,
  children,
}: {
  col: SortKey
  sort: Sort
  onSort: (key: SortKey) => void
  align?: "right"
  wrap?: boolean
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
          "inline-flex items-center gap-1 hover:text-foreground",
          wrap ? "whitespace-normal" : "whitespace-nowrap",
          align === "right" ? "flex-row-reverse text-right" : "",
          active ? "text-foreground" : "",
        ].join(" ")}
      >
        <span>{children}</span>
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
          <span className="text-muted-foreground">n/a</span>
        ) : (
          <ShareBadge pct={p.shareToUS} />
        )}
      </TableCell>
      <TableCell className="text-right">
        <TariffBadge product={p} />
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {p.avgTariffPct === null ? (
          <span className="text-muted-foreground">n/a</span>
        ) : (
          fmtRate(p.avgTariffPct)
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {p.usImportsYtd === null ? (
          <span className="text-muted-foreground">n/a</span>
        ) : (
          usd(p.usImportsYtd)
        )}
      </TableCell>
    </TableRow>
  )
}

// Researchers asked for the key to carry only the missing-value mark
// (Sep 2026 beta feedback).
function ValueKey() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="font-medium">Value key:</span>
      <span>n/a = not available</span>
    </div>
  )
}

// Placeholder key until the researcher's designer supplies one. The text is
// the shared glossary definition, the same one the status-word popovers show.
const KEY_ROWS: { status: Status; badge: string; term: TermId }[] = [
  { status: "T", badge: "Tariffed", term: "tariffed" },
  { status: "P", badge: "n% exempt", term: "partial" },
  { status: "E", badge: "Exempt", term: "exempt" },
]

function TariffKey() {
  return (
    <div className="space-y-1.5 border-t pt-3 text-xs text-muted-foreground">
      <div className="font-medium">Tariff status key:</div>
      {KEY_ROWS.map((r) => (
        <div key={r.status} className="flex items-start gap-2">
          <Badge className={[STATUS_BADGE[r.status], "w-20 shrink-0"].join(" ")}>
            {r.badge}
          </Badge>
          <span>{GLOSSARY[r.term].definition}</span>
        </div>
      ))}
    </div>
  )
}
