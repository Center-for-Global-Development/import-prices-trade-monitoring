import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Home } from "@/pages/Home"
import { lazy, Suspense } from "react"
import { RouteFallback } from "@/components/RouteFallback"
const CountryPage = lazy(() => import("@/pages/CountryPage").then((m) => ({ default: m.CountryPage })))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback>Loading tracker…</RouteFallback>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/country/:iso" element={<CountryPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
