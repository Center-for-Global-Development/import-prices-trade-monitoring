import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import worldRaw from "@/data/world_map.json"
import { COUNTRY_BY_ISO } from "@/data/tracker"

type MapCountry = { iso: string; name: string; d: string }
const WORLD = worldRaw as { width: number; height: number; countries: MapCountry[] }

type Hover = { iso: string; x: number; y: number }

// Clickable navigation map. Countries with tracker data are tinted and open
// their dashboard; the rest stay muted. The 110m geometry omits microstates
// and small islands — the searchable list below the map covers those, and is
// also the accessible path (the map is aria-hidden).
export function WorldMap() {
  const navigate = useNavigate()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)

  const hovered = hover ? COUNTRY_BY_ISO[hover.iso] : undefined

  const move = (iso: string) => (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    // Clamp so the tooltip never overflows the right edge of the map.
    setHover({
      iso,
      x: Math.min(e.clientX - rect.left + 12, rect.width - 160),
      y: e.clientY - rect.top + 12,
    })
  }

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
        className="w-full"
        aria-hidden="true"
      >
        {WORLD.countries.map((c) => {
          const tracked = c.iso in COUNTRY_BY_ISO
          return (
            <path
              key={c.iso}
              data-iso={c.iso}
              d={c.d}
              stroke="var(--background)"
              strokeWidth={0.5}
              fill={
                hover?.iso === c.iso
                  ? "var(--chart-1)"
                  : tracked
                    ? "color-mix(in oklab, var(--chart-1) 35%, var(--background))"
                    : "var(--cgd-light-gray)" // CGD none/neutral
              }
              className={tracked ? "cursor-pointer" : undefined}
              onClick={tracked ? () => navigate(`/country/${c.iso}`) : undefined}
              onMouseMove={tracked ? move(c.iso) : undefined}
              onMouseLeave={tracked ? () => setHover(null) : undefined}
            />
          )
        })}
      </svg>
      {hover && hovered && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{ left: hover.x, top: hover.y }}
        >
          <div className="font-medium">{hovered.name}</div>
          <div className="text-muted-foreground">
            {hovered.tariffedCount} tariffed · {hovered.partialCount} partially exempt ·{" "}
            {hovered.exemptCount} exempt
          </div>
        </div>
      )}
    </div>
  )
}
