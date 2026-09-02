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
      <Card>
        <CardHeader>
          <CardTitle>Country</CardTitle>
          <CardDescription>
            {COUNTRIES.length} countries with at least one product sending ≥10%
            of its estimated exports to the US. Click the
            map or search the list — smaller territories appear in the list
            only.
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
                    {c.tariffedCount} tariffed · {c.partialCount} partially exempt ·{" "}
                    {c.exemptCount} exempt
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
