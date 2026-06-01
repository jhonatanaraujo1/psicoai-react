import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.jsx'
import Landing from './views/Landing.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'

// Auto-reload quando o Service Worker atualiza (novo deploy).
// skipWaiting + clientsClaim no vite.config garante que o novo SW ativa
// imediatamente; controllerchange dispara e recarregamos a página uma vez.
if ('serviceWorker' in navigator) {
  let _swReloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (_swReloading) return
    _swReloading = true
    window.location.reload()
  })
}

createRoot(document.getElementById('root')).render(
  <AppErrorBoundary>
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<Landing />} />
        <Route path="/*"       element={<App />} />
      </Routes>
    </BrowserRouter>
  </AppErrorBoundary>
)
