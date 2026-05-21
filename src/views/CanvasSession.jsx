import { useState, useEffect, useRef } from 'react'
import { Tldraw } from '@tldraw/tldraw'
import '@tldraw/tldraw/tldraw.css'

async function svgToPngBase64(svgStr, width, height) {
  return new Promise((resolve) => {
    const img = new Image()
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width || 1200
      canvas.height = height || 900
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#F7F4EF'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/png').split(',')[1])
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null) }
    img.src = url
  })
}

export default function CanvasSession({ patient, isOpen, onClose, onAnalyze, sessionId }) {
  const [secs, setSecs] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const timerRef = useRef(null)
  const editorRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setSecs(0)
      setShowEndModal(false)
      timerRef.current = setInterval(() => setSecs(s => s + 1), 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isOpen])

  const fmt = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const ss = (s % 60).toString().padStart(2, '0')
    return `${m}:${ss}`
  }

  const handleMount = (editor) => {
    editorRef.current = editor
    editor.setCurrentTool('draw')
    editor.updateInstanceState({ isGridMode: false, isDebugMode: false })
  }

  const exportCanvas = async () => {
    let imageBase64 = null
    try {
      const editor = editorRef.current
      if (editor) {
        const shapeIds = [...editor.getCurrentPageShapeIds()]
        if (shapeIds.length > 0) {
          const result = await editor.getSvgString(shapeIds, { background: false, scale: 1 })
          if (result?.svg) {
            imageBase64 = await svgToPngBase64(result.svg, result.width, result.height)
          }
        }
      }
    } catch (e) {
      console.warn('Export canvas falhou:', e)
    }
    return imageBase64
  }

  const handleEndWithoutAI = () => {
    setShowEndModal(false)
    onClose({ duration: secs }) // no image needed when closing without AI analysis
  }

  const handleEndWithAI = async () => {
    setExporting(true)
    const imageBase64 = await exportCanvas()
    setExporting(false)
    setShowEndModal(false)
    onAnalyze({ imageBase64, duration: secs })
  }

  if (!isOpen) return null

  const patientName = patient?.name || 'Lucas Martins'
  const sessionNum = (patient?.sessions || 14) + 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', background: '#E8E3DA' }}>
      <div className="cs-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="cs-logo">Ψ</div>
          <div className="cs-patient">{patientName} · Sessão {sessionNum}</div>
        </div>
        <div className="cs-timer">{fmt(secs)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="cs-end-btn" onClick={() => setShowEndModal(true)}>
            Encerrar Sessão
          </button>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <Tldraw onMount={handleMount} inferDarkMode={false} />
      </div>

      {/* Modal de encerramento */}
      {showEndModal && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px',
            width: '100%', maxWidth: '440px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '20px', fontWeight: 400, color: '#1C1C1C', marginBottom: '8px' }}>
                Encerrar sessão
              </div>
              <div style={{ fontSize: '13px', color: '#8B8B8B', lineHeight: 1.6 }}>
                Duração: <strong style={{ color: '#1C1C1C' }}>{fmt(secs)}</strong> · {patientName} · Sessão {sessionNum}
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Opção com IA */}
              <button
                onClick={handleEndWithAI}
                disabled={exporting}
                style={{
                  width: '100%', padding: '16px', border: '2px solid var(--g300)',
                  borderRadius: '12px', background: 'var(--g50)', cursor: exporting ? 'wait' : 'pointer',
                  textAlign: 'left', fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.15s', opacity: exporting ? 0.7 : 1,
                }}
                onMouseOver={e => { if (!exporting) { e.currentTarget.style.background = 'var(--g100)'; e.currentTarget.style.borderColor = 'var(--g400)' }}}
                onMouseOut={e => { e.currentTarget.style.background = 'var(--g50)'; e.currentTarget.style.borderColor = 'var(--g300)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  {exporting ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  )}
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--g700)' }}>
                    {exporting ? 'Exportando canvas...' : 'Encerrar e gerar análise IA'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--g600)', lineHeight: 1.5, paddingLeft: '26px' }}>
                  O canvas será analisado pelo PsicoAI — hipóteses diagnósticas, padrões e sugestões para a próxima sessão.
                </div>
              </button>

              {/* Opção sem IA */}
              <button
                onClick={handleEndWithoutAI}
                disabled={exporting}
                style={{
                  width: '100%', padding: '14px 16px', border: '1px solid var(--gr2)',
                  borderRadius: '12px', background: 'var(--w)', cursor: 'pointer',
                  textAlign: 'left', fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--ow)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--w)'}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>Encerrar sem análise</div>
                <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>Salva a sessão. Você pode gerar a análise depois pelo prontuário.</div>
              </button>

              <button
                onClick={() => setShowEndModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--gr4)', fontSize: '12px', cursor: 'pointer', padding: '4px', fontFamily: "'DM Sans', sans-serif" }}
              >
                ← Continuar sessão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
