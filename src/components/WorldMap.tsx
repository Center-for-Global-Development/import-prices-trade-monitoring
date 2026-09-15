import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { Minus, Plus, RotateCcw } from "lucide-react"
import worldRaw from "@/data/world_map.json"
import { COUNTRY_BY_ISO, countLabel } from "@/data/tracker"
import { Button } from "@/components/ui/button"

type MapCountry = { iso: string; name: string; d: string }
type MapArea = { name: string; d: string }
const WORLD = worldRaw as {
  width: number
  height: number
  countries: MapCountry[]
  disputed: MapArea[]
  borders: { dashed: string; dotted: string }
}

type Hover = { iso: string; x: number; y: number }

// Viewport in SVG user units: the visible box is (x, y, width/k, height/k).
type View = { k: number; x: number; y: number }
const HOME: View = { k: 1, x: 0, y: 0 }
const MAX_ZOOM = 6
const BUTTON_STEP = 1.6
const DRAG_THRESHOLD_PX = 4

function clampView({ k, x, y }: View): View {
  const kk = Math.min(MAX_ZOOM, Math.max(1, k))
  const w = WORLD.width / kk
  const h = WORLD.height / kk
  return {
    k: kk,
    x: Math.min(Math.max(0, x), WORLD.width - w),
    y: Math.min(Math.max(0, y), WORLD.height - h),
  }
}

// Zoom by `factor` keeping the user-space point (ux, uy) fixed on screen.
function zoomAt(view: View, factor: number, ux: number, uy: number): View {
  const k = Math.min(MAX_ZOOM, Math.max(1, view.k * factor))
  const ratio = view.k / k
  return clampView({
    k,
    x: ux - (ux - view.x) * ratio,
    y: uy - (uy - view.y) * ratio,
  })
}

// Clickable navigation map. Countries with tracker data are tinted and open
// their dashboard; the rest stay muted. Geometry follows the World Bank
// Official Boundaries (see scripts/build_world_map.mjs): disputed areas are
// hatched, and disputed boundaries / lines of control are dashed or dotted,
// as on the World Bank's own maps. Zoom with the buttons, ⌘/Ctrl+scroll or a
// trackpad pinch, double-click, and drag to pan when zoomed in. The searchable
// list below the map covers territories too small to draw and is also the
// accessible path (the SVG is aria-hidden).
export function WorldMap() {
  const navigate = useNavigate()
  // Query string carries design-review flags (see CountryPage); keep it.
  const { search } = useLocation()
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<Hover | null>(null)
  const [view, setView] = useState<View>(HOME)
  const [dragging, setDragging] = useState(false)
  // Pointer drag bookkeeping lives in a ref: it changes on every move and
  // must not re-render, and the click handler needs the latest value.
  const drag = useRef<{
    id: number
    startX: number
    startY: number
    view: View
    moved: boolean
  } | null>(null)

  const hovered = hover ? COUNTRY_BY_ISO[hover.iso] : undefined
  const zoomed = view.k > 1

  // Client pixel -> SVG user coordinates for the current view.
  const toUser = (clientX: number, clientY: number, v: View) => {
    const rect = svgRef.current!.getBoundingClientRect()
    return {
      ux: v.x + ((clientX - rect.left) / rect.width) * (WORLD.width / v.k),
      uy: v.y + ((clientY - rect.top) / rect.height) * (WORLD.height / v.k),
    }
  }

  const zoomButton = (factor: number) =>
    setView((v) =>
      zoomAt(
        v,
        factor,
        v.x + WORLD.width / v.k / 2,
        v.y + WORLD.height / v.k / 2,
      ),
    )

  // ⌘/Ctrl+wheel (which is also what a trackpad pinch produces) zooms the
  // map. React registers wheel listeners as passive, so a native non-passive
  // listener is needed to keep the browser from zooming the page as well.
  // Plain scrolling is left alone so an embedded page still scrolls normally.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const factor = Math.exp(-e.deltaY * 0.01)
      setView((v) => {
        const { ux, uy } = toUser(e.clientX, e.clientY, v)
        return zoomAt(v, factor, ux, uy)
      })
    }
    svg.addEventListener("wheel", onWheel, { passive: false })
    return () => svg.removeEventListener("wheel", onWheel)
  }, [])

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || !zoomed) return
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      view,
      moved: false,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    if (!d.moved) {
      d.moved = true
      setDragging(true)
      setHover(null)
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const unitsPerPx = WORLD.width / d.view.k / rect.width
    setView(
      clampView({
        k: d.view.k,
        x: d.view.x - dx * unitsPerPx,
        y: d.view.y - dy * unitsPerPx,
      }),
    )
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
    // Keep `moved` visible to the click event that follows pointerup, then
    // clear it on the next tick.
    setTimeout(() => {
      drag.current = null
    }, 0)
  }

  const onDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const { clientX, clientY } = e
    setView((v) => {
      const { ux, uy } = toUser(clientX, clientY, v)
      return zoomAt(v, 2, ux, uy)
    })
  }

  const move = (iso: string) => (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect || drag.current?.moved) return
    // Clamp so the tooltip never overflows the right edge of the map.
    setHover({
      iso,
      x: Math.min(e.clientX - rect.left + 12, rect.width - 160),
      y: e.clientY - rect.top + 12,
    })
  }

  const open = (iso: string) => () => {
    if (drag.current?.moved) return
    navigate({ pathname: `/country/${iso}`, search })
  }

  const viewBox = `${view.x} ${view.y} ${WORLD.width / view.k} ${WORLD.height / view.k}`

  return (
    <div className="space-y-2">
      <div ref={wrapRef} className="relative">
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className="w-full select-none"
          style={{
            cursor: zoomed ? (dragging ? "grabbing" : "grab") : undefined,
            // Let the page scroll over the map until the user zooms in, at
            // which point single-finger drags pan the map instead.
            touchAction: zoomed ? "none" : "pan-y",
          }}
          aria-hidden="true"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <defs>
            {/* Hatching for disputed areas. The pattern is in user units, so
                it is scaled down by the zoom factor to keep the same on-screen
                spacing at every zoom level. */}
            <pattern
              id="map-disputed-hatch"
              width={3}
              height={3}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(45) scale(${1 / view.k})`}
            >
              <rect width={3} height={3} fill="var(--cgd-light-gray)" />
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={3}
                stroke="var(--cgd-teal-gray)"
                strokeWidth={1}
              />
            </pattern>
          </defs>
          {WORLD.countries.map((c) => {
            const tracked = c.iso in COUNTRY_BY_ISO
            return (
              <path
                key={c.iso}
                data-iso={c.iso}
                d={c.d}
                stroke="var(--background)"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
                fill={
                  hover?.iso === c.iso
                    ? "var(--chart-1)"
                    : tracked
                      ? "color-mix(in oklab, var(--chart-1) 35%, var(--background))"
                      : "var(--cgd-light-gray)" // CGD none/neutral
                }
                className={tracked && !zoomed ? "cursor-pointer" : undefined}
                onClick={tracked ? open(c.iso) : undefined}
                onMouseMove={tracked ? move(c.iso) : undefined}
                onMouseLeave={tracked ? () => setHover(null) : undefined}
              />
            )
          })}
          {WORLD.disputed.map((a) => (
            <path
              key={a.name}
              data-area={a.name}
              d={a.d}
              fill="url(#map-disputed-hatch)"
              stroke="var(--background)"
              strokeWidth={0.5}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={WORLD.borders.dashed}
            fill="none"
            stroke="var(--cgd-dark-gray)"
            strokeWidth={0.75}
            strokeDasharray="3 2"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          <path
            d={WORLD.borders.dotted}
            fill="none"
            stroke="var(--cgd-dark-gray)"
            strokeWidth={0.75}
            strokeDasharray="1 1.5"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        </svg>
        <div className="absolute top-1 right-1 flex flex-col gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Zoom in"
            title="Zoom in (⌘/Ctrl+scroll or double-click also zooms)"
            disabled={view.k >= MAX_ZOOM}
            onClick={() => zoomButton(BUTTON_STEP)}
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Zoom out"
            title="Zoom out"
            disabled={!zoomed}
            onClick={() => zoomButton(1 / BUTTON_STEP)}
          >
            <Minus />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            aria-label="Reset zoom"
            title="Reset zoom"
            disabled={!zoomed}
            onClick={() => setView(HOME)}
          >
            <RotateCcw />
          </Button>
        </div>
        {hover && hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            style={{ left: hover.x, top: hover.y }}
          >
            <div className="font-medium">{hovered.name}</div>
            <div className="text-muted-foreground">
              {countLabel(hovered.tariffedCount)} tariffed ·{" "}
              {countLabel(hovered.partialCount)} partially exempt ·{" "}
              {countLabel(hovered.exemptCount)} exempt
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Boundaries from the{" "}
        <a
          href="https://datacatalog.worldbank.org/search/dataset/0038272"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          World Bank Official Boundaries
        </a>{" "}
        (CC BY 4.0), following World Bank boundaries for disputed territories.
        Map representations do not suggest any endorsement by CGD.
      </p>
    </div>
  )
}
