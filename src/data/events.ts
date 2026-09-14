// Tariff-policy moments shown as vertical markers on the charts, so the
// "frontloading" story (import surges ahead of announced dates) is visible.
//
// The researcher owns the canonical set of dates; add or edit entries here as
// they confirm them. Both entries below are confirmed (Liliana, Sep 2026).
// Positioning is month granularity ("YYYY-MM") because both charts plot
// monthly data; an event with a precise date can also carry a day, which only
// the key below the charts shows. Keep labels short; they render inside small
// chart panels.

export type TariffEvent = {
  month: string // "YYYY-MM"
  // Day of the month, when the event has a precise date the key should show.
  // Charts are monthly either way: the marker always sits on the month.
  day?: number
  label: string
}

export const TARIFF_EVENTS: TariffEvent[] = [
  { month: "2025-04", day: 2, label: "Tariffs announced" },
  // Wording from the research lead (Sep 2026).
  { month: "2026-07", day: 24, label: "Section 122 tariffs expired" },
]
