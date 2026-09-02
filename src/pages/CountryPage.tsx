import { Link, useParams } from "react-router-dom"
import {
  getCountryData,
  IMPORTS_YTD_THROUGH,
  monthLabel,
  PRICES_THROUGH,
  QUALIFYING_THRESHOLD,
  SHARE_BASIS,
  ytdLabel,
} from "@/data/tracker"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { TopProductsTable } from "@/components/TopProductsTable"
import { PriceTrendsChart } from "@/components/PriceTrendsChart"
import { ImportValueChart } from "@/components/ImportValueChart"
import { ProductImportChart } from "@/components/ProductImportChart"
import { CountryOverview } from "@/components/CountryOverview"

export function CountryPage() {
  const { iso = "" } = useParams()
  const data = getCountryData(iso.toUpperCase())

  if (!data) {
    return (
      <div className="container mx-auto max-w-3xl p-8">
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
    <div className="container mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
            <Link to="/">
              <ChevronLeft className="mr-1 h-4 w-4" />
              All countries
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight text-primary">
            {data.name}
          </h1>
          <div className="mt-2 mb-2 h-1 w-12 rounded-full bg-(--cgd-gold)" />
          <p className="font-serif text-muted-foreground">
            US import prices &amp; trade flows
          </p>
        </div>
      </div>

      <CountryOverview data={data} />

      <Card>
        <CardHeader>
          <CardTitle>Price trends</CardTitle>
          <CardDescription>
            BLS import price indices, monthly from Jan 2023 or the earliest
            available month through {monthLabel(PRICES_THROUGH)}, indexed to
            March 2025 = 100. BLS indices cover all US imports of a
            product, not imports from {data.name} alone. Multi-select to compare
            products.
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
          <CardTitle>Import value</CardTitle>
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
          <CardTitle>Import value by product</CardTitle>
          <CardDescription>
            US imports of each tracked product from {data.name} (US Census).
            The current data carries a single cumulative{" "}
            {ytdLabel(IMPORTS_YTD_THROUGH)} value per product, so each product
            appears as one point; monthly history would turn these into lines
            like the country total above. Multi-select to compare products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {priced.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracked products to plot.</p>
          ) : (
            <ProductImportChart products={priced} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tracked products</CardTitle>
          <CardDescription>
            HS4 products with a BLS import price index where ≥{thresholdPct}% of{" "}
            {data.name}'s exports went to the US in {SHARE_BASIS} ({priced.length} of{" "}
            {data.qualifyingCount} qualifying products). Export shares are from
            OEC bilateral trade data for {SHARE_BASIS}. Tariff status is the
            import-value-weighted share of the HS4 exempt under Executive Orders.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {priced.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              None of {data.name}'s {data.qualifyingCount} qualifying products
              have a BLS import price index.
            </p>
          ) : (
            <TopProductsTable products={priced} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
