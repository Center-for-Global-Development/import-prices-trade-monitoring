import type { ImportPoint } from "@/data/seriesByCountry"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { ChartConfig } from "@/components/ui/chart"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

const config: ChartConfig = {
  usdBn: { label: "Imports (USD bn)", color: "var(--chart-2)" },
}

export function ImportValueChart({ data }: { data: ImportPoint[] }) {
  return (
    <ChartContainer config={config} className="h-72 w-full">
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="usdBn" fill="var(--color-usdBn)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
