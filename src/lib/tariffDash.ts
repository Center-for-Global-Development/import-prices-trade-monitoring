import type { TariffCode } from "@/data/tracker"

// Tariff status is encoded twice on the line charts so it survives both
// colour-blindness and a crowded legend: a letter after the product name, and
// the line's dash pattern. Colour stays reserved for telling products apart.
// Shared by the price chart and the per-product import chart so both read
// the same way.
export const DASH: Record<TariffCode, string | undefined> = {
  T: undefined, // solid
  E: "8 5", // dashed
  P: "2 4", // dotted
}
