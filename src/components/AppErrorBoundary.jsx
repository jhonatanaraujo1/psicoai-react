import { Component } from 'react'

// Anti-loop: máx 2 reloads automáticos em 15s — depois para e mostra erro estático
const LOOP_KEY = 'psicoai_err_recovery'
const LOOP_MAX = 2
const LOOP_MS  = 15000

function loopCount() {
  try {
    const v = JSON.parse(localStorage.getItem(LOOP_KEY) || '{"n":0,"t":0}')
    return Date.now() - v.t > LOOP_MS ? 0 : v.n
  } catch { return 0 }
}
function incLoop() {
  try { localStorage.setItem(LOOP_KEY, JSON.stringify({ n: loopCount() + 1, t: Date.now() })) } catch {}
}
function clearLoop() {
  try { localStorage.removeItem(LOOP_KEY) } catch {}
}

async function clearSwAndReload() {
  incLoop()
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch {}
  window.location.reload()
}

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    // Verifica se já tentamos muitas vezes antes mesmo de montar
    this.looped = loopCount() >= LOOP_MAX
    this.state = { crashed: false }
  }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(error) {
    console.error('[PsicNotes] App crash:', error?.message)

    if (this.looped) {
      // Já tentou LOOP_MAX vezes — para o loop, não recarrega mais
      console.warn('[PsicNotes] Loop de recovery detectado — parando auto-reload.')
      return
    }

    // Primeira tentativa: aguarda 1.5s e recarrega
    setTimeout(() => clearSwAndReload(), 1500)
  }

  componentDidMount() {
    // Se montou sem crash, limpa o contador de loop
    if (!this.state.crashed) clearLoop()
  }

  render() {
    if (!this.state.crashed) return this.props.children

    const stuck = this.looped

    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#F5F2EC',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 20, fontFamily: "'DM Sans', sans-serif", padding: 24,
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, background: '#4A7C59',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, color: '#fff', fontWeight: 300, marginBottom: 4,
        }}>Ψ</div>

        {!stuck && (
          <div style={{ width: 28, height: 28, border: '3px solid #E8E5E0', borderTopColor: '#4A7C59', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        )}

        <div style={{ textAlign: 'center', maxWidth: 300 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1C', marginBottom: 6 }}>
            {stuck ? 'Algo deu errado' : 'Atualizando o PsicNotes…'}
          </div>
          <div style={{ fontSize: 13, color: '#8B8B8B', lineHeight: 1.6 }}>
            {stuck
              ? 'Não foi possível atualizar automaticamente. Clique abaixo para tentar manualmente.'
              : 'Nova versão disponível. Recarregando automaticamente.'}
          </div>
        </div>

        <button
          onClick={() => { clearLoop(); clearSwAndReload() }}
          style={{
            marginTop: 4, padding: '11px 28px',
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
