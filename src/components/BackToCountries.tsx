import { Link } from "react-router-dom"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { trackEngagement } from "@/lib/tracking"

// The only way back to the world map, so it reads as a real button in CGD
// gold rather than a quiet text link — repeated at the foot of the country
// page because the page is long enough to scroll the top one out of sight.
export function BackToCountries({
  className,
  position = "top",
}: {
  className?: string
  // Which copy of the button, so analytics can tell them apart.
  position?: "top" | "bottom"
}) {
  return (
    <Button
      asChild
      size="lg"
      className={cn(
        "h-11 px-6 text-base bg-(--cgd-gold) font-semibold text-(--cgd-teal-black) transition-[filter,color] hover:bg-(--cgd-gold) hover:brightness-95",
        className
      )}
    >
      <Link to="/" onClick={() => trackEngagement("navigate", `back_to_countries_${position}`)}>
        <ChevronLeft className="mr-1 h-5 w-5" />
        All countries
      </Link>
    </Button>
  )
}
