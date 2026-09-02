import type { Product } from "@/data/tracker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"

// Add/drop product selector shared by the per-product charts (price trends,
// import value). Selection state lives in the parent so each chart keeps its
// own set.
export function ProductPicker({
  products,
  selected,
  onToggle,
}: {
  products: Product[]
  selected: string[]
  onToggle: (hs: string) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {selected.length} of {products.length} products
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <div className="text-sm font-medium">Show products</div>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {products.map((p) => (
              <label
                key={p.hs}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <Checkbox
                  checked={selected.includes(p.hs)}
                  onCheckedChange={() => onToggle(p.hs)}
                />
                <span className="font-mono text-xs">{p.hs}</span>
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
