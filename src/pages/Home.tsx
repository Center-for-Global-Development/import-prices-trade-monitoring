import { useNavigate } from "react-router-dom"
import { COUNTRIES } from "@/data/tracker"
import { WorldMap } from "@/components/WorldMap"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

export function Home() {
  const navigate = useNavigate()
  return (
    <div className="container mx-auto max-w-5xl p-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        US Import Price and Value Tracker
      </h1>
      <p className="mt-2 text-muted-foreground">
        U.S. import prices and trade flows for products where the U.S. is a major
        export market. Pick a country to open its dashboard.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Country</CardTitle>
          <CardDescription>
            {COUNTRIES.length} countries with at least one product sending ≥10% of
            its exports to the U.S. Click the map or search the list — smaller
            territories appear in the list only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <WorldMap />
          <Command className="rounded-md border">
            <CommandInput placeholder="Search countries..." />
            <CommandList className="max-h-96">
              <CommandEmpty>No country found.</CommandEmpty>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.iso}
                  value={c.name}
                  onSelect={() => navigate(`/country/${c.iso}`)}
                  className="flex justify-between"
                >
                  <span>{c.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.tariffedCount} tariffed · {c.exemptCount} exempt
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </CardContent>
      </Card>
    </div>
  )
}
