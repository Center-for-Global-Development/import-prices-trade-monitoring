import type { ReactNode } from "react"

// Placeholder for a route that is still loading its code chunk or its data.
// The embed reports its own height up to cgdev.org (see the resize script in
// index.html), so a placeholder only as tall as its text would collapse the
// iframe mid-navigation and yank the host page's content upward before the
// country page expands it again. Holding roughly the height of the home page
// keeps that transition steady.
export function RouteFallback({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[800px]" role="status">
      <p>{children}</p>
    </div>
  )
}
