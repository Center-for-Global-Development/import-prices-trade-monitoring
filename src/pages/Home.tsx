import { Link } from "react-router-dom"
import { COUNTRIES } from "@/data/countries"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useNavigate } from "react-router-dom"

export function Home() {
  const navigate = useNavigate()
  return (
    <div className="container mx-auto max-w-3xl p-8">
      <h1 className="text-3xl font-semibold tracking-tight">U.S. Import Price & Trade Tracker</h1>
      <p className="mt-2 text-muted-foreground">
        Pick a country to see its U.S. import-price trends and trade flows.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Country</CardTitle>
          <CardDescription>Select a country to open its dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Select onValueChange={(iso) => navigate(`/country/${iso}`)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a country..." />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.iso} value={c.iso}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COUNTRIES.map((c) => (
              <Link
                key={c.iso}
                to={`/country/${c.iso}`}
                className="rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
