import { QUALIFYING_THRESHOLD } from "@/data/tracker"

// Reader-facing definitions for the tracker's jargon, from the researchers'
// hover-definition list (Sep 2026), in CGD "US" style. The <Term> popovers
// and the tariff status keys both read from here so the wording can't drift.
export type TermId =
  | "hs4"
  | "qualifying"
  | "tracked"
  | "tariffed"
  | "exempt"
  | "partial"

const thresholdPct = Math.round(QUALIFYING_THRESHOLD * 100)

export const GLOSSARY: Record<TermId, { term: string; definition: string }> = {
  hs4: {
    term: "HS4",
    definition:
      "A 4-digit product category within the Harmonized System, an international system used to classify traded products. More specific than HS2, but broader than detailed tariff-line products.",
  },
  // Same wording as the note under the summary tiles, made country-neutral.
  qualifying: {
    term: "Qualifying product",
    definition: `An HS4 product for which ≥${thresholdPct}% of the country's exports are destined for the US.`,
  },
  tracked: {
    term: "Tracked product",
    definition:
      "A qualifying HS4 product for which a BLS import price index is also available.",
  },
  tariffed: {
    term: "Tariffed",
    definition:
      "No portion of the HS4 product is exempt from the tariffs covered by the Executive Orders.",
  },
  exempt: {
    term: "Exempt",
    definition:
      "The HS4 product is fully exempt from the tariffs covered by the Executive Orders.",
  },
  partial: {
    term: "Partially exempt",
    definition:
      "Some, but not all, US import value within the HS4 product is exempt from the tariffs covered by the Executive Orders. The percentage shown is the share of the HS4 product's US import value that is exempt under the applicable Executive Orders.",
  },
}
