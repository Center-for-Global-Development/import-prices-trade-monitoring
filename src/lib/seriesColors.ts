import { useState } from "react"

// Categorical order for product lines. The first five are the brand colours
// that hold a 2px line on white; light blue and light gold (slots 6–7) are
// faint on white and too close to each other to tell apart by colour alone,
// so beyond five lines the legend and dash patterns carry identity. Light
// gray is left out: it is the gridline colour.
export const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
]

// Colours go to what is on the chart, not to a product's place in the full
// list, so the first seven lines shown are always distinct. A newly added
// product takes the least-used slot (lowest first); products already shown
// keep theirs, so adding or dropping a line never repaints the others.
export function useSeriesColors(selected: string[]): Record<string, string> {
  const [state, setState] = useState(() => ({
    selected,
    slots: assignSlots({}, selected),
  }))
  // Recompute when the selection changes (adjusting state while rendering,
  // so the new colours land in the same render as the new lines).
  if (state.selected !== selected) {
    setState({ selected, slots: assignSlots(state.slots, selected) })
  }
  const slots = state.selected === selected ? state.slots : assignSlots(state.slots, selected)
  return Object.fromEntries(selected.map((k) => [k, SERIES_COLORS[slots[k]]]))
}

function assignSlots(prev: Record<string, number>, selected: string[]) {
  const slots: Record<string, number> = {}
  for (const k of selected) if (k in prev) slots[k] = prev[k]
  for (const k of selected) {
    if (k in slots) continue
    const used = SERIES_COLORS.map(() => 0)
    for (const s of Object.values(slots)) used[s]++
    slots[k] = used.indexOf(Math.min(...used))
  }
  return slots
}
