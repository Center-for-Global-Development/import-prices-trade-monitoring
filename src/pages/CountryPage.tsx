import { Link, useParams } from "react-router-dom"
import { COUNTRIES } from "@/data/countries"
import {
  getCountryData,
  qualifyingProducts,
  QUALIFYING_THRESHOLD,
} from "@/data/seriesByCountry"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"
import { TopProductsTable } from "@/components/TopProductsTable"
import { PriceTrendsChart } from "@/components/PriceTrendsChart"
import { ImportValueChart } from "@/components/ImportValueChart"

export function CountryPage() {
  const { iso = "" } = useParams()
  const country = COUNTRIES.find((c) => c.iso === iso)
  const data = getCountryData(iso)

  if (!country || !data) {
    return (
      <div className="container mx-auto max-w-3xl p-8">
        <p>Country not found.</p>
        <Link to="/" className="underline">
          Back to home
        </Link>
      </div>
    )
  }

  const qualifying = qualifyingProducts(data)
  const thresholdPct = Math.round(QUALIFYING_THRESHOLD * 100)

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
          <h1 className="text-3xl font-semibold tracking-tight">{country.name}</h1>
          <p className="text-muted-foreground">
            U.S. import prices &amp; trade flows · ISO {country.iso}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top products</CardTitle>
          <CardDescription>
            HS4 products where ≥{thresholdPct}% of {country.name}'s exports go to the U.S.
            ({qualifying.length} of {data.products.length} products)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {qualifying.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No products meet the {thresholdPct}% threshold for {country.name}.
            </p>
          ) : (
            <TopProductsTable products={qualifying} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Price trends</CardTitle>
          <CardDescription>
            BLS import price indices, monthly. Multi-select to compare products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {qualifying.length === 0 ? (
            <p className="text-sm text-muted-foreground">No qualifying products to plot.</p>
          ) : (
            <PriceTrendsChart products={qualifying} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import value</CardTitle>
          <CardDescription>
            Year-over-year change in cumulative YTD U.S. imports from {country.name}, 2025 vs 2026.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportValueChart data={data.importValue} />
        </CardContent>
      </Card>
    </div>
  )
}
