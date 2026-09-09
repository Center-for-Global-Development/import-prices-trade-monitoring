import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Home } from "@/pages/Home"
import { lazy, Suspense } from "react"
const CountryPage = lazy(() => import("@/pages/CountryPage").then((m) => ({ default: m.CountryPage })))

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p className="p-4 sm:p-8" role="status">Loading tracker…</p>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/country/:iso" element={<CountryPage />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
