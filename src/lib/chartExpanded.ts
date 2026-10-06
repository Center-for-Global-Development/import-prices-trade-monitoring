import { createContext, useContext } from "react"

// True while the enclosing chart card is expanded (see ChartCard), so charts
// can trade their fixed in-page heights for taller ones that use the screen.
// Size expanded charts as min(vh, px): vh is the screen in real fullscreen,
// but in the in-place fallback it is the page-tall cgdev.org iframe.
export const ChartExpandedContext = createContext(false)
export const useChartExpanded = () => useContext(ChartExpandedContext)
