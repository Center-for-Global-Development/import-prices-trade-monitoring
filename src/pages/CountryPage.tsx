import { Link, useParams } from "react-router-dom"
import {
  getCountryData,
  QUALIFYING_THRESHOLD,
  SHARE_YEAR,
} from "@/data/tracker"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { TopProductsTable } from "@/components/TopProductsTable"
import { PriceTrendsChart } from "@/components/PriceTrendsChart"
import { ImportValueChart } from "@/components/ImportValueChart"

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
  const withPrice = data.products.filter((p) => p.hasPriceSeries).length

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
          <h1 className="text-3xl font-semibold tracking-tight">{data.name}</h1>
          <p className="text-muted-foreground">
            U.S. import prices &amp; trade flows · ISO {data.iso}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tracked products</CardTitle>
          <CardDescription>
            HS4 products where ≥{thresholdPct}% of {data.name}'s exports went to
            the U.S. in {SHARE_YEAR} ({data.products.length} products, {withPrice} with
            a BLS price series). Tariff status is the import-value-weighted share
            of the HS4 exempt under Annex II.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products meet the {thresholdPct}% threshold for {data.name}.
            </p>
          ) : (
            <TopProductsTable products={data.products} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price trends</CardTitle>
          <CardDescription>
            BLS import price indices, monthly since Jan 2023, indexed to March
            2025 = 100. BLS indices cover all U.S. imports of a product, not
            imports from {data.name} alone. Multi-select to compare products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.products.length === 0 ? (
            <p className="text-sm text-muted-foreground">No qualifying products to plot.</p>
          ) : (
            <PriceTrendsChart products={data.products} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import value</CardTitle>
          <CardDescription>
            Year-over-year change in monthly U.S. goods imports from {data.name},
            each month vs the same month a year earlier (U.S. Census).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.importValue.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Monthly Census import values haven't been pulled for {data.name} yet
              — currently available for the 10 pilot countries only.
            </p>
          ) : (
            <ImportValueChart data={data.importValue} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
