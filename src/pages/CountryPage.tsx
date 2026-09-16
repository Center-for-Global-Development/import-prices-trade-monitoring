import { useEffect, useState } from "react"
import { Link, useParams, useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  countLabel,
  getCountryData,
  loadCountryData,
  COUNTRY_BY_ISO,
  monthLabel,
  PRICES_THROUGH,
  QUALIFYING_THRESHOLD,
  SHARE_BASIS,
} from "@/data/tracker"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RouteFallback } from "@/components/RouteFallback"
import { BackToCountries } from "@/components/BackToCountries"
import { TopProductsTable } from "@/components/TopProductsTable"
import { PriceTrendsChart } from "@/components/PriceTrendsChart"
import { ImportValueChart } from "@/components/ImportValueChart"
import { ProductImportChart } from "@/components/ProductImportChart"
import { CountryOverview } from "@/components/CountryOverview"

// Design-review variants for marking the country view as one unit when it is
// embedded among other content on cgdev.org (?rail=teal | ?rail=gold). The
// default renders no rail. Remove once one is chosen.
type Rail = "none" | "teal" | "gold"

function useRail(): Rail {
  const [params] = useSearchParams()
  const v = params.get("rail")
  return v === "teal" || v === "gold" ? v : "none"
}

export function CountryPage() {
  const { iso = "" } = useParams()
  return <CountryContent key={iso.toUpperCase()} iso={iso.toUpperCase()} />
}

function CountryContent({ iso }: { iso: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [attempt, setAttempt] = useState(0)
  const rail = useRail()
  useEffect(() => {
    let cancelled = false
    loadCountryData(iso).then(
      () => { if (!cancelled) setStatus("ready") },
      () => { if (!cancelled) setStatus("error") },
    )
    return () => { cancelled = true }
  }, [iso, attempt])
  if (COUNTRY_BY_ISO[iso] && status !== "ready") {
    if (status === "loading") {
      return <RouteFallback>Loading {COUNTRY_BY_ISO[iso].name}…</RouteFallback>
    }
    // The error state keeps its natural height: it is where navigation stops,
    // so padding it out to a full screen would just look broken.
    return (
      <div className="space-y-3" role="status">
        <p>Could not load country data. Please try again.</p>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => { setStatus("loading"); setAttempt((n) => n + 1) }}>Retry</Button>
          <BackToCountries />
        </div>
      </div>
    )
  }
  const data = getCountryData(iso)

  if (!data) {
    return (
      <div>
        <p>Country not found.</p>
        <Link to="/" className="underline">
          Back to home
        </Link>
      </div>
    )
  }

  const thresholdPct = Math.round(QUALIFYING_THRESHOLD * 100)
  // The tracker follows products it can price: the researcher's file already
  // restricts country_product rows to qualifying HS4s with a BLS import price
  // index. The rest of the qualifying basket is only a count.
  const priced = data.products

  return (
    // No outer padding or max-width: this is the inside of an iframe on
    // cgdev.org and the host page's column already provides the margins.
    <div
      className={cn(
        "space-y-6 sm:space-y-8",
        // Both rails run the whole view, back button to back button, so the
        // tool's start and end are both marked.
        // teal: 4px in the primary heading color.
        rail === "teal" && "border-l-4 border-primary pl-3 sm:pl-6",
        // gold: the site's 8px standfirst treatment.
        rail === "gold" && "border-l-8 border-(--cgd-gold) pl-3 sm:pl-6"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <BackToCountries className="mb-3" />
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            {data.name}
          </h1>
          {/* The gold rail already supplies the gold accent. */}
          {rail !== "gold" && (
            <div className="mt-2 mb-2 h-1 w-12 rounded-full bg-(--cgd-gold)" />
          )}
          <p className={cn("font-serif", rail === "gold" && "mt-2")}>
            US import prices &amp; trade flows
          </p>
        </div>
      </div>

      <CountryOverview data={data} />

      <Card>
        <CardHeader>
          <CardTitle>{data.name}: Price trends</CardTitle>
          <CardDescription>
            US Bureau of Labor Statistics (BLS) import price indexes, 
            monthly from Jan 2023 or the earliest
            available month through {monthLabel(PRICES_THROUGH)}, indexed to
            March 2025 = 100. BLS indexes cover all US imports of a
            product, not imports from {data.name} alone.{" "}
            <strong>
              Only products with a BLS import price index can be shown, so
              the number of products displayed here ({priced.length}) may be lower than
              the number that otherwise qualify for inclusion (
              {countLabel(data.qualifyingCount)}).
            </strong>{" "}
            Multi-select to compare products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {priced.length === 0 ? (
            <p className="text-sm text-muted-foreground">No qualifying products to plot.</p>
          ) : (
            <PriceTrendsChart products={priced} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{data.name}: Import value</CardTitle>
          <CardDescription>
            Cumulative year-to-date US goods imports from {data.name}, each
            month showing the year so far vs the same months a year earlier
            (US Census).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.importValue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No monthly Census import value data for {data.name}.
            </p>
          ) : (
            <ImportValueChart data={data.importValue} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{data.name}: Import value by product</CardTitle>
          <CardDescription>
            Cumulative year-to-date US imports of each tracked product from{" "}
            {data.name}, each month showing the year so far vs the same months
            a year earlier (US Census). Products with no imports in the
            year-earlier months have no comparison and are left out.
            Multi-select to compare products. The products shown for each country
            may differ from those in the “Price trends” tracker because the two
            trackers use different databases (US Census and BLS, respectively).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {priced.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked products to plot.</p>
          ) : (
            <ProductImportChart iso={data.iso} products={priced} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{data.name}: Tracked products</CardTitle>
          <CardDescription>
            HS4 products with a BLS import price index where ≥{thresholdPct}% of{" "}
            {data.name}'s exports went to the US in {SHARE_BASIS} ({priced.length} of{" "}
            {countLabel(data.qualifyingCount)} qualifying products). Export shares
            are from Observatory of Economic Complexity bilateral trade data for {SHARE_BASIS}. Tariff status is the
            import-value-weighted share of the HS4 exempt under Executive Orders
            (0% = fully tariffed, 100% = not tariffed).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {priced.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None of {data.name}'s {countLabel(data.qualifyingCount)} qualifying
              products have a BLS import price index.
            </p>
          ) : (
            <TopProductsTable products={priced} />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center pt-2">
        <BackToCountries />
      </div>
    </div>
  )
}
