import { monthLabel, type CountryData } from "@/data/tracker"
import { Card, CardContent } from "@/components/ui/card"

// The year the headline import total covers — fixed by the researcher's file
// (us_imports_2024), and the same year the OEC export shares use.
const IMPORTS_YEAR = 2024

function usd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`
  return `$${(n / 1e3).toFixed(0)}K`
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
// exempt, and the freshest import-value signal. All four figures come
// precomputed on the researcher's country_summary row.
export function CountryOverview({ data }: { data: CountryData }) {
  const yoy = data.latestYoy

  return (
    // 2-up even on phones (the tiles are compact enough), 4-up once the
    // full-width row fits; gap stays tighter than the page's card spacing.
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <Stat
        label={`U.S. imports (${IMPORTS_YEAR})`}
        value={data.usImports2024 === null ? "—" : usd(data.usImports2024)}
        detail="All goods, U.S. Census"
      />
      <Stat
        label="Tariffed products"
        value={String(data.tariffedCount)}
        detail={`of ${data.qualifyingCount} qualifying, no Annex II exemption`}
      />
      <Stat
        label="Exempt products"
        value={String(data.exemptCount)}
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
