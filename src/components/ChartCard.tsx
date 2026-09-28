import { useEffect, useRef, useState, type ReactNode } from "react"
import { Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartExpandedContext } from "@/lib/chartExpanded"

// Card for a chart with an expand button in its upper-right corner. Uses the
// browser's Fullscreen API on the card itself, so the chart keeps its state
// (product selection, open picker) rather than being remounted in a dialog.
// Where fullscreen is refused — e.g. the cgdev.org iframe lacks
// allow="fullscreen", or iPhone Safari — the card instead grows taller in
// place. Covering the frame wouldn't work there: the iframe is as tall as the
// whole page, so a fixed overlay would be thousands of pixels high.
export function ChartCard({
  title,
  description,
  children,
}: {
  title: ReactNode
  description: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [native, setNative] = useState(false)
  const [inline, setInline] = useState(false)
  const expanded = native || inline

  useEffect(() => {
    const sync = () => setNative(document.fullscreenElement === ref.current)
    document.addEventListener("fullscreenchange", sync)
    return () => document.removeEventListener("fullscreenchange", sync)
  }, [])

  // Native fullscreen handles Escape itself; the in-place fallback needs it.
  useEffect(() => {
    if (!inline) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInline(false)
    }
    document.addEventListener("keydown", onKey)
    ref.current?.scrollIntoView({ block: "start" })
    return () => document.removeEventListener("keydown", onKey)
  }, [inline])

  const toggle = async () => {
    if (native) return void document.exitFullscreen()
    if (inline) return setInline(false)
    if (document.fullscreenEnabled && ref.current?.requestFullscreen) {
      try {
        await ref.current.requestFullscreen()
        return
      } catch {
        // Refused (permissions policy, no user gesture): expand in place.
      }
    }
    setInline(true)
  }

  const action = native ? "Exit full screen" : inline ? "Collapse chart" : "Expand chart"

  return (
    <Card
      ref={ref}
      className={native ? "overflow-y-auto rounded-none border-0" : undefined}
    >
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={toggle}
            aria-label={action}
            title={action}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartExpandedContext.Provider value={expanded}>{children}</ChartExpandedContext.Provider>
      </CardContent>
    </Card>
  )
}
