import { useId, useMemo, useState, type ReactNode } from "react"
import type { Product } from "@/data/tracker"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"
import { trackEngagement } from "@/lib/tracking"

// `id` is the analytics value for the button (see TRACKING.md).
export type QuickSelect = { id: string; label: string; hs: string[] }

// Add/drop product selector shared by the per-product charts (price trends,
// import value). Selection state lives in the parent so each chart keeps its
// own set. Optional extras: a short tag per product (e.g. tariff status
// letter), an asterisk mark with its explanatory note, and quick-select
// buttons that replace the whole selection.
//
// Rows are listed by HS4 code so readers can find a product in the list; the
// parent's own order (share to US, desc) still drives defaults and colors.
//
// The list opens inline, pushing the charts down, rather than as a floating
// popover. Researchers found the popover covered the charts, and inside the
// cgdev.org iframe (sized to the page's flow height) a popover near the
// bottom of the page was clipped after about ten rows.
//
// `trackingPrefix` names the chart in analytics labels (e.g. "price_trends"),
// since both charts use this picker.
export function ProductPicker({
  trackingPrefix,
  label,
  products,
  selected,
  onToggle,
  onSetSelected,
  quickSelects,
  tag,
  mark,
  markNote,
}: {
  trackingPrefix: string
  label: ReactNode
  products: Product[]
  selected: string[]
  onToggle: (hs: string) => void
  onSetSelected?: (hs: string[]) => void
  quickSelects?: QuickSelect[]
  tag?: (p: Product) => string | null
  mark?: (p: Product) => boolean
  markNote?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const setPanel = (next: boolean) => {
    if (next === open) return
    trackEngagement(next ? "detail_open" : "detail_close", `${trackingPrefix}_product_picker`)
    setOpen(next)
  }
  const toggle = (hs: string) => {
    const action = selected.includes(hs) ? "remove" : "add"
    trackEngagement("filter", `${trackingPrefix}_product_${action}`, hs)
    onToggle(hs)
  }
  const quickSelect = (value: string, hs: string[]) => {
    trackEngagement("preset", `${trackingPrefix}_quick_select`, value)
    onSetSelected?.(hs)
  }
  const panelId = useId()
  const rows = useMemo(
    () => [...products].sort((a, b) => a.hs.localeCompare(b.hs)),
    [products],
  )
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">{label}</div>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setPanel(!open)}
        >
          {selected.length} of {products.length} products
          <ChevronDown
            className={`ml-2 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </Button>
      </div>
      {open && (
        <div
          id={panelId}
          className="space-y-2 rounded-md border bg-popover p-4 text-popover-foreground"
          onKeyDown={(e) => {
            if (e.key === "Escape") setPanel(false)
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">
              Show products{" "}
              <span className="font-normal text-muted-foreground">
                ({products.length} available)
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setPanel(false)}
            >
              Done
            </Button>
          </div>
          {onSetSelected && quickSelects && quickSelects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {quickSelects.map((q) => (
                <Button
                  key={q.label}
                  variant="secondary"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={q.hs.length === 0}
                  onClick={() => quickSelect(q.id, q.hs)}
                >
                  {q.label} ({q.hs.length})
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={selected.length === 0}
                onClick={() => quickSelect("clear", [])}
              >
                Clear
              </Button>
            </div>
          )}
          {/* Columns fit more of a long list on screen; the scrollbar is
              always drawn (see .scrollbar-visible) so readers can tell the
              list continues. Right padding keeps it off the status letters. */}
          <div className="scrollbar-visible grid max-h-80 grid-cols-1 gap-x-6 gap-y-2 overflow-y-auto pr-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((p) => {
              const t = tag?.(p)
              return (
                <label
                  key={p.hs}
                  className="flex min-w-0 cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={selected.includes(p.hs)}
                    onCheckedChange={() => toggle(p.hs)}
                  />
                  <span className="font-mono text-xs">{p.hs}</span>
                  <span className="truncate">
                    {p.name}
                    {mark?.(p) && "*"}
                  </span>
                  {t && (
                    <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
                      {t}
                    </span>
                  )}
                </label>
              )
            })}
          </div>
          {markNote && products.some((p) => mark?.(p)) && (
            <p className="border-t pt-2 text-xs text-muted-foreground">{markNote}</p>
          )}
        </div>
      )}
    </div>
  )
}
