// Tariff-policy moments shown as vertical markers on the charts, so the
// "frontloading" story (import surges ahead of announced dates) is visible.
//
// PLACEHOLDER LIST — the researcher owns the canonical set of dates; add or
// edit entries here as they confirm them. Month granularity ("YYYY-MM")
// because both charts plot monthly data. Keep labels short; they render
// inside small chart panels.

export type TariffEvent = {
  month: string // "YYYY-MM"
  label: string
}

export const TARIFF_EVENTS: TariffEvent[] = [
  { month: "2025-04", label: "Tariffs announced" },
  // "next tariffs go dead on July 24" per researcher conversation, Jul 2026 —
  // confirm what happens on that date before finalizing the label.
  { month: "2026-07", label: "Jul 24 deadline" },
]
