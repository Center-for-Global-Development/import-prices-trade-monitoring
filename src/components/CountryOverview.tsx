import {
  countLabel,
  monthLabel,
  QUALIFYING_THRESHOLD,
  US_IMPORTS_LABEL,
  type CountryData,
} from "@/data/tracker"
import { Card, CardContent } from "@/components/ui/card"

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
        <div className="mt-0.5 text-xl font-semibold text-primary sm:text-2xl">{value}</div>
        {detail && (
          <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
        )}
      </CardContent>
    </Card>
  )
}

// At-a-glance country summary the researcher asked for: how much the US
// imports from the country, how much of its qualifying basket is tariffed vs
// exempt, and the freshest import-value signal. All four figures come
// precomputed on the researcher's country_summary row.
export function CountryOverview({ data }: { data: CountryData }) {
  const yoy = data.latestYoy
  const thresholdPct = Math.round(QUALIFYING_THRESHOLD * 100)

  return (
    <div className="space-y-2">
    {/* 2-up on phones, 3-up on tablets, all five in one row on desktop; gap
        stays tighter than the page's card spacing. */}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
      <Stat
        label={`US imports (${US_IMPORTS_LABEL})`}
        value={data.usImports === null ? "—" : usd(data.usImports)}
        detail="All goods, US Census"
      />
      {/* The three status tiles sit together and sum to the qualifying
          count, so readers can check the arithmetic at a glance. */}
      <Stat
        label="Tariffed products"
        value={countLabel(data.tariffedCount)}
        detail={`of ${countLabel(data.qualifyingCount)} qualifying products, no exemptions`}
      />
      <Stat
        label="Partially exempt products"
        value={countLabel(data.partialCount)}
        detail="partly exempt under Executive Orders"
      />
      <Stat
        label="Exempt products"
        value={countLabel(data.exemptCount)}
        detail="fully exempt under Executive Orders"
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
    {/* "Qualifying" is the tracker's term of art; the research lead asked
        for it to be defined where the tiles use it. */}
    <p className="text-xs text-muted-foreground">
      *Qualifying products: HS4 products for which ≥{thresholdPct}% of{" "}
      {data.name}'s exports are destined for the US.
    </p>
    </div>
  )
}
