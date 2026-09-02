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
  // Wording from the research lead (Sep 2026). Charts are monthly, so the
  // marker sits on July; the day lives in the label.
  { month: "2026-07", label: "Section 122 tariffs expired (Jul 24)" },
]
