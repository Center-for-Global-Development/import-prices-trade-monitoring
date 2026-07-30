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
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        {detail && (
          <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        label="Import value YoY"
        value={
          yoy === null
            ? "—"
            : `${yoy.pct >= 0 ? "+" : "−"}${Math.abs(yoy.pct).toFixed(1)}%`
        }
        detail={
          yoy === null
            ? "no year-earlier month to compare"
            : `${monthLabel(yoy.month)} vs a year earlier`
        }
      />
    </div>
  )
}
