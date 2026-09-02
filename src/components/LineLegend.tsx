export type LegendItem = {
  key: string
  label: string
  color: string
  // SVG stroke-dasharray for the sample line; undefined = solid.
  dash?: string
  // "line" shows a stroke sample (dash pattern visible); "dot" a filled circle.
  marker?: "line" | "dot"
}

// Chart legend rendered in normal document flow (below the chart) rather than
// inside recharts' fixed-height canvas, so many entries wrap onto new lines
// and push the card taller instead of overflowing sideways.
export function LineLegend({ items }: { items: LegendItem[] }) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {items.map((it) => (
        <li key={it.key} className="flex items-center gap-1.5">
          {it.marker === "dot" ? (
            <svg width="24" height="10" aria-hidden="true" className="shrink-0">
              <circle cx="12" cy="5" r="4" fill={it.color} />
            </svg>
          ) : (
            <svg width="24" height="10" aria-hidden="true" className="shrink-0">
              <line
                x1="1"
                y1="5"
                x2="23"
                y2="5"
                stroke={it.color}
                strokeWidth="2.5"
                strokeDasharray={it.dash}
              />
            </svg>
          )}
          <span>{it.label}</span>
        </li>
      ))}
    </ul>
  )
}
