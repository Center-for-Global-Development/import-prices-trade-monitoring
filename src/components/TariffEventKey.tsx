import { TARIFF_EVENTS } from "@/data/events"
import { dateLabel } from "@/data/tracker"

export function TariffEventKey() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Policy markers">
      {TARIFF_EVENTS.map((event, i) => (
        <li key={event.month}><strong>{i + 1}.</strong> {dateLabel(event.month, event.day)}: {event.label}</li>
      ))}
    </ul>
  )
}
