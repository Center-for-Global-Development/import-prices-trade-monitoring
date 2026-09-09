import { TARIFF_EVENTS } from "@/data/events"
import { monthLabel } from "@/data/tracker"

export function TariffEventKey() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Policy markers">
      {TARIFF_EVENTS.map((event, i) => (
        <li key={event.month}><strong>{i + 1}.</strong> {monthLabel(event.month)}: {event.label}</li>
      ))}
    </ul>
  )
}
