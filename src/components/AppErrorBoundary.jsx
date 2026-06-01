/**
 * AppErrorBoundary — captura crashes do React (inclusive SW servindo bundle desatualizado)
 * e faz auto-recover: limpa cache do service worker + recarrega.
 * O psicólogo nunca vê tela branca — vê uma tela de "atualizando" por ~1.5s.
 */
import { Component } from 'react'

async function clearSwAndReload() {
  try {
    // Desregistra todos os service workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    // Limpa todos os caches do workbox
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch (e) {
    // Se falhar a limpeza, recarrega mesmo assim
  }
  window.location.reload()
}

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { crashed: false, clearing: false }
  }

  static getDerivedStateFromError() {
    return { crashed: true, clearing: true }
  }

  componentDidCatch(error) {
    // Log para diagnóstico — não expõe ao usuário
    console.error('[PsicoAI] App crash — limpando cache e recarregando:', error?.message)

    // Aguarda 1.5s para mostrar a tela de "atualizando" antes de recarregar
    setTimeout(() => clearSwAndReload(), 1500)
  }

  render() {
    if (!this.state.crashed) return this.props.children

    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: '#F5F2EC',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20, fontFamily: "'DM Sans', sans-serif",
        padding: 24,
      }}>
        {/* Logo */}
        <div style={{
          width: 52, height: 52, borderRadius: 16,
          background: '#4A7C59',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 26, color: '#fff', fontWeight: 300,
          marginBottom: 4,
        }}>
          Ψ
        </div>

        {/* Spinner */}
        <div style={{
          width: 28, height: 28,
          border: '3px solid #E8E5E0',
          borderTopColor: '#4A7C59',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />

        <div style={{ textAlign: 'center', maxWidth: 280 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1C', marginBottom: 6 }}>
            Atualizando o PsicoAI…
          </div>
          <div style={{ fontSize: 13, color: '#8B8B8B', lineHeight: 1.6 }}>
            Nova versão disponível. Recarregando automaticamente.
          </div>
        </div>

        {/* Botão manual caso o auto-reload falhe */}
        <button
          onClick={() => clearSwAndReload()}
          style={{
            marginTop: 8, padding: '10px 24px',
            background: '#4A7C59', color: '#fff', border: 'none',
            borderRadius: 10, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Recarregar agora
        </button>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }
}
