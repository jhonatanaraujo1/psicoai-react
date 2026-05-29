/**
 * Landing — rota /landing dentro do React SPA.
 *
 * Carrega public/landing.html via fetch e faz um document swap completo.
 * Isso garante que todo o CSS, scripts, fontes e animações da landing
 * funcionem exatamente como foram escritos, sem conversão para JSX.
 *
 * A URL permanece /landing (não redireciona para /landing.html).
 * Após a troca, o React não está mais no controle — a landing é HTML puro.
 * Quando o usuário clica "Começar grátis" → vai para / (React login).
 */
import { useEffect } from 'react'

export default function Landing() {
  useEffect(() => {
    fetch('/landing.html?v=' + Date.now())
      .then(r => r.text())
      .then(html => {
        // document.open/write/close substitui o documento inteiro
        // — fontes, estilos, scripts, tudo funciona corretamente.
        // A URL na barra do browser NÃO muda (fica /landing).
        document.open('text/html', 'replace')
        document.write(html)
        document.close()
      })
      .catch(() => {
        // fallback: redireciona direto para o arquivo estático
        window.location.replace('/landing.html')
      })
  }, [])

  // Tela de carregamento enquanto o fetch acontece
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F5F2EC',
      fontFamily: "'DM Sans', sans-serif",
      flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        width: 28, height: 28,
        border: '2.5px solid #E8E5E0',
        borderTopColor: '#4A7C59',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
