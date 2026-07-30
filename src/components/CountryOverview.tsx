import {
  importsInYear,
  latestImportYoY,
  type CountryData,
} from "@/data/tracker"
import { Card, CardContent } from "@/components/ui/card"

// The year the headline import total covers. 2024 per the researcher's ask,
// which also matches the OEC share year the product selection uses.
const IMPORTS_YEAR = 2024

function usdBn(n: number): string {
  if (n >= 1) return `$${n.toFixed(1)}B`
  if (n >= 0.001) return `$${(n * 1000).toFixed(0)}M`
  return `$${(n * 1e6).toFixed(0)}K`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-")
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${names[parseInt(m, 10) - 1]} ${y}`
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <Card className="py-3 sm:py-4">
      <CardContent className="px-3 sm:px-4">
        <div className="text-xs text-muted-foreground sm:text-sm">{label}</div>
        <div className="mt-0.5 text-xl font-semibold sm:text-2xl">{value}</div>
        {detail && (
          <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
        )}
      </CardContent>
    </Card>
  )
}

// At-a-glance country summary the researcher asked for: how much the U.S.
// imports from the country, how much of its qualifying basket is tariffed vs
// exempt, and the freshest import-value signal.
export function CountryOverview({ data }: { data: CountryData }) {
  const total = importsInYear(data.importValue, IMPORTS_YEAR)
  const yoy = latestImportYoY(data.importValue)
  const tariffed = data.products.filter((p) => p.exemptPct === 0).length
  const exempt = data.products.filter((p) => p.exemptPct === 100).length

  return (
    // 2-up even on phones (the tiles are compact enough), 4-up once the
    // full-width row fits; gap stays tighter than the page's card spacing.
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <Stat
        label={`U.S. imports (${IMPORTS_YEAR})`}
        value={total === null ? "—" : usdBn(total)}
        detail="All goods, U.S. Census"
      />
      <Stat
        label="Tariffed products"
        value={String(tariffed)}
        detail={`of ${data.products.length} qualifying, no Annex II exemption`}
      />
      <Stat
        label="Exempt products"
        value={String(exempt)}
        detail="fully exempt under Annex II"
      />
      <Stat
        label="Imports YTD vs year earlier"
        value={
          yoy === null
            ? "—"
            : `${yoy.pct >= 0 ? "+" : "−"}${Math.abs(yoy.pct).toFixed(1)}%`
        }
        detail={
          yoy === null
            ? "no year-earlier period to compare"
            : `cumulative through ${monthLabel(yoy.month)}`
        }
      />
    </div>
  )
}
