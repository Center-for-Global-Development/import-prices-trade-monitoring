import type { MouseEvent } from "react"

export type Section = { id: string; label: string }

// Jump links to the country page's sections. On cgdev.org the page sits in
// an iframe sized to its content, so the frame itself never scrolls and a
// bare #hash link would do nothing; scrollIntoView also scrolls the host
// page. Focus moves to the section so keyboard and screen-reader users land
// there too.
export function SectionNav({ sections }: { sections: Section[] }) {
  const jump = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    e.preventDefault()
    target.scrollIntoView({ behavior: "smooth", block: "start" })
    target.focus({ preventScroll: true })
  }
  return (
    <nav aria-label="Page sections">
      <ul className="flex flex-wrap items-center gap-2 text-sm">
        <li className="mr-1 text-muted-foreground">Jump to:</li>
        {sections.map((s) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              onClick={(e) => jump(e, s.id)}
              className="inline-flex h-8 items-center rounded-full border bg-card px-3 font-medium text-primary transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
