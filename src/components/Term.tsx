import { useEffect, useRef, useState, type ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { GLOSSARY, type TermId } from "@/data/glossary"
import { trackEngagement } from "@/lib/tracking"

// Hover delay before a mouse-opened definition closes, long enough to move
// the pointer from the term onto the popover.
const CLOSE_DELAY_MS = 150

// A jargon term with its definition in a popover. A popover rather than a
// tooltip so it works on touch: tap (or Enter/Space) toggles it everywhere,
// and on desktop hovering also opens it. The popover is small, and Radix
// flips it above the term when the iframe has no room below.
//
// Mark only the first use of a term in each section, not every occurrence.
export function Term({ id, children }: { id: TermId; children: ReactNode }) {
  const { term, definition } = GLOSSARY[id]
  const [open, setOpen] = useState(false)
  // Set when the pointer opened it: a click then keeps it open instead of
  // toggling it shut under the cursor.
  const byHover = useRef(false)
  const closeTimer = useRef<number | undefined>(undefined)

  const cancelClose = () => window.clearTimeout(closeTimer.current)
  const hoverOpen = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    cancelClose()
    if (!open) byHover.current = true
    setOpen(true)
  }
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !byHover.current) return
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS)
  }
  useEffect(() => cancelClose, [])

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next) byHover.current = false
        setOpen(next)
      }}
    >
      <PopoverTrigger
        className="cursor-help underline decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-solid focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        onClick={(e) => {
          // Tracked on click, tap or Enter only: hover opens are excluded by
          // the analytics standard. A click that pins a hover-opened popover
          // counts, since the reader chose to read it.
          if (byHover.current || !open) trackEngagement("detail_open", "glossary_term", id)
          if (byHover.current) {
            // Pin it: the hover already opened it, keep it open.
            e.preventDefault()
            byHover.current = false
            cancelClose()
          }
        }}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        collisionPadding={8}
        className="w-64 p-3 text-xs font-normal leading-relaxed"
        // Leave focus on the term so hovering doesn't steal it and keyboard
        // users can keep tabbing through the text.
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
      >
        <span className="font-semibold">{term}:</span> {definition}
      </PopoverContent>
    </Popover>
  )
}
