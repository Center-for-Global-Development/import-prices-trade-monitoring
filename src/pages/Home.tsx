import { useNavigate } from "react-router-dom"
import { COUNTRIES, countLabel } from "@/data/tracker"
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
  // No outer padding or max-width: this is the inside of an iframe on
  // cgdev.org and the host page's column already provides the margins.
  return (
    <Card>
      <CardHeader>
        <CardTitle>Country</CardTitle>
        <CardDescription>
          {COUNTRIES.length} countries with at least one product sending ≥10%
          of its estimated exports to the US. Search the list or click the
          map (zoom in for smaller countries) — the smallest territories only
          appear in the list.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Command className="rounded-md border">
          <CommandInput placeholder="Search countries..." />
          <CommandList className="max-h-96">
            <CommandEmpty>No country found.</CommandEmpty>
            {COUNTRIES.map((c) => (
              <CommandItem
                key={c.iso}
                value={c.name}
                onSelect={() => navigate(`/country/${c.iso}`)}
                className="flex flex-wrap justify-between gap-x-3 gap-y-1"
              >
                <span>{c.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {countLabel(c.tariffedCount)} tariffed ·{" "}
                  {countLabel(c.partialCount)} partially exempt ·{" "}
                  {countLabel(c.exemptCount)} exempt
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        <WorldMap />
      </CardContent>
    </Card>
  )
}
