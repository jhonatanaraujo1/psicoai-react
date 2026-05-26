import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Landing from './views/Landing.jsx'

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/landing" element={<Landing />} />
      <Route path="/*"       element={<App />} />
    </Routes>
  </BrowserRouter>
)
