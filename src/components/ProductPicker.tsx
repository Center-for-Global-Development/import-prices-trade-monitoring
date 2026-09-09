import type { Product } from "@/data/tracker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"

export type QuickSelect = { label: string; hs: string[] }

// Add/drop product selector shared by the per-product charts (price trends,
// import value). Selection state lives in the parent so each chart keeps its
// own set. Optional extras: a short tag per product (e.g. tariff status
// letter) and quick-select buttons that replace the whole selection.
export function ProductPicker({
  products,
  selected,
  onToggle,
  onSetSelected,
  quickSelects,
  tag,
}: {
  products: Product[]
  selected: string[]
  onToggle: (hs: string) => void
  onSetSelected?: (hs: string[]) => void
  quickSelects?: QuickSelect[]
  tag?: (p: Product) => string | null
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {selected.length} of {products.length} products
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]" align="end">
        <div className="space-y-2">
          <div className="text-sm font-medium">Show products</div>
          {onSetSelected && quickSelects && quickSelects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {quickSelects.map((q) => (
                <Button
                  key={q.label}
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={q.hs.length === 0}
                  onClick={() => onSetSelected(q.hs)}
                >
                  {q.label} ({q.hs.length})
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={selected.length === 0}
                onClick={() => onSetSelected([])}
              >
                Clear
              </Button>
            </div>
          )}
          {/* Right padding keeps the scrollbar (always visible on some
              platforms) off the status letters at the end of each row. */}
          <div className="max-h-72 space-y-2 overflow-y-auto pr-3">
            {products.map((p) => {
              const t = tag?.(p)
              return (
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
                  {t && (
                    <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                      {t}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
