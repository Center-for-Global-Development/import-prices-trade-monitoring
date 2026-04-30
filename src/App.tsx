import { BrowserRouter, Route, Routes } from "react-router-dom"
import { Home } from "@/pages/Home"
import { CountryPage } from "@/pages/CountryPage"

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/country/:iso" element={<CountryPage />} />
      </Routes>
    </BrowserRouter>
  )
}
