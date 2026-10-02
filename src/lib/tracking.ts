// Event tracking per the CGD Interactive Analytics Tracking Standard. Events
// go to the cgdev.org parent page by postMessage, where GTM forwards them to
// GA4, so they join the reader's CGD session; there is no GA tag in the
// iframe. Every tracked control is listed in TRACKING.md, which must change
// in the same PR as any call here.
//
// Outside an iframe nothing is sent. Framed by anything other than
// www.cgdev.org, the browser drops the message. In dev builds each event is
// also logged to the console for checking.

const PARENT_ORIGIN = "https://www.cgdev.org"

declare global {
  interface Window {
    CGD_INTERACTIVE_NAME?: string
  }
}

export const INTERACTIVE_NAME =
  (typeof window !== "undefined" && window.CGD_INTERACTIVE_NAME) ||
  "import-prices-trade-monitoring"

export type ActionType =
  | "filter"
  | "preset"
  | "detail_open"
  | "detail_close"
  | "view_control"
  | "navigate"
  | "compare"
  | "external_link"
  | "download"

let viewTracked = false

function send(event: string, params: Record<string, string>) {
  if (typeof window === "undefined") return
  const payload = { type: "cgd_analytics", event, ...params }
  if (import.meta.env.DEV) console.debug("[cgd_analytics]", JSON.stringify(payload))
  // Not framed: there is no parent to tell, and posting to ourselves would
  // only log an origin-mismatch warning.
  if (window.parent === window) return
  window.parent.postMessage(payload, PARENT_ORIGIN)
}

// Once per page load. The app is a single-page app in one iframe, so moving
// between countries doesn't count as a new view; those show up as
// `navigate` engagements instead.
export function trackView() {
  if (viewTracked) return
  viewTracked = true
  send("interactive_view", { interactive_name: INTERACTIVE_NAME })
}

// Values must come from bounded sets (codes, slugs, ISO3s), never free text.
export function trackEngagement(
  actionType: ActionType,
  actionLabel: string,
  actionValue?: string | number | null,
) {
  const params: Record<string, string> = {
    interactive_name: INTERACTIVE_NAME,
    action_type: actionType,
    action_label: actionLabel,
  }
  if (actionValue !== undefined && actionValue !== null && actionValue !== "") {
    params.action_value = String(actionValue)
  }
  send("interactive_engagement", params)
}
