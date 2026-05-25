import { useState, useEffect, useRef, useCallback } from 'react'
import { Excalidraw, MainMenu, exportToBlob } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

// ── LocalStorage helpers ──────────────────────────────────────────────────────
const STORAGE_VERSION = 2  // bump quando mudar a estrutura do schema
const STORAGE_MAX_BYTES = 4 * 1024 * 1024  // 4 MB — limite seguro (localStorage ≈ 5 MB/origem)
const STORAGE_TTL_MS    = 12 * 3600 * 1000  // 12 horas — rascunho antigo descartado

const draftKey = (patientId)  => `psicoai_canvas_draft_p${patientId}`
const sessKey  = (sessionId)  => `psicoai_canvas_session_s${sessionId}`

function saveCanvas(patientId, sessionId, api) {
  if (!api || !patientId) return
  try {
    const elements = api.getSceneElements()
    const appState = api.getAppState()
    const files    = api.getFiles()
    const payload = {
      v:            STORAGE_VERSION,
      savedAt:      Date.now(),
      patientId,
      sessionId:    sessionId || null,
      elementCount: elements.length,
      elements,
      appState: { viewBackgroundColor: appState.viewBackgroundColor || '#F7F4EF' },
      files,
    }
    const data = JSON.stringify(payload)

    // Guard de tamanho — evita corromper o localStorage inteiro
    if (data.length > STORAGE_MAX_BYTES) {
      console.warn(`[PsicoAI] Canvas muito grande (${Math.round(data.length / 1024)} KB) — salvamento local ignorado para não corromper o storage.`)
      return
    }

    try {
      localStorage.setItem(draftKey(patientId), data)
      if (sessionId) localStorage.setItem(sessKey(sessionId), data)
    } catch (quotaErr) {
      if (quotaErr.name === 'QuotaExceededError') {
        // Tenta liberar espaço removendo rascunhos antigos antes de desistir
        const oldKeys = []
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i)
          if (k?.startsWith('psicoai_canvas_')) oldKeys.push(k)
        }
        // Remove o mais antigo (heurística: menor savedAt no valor)
        oldKeys.forEach(k => { try { localStorage.removeItem(k) } catch {} })
        // Segunda tentativa
        try {
          localStorage.setItem(draftKey(patientId), data)
          if (sessionId) localStorage.setItem(sessKey(sessionId), data)
        } catch { console.error('[PsicoAI] localStorage cheio — rascunho do canvas não salvo.') }
      }
    }
  } catch (e) {
    console.warn('[PsicoAI] canvas save localStorage failed:', e)
  }
}

function loadCanvas(patientId, sessionId, initialCanvasData) {
  const tryParse = (raw) => {
    if (!raw) return null
    try {
      const d = JSON.parse(raw)
      if (!d) return null

      // Verifica pertencimento — rejeita se for rascunho de outro paciente
      if (d.patientId && patientId && d.patientId !== patientId) {
        console.warn('[PsicoAI] Rascunho descartado — pertence a outro paciente.')
        return null
      }

      // Verifica staleness — rascunho mais velho que TTL é descartado
      if (d.savedAt && (Date.now() - d.savedAt) > STORAGE_TTL_MS) {
        console.warn('[PsicoAI] Rascunho expirado (>12h) — descartado.')
        return null
      }

      // Migração de versão anterior (sem campo v)
      if (!d.v) {
        console.info('[PsicoAI] Migrando rascunho de schema legado.')
        d.v = STORAGE_VERSION
      }

      return d
    } catch {
      return null
    }
  }

  // Prioridade: chave de sessão → rascunho do paciente → prop inicial
  if (sessionId) {
    const v = tryParse(localStorage.getItem(sessKey(sessionId)))
    if (v) return v
  }
  const d = tryParse(localStorage.getItem(draftKey(patientId)))
  if (d) return d
  if (initialCanvasData) return tryParse(typeof initialCanvasData === 'string' ? initialCanvasData : JSON.stringify(initialCanvasData))
  return null
}

function clearDraft(patientId, sessionId) {
  if (patientId) localStorage.removeItem(draftKey(patientId))
  if (sessionId) localStorage.removeItem(sessKey(sessionId))
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => resolve(r.result.split(',')[1])
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// ── Página A4 padrão — mostrada quando não há rascunho salvo ─────────────────
// Proporção A4: 210×297mm → ~794×1123px a 96 DPI. Usamos 800×1131.
const DEFAULT_PAGE_ELEMENT = {
  id: 'psicoai-page',
  type: 'rectangle',
  x: 0, y: 0,
  width: 800, height: 1131,
  angle: 0,
  strokeColor: '#d0ccc7',
  backgroundColor: '#ffffff',
  fillStyle: 'solid',
  strokeWidth: 1,
  strokeStyle: 'solid',
  roughness: 0,
  opacity: 100,
  groupIds: [],
  frameId: null,
  roundness: null,
  seed: 1234567890,
  version: 1,
  versionNonce: 1,
  isDeleted: false,
  boundElements: null,
  updated: 1,
  link: null,
  locked: true,   // não pode ser arrastado acidentalmente
}

const DEFAULT_PAGE_DATA = {
  elements: [DEFAULT_PAGE_ELEMENT],
  appState: {
    viewBackgroundColor: '#EDEAE4',
    scrollX: 120,
    scrollY: 60,
    zoom: { value: 0.85 },
  },
  files: {},
}

// ── Main component ────────────────────────────────────────────────────────────
const BACKEND_AUTOSAVE_INTERVAL_MS = 30_000  // sync pro backend a cada 30s

export default function CanvasSession({
  patient,
  isOpen,
  onClose,
  onMinimize,          // () → minimiza para background sem encerrar a sessão
  onAnalyze,
  onAutosave,          // (sessionId, { canvasDataJson, canvasTextContent }) → Promise — sync pro backend
  sessionId,
  initialCanvasData,   // JSON string — for reopening a previous session
}) {
  const [isDirty, setIsDirty]           = useState(false)
  const [exporting, setExporting]       = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  // syncStatus via DOM ref — sem useState para não re-renderizar o canvas a cada sync
  const syncLabelRef = useRef(null)

  // Canvas state
  const [canvasReady, setCanvasReady] = useState(false)
  const [initialData, setInitialData] = useState(null)
  const apiRef           = useRef(null)
  const saveTimerRef     = useRef(null)
  const backendSyncRef   = useRef(null)
  const sessionIdRef     = useRef(sessionId)
  const patientIdRef     = useRef(patient?.id)
  const onAutosaveRef    = useRef(onAutosave)

  // Keep refs in sync
  useEffect(() => { sessionIdRef.current  = sessionId },   [sessionId])
  useEffect(() => { patientIdRef.current  = patient?.id }, [patient?.id])
  useEffect(() => { onAutosaveRef.current = onAutosave },  [onAutosave])

  // When annotation opens: load saved state
  useEffect(() => {
    if (!isOpen) return
    setShowEndModal(false)
    setIsDirty(false)

    // Load canvas data from localStorage (or prop), fallback to default page
    if (patient?.id) {
      const saved = loadCanvas(patient.id, sessionId, initialCanvasData)
      setInitialData(saved || DEFAULT_PAGE_DATA)
    } else {
      setInitialData(DEFAULT_PAGE_DATA)
    }
    setCanvasReady(false)
  }, [isOpen, patient?.id, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Força save imediato (sem debounce) — usado em visibilitychange / pagehide
  const saveNow = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    saveCanvas(patientIdRef.current, sessionIdRef.current, apiRef.current)
  }, [])

  // Salva ao trocar de aba, minimizar, Ctrl+R, fechar janela — captura tudo que o debounce perderia
  useEffect(() => {
    if (!isOpen) return
    const onHide = () => { if (document.visibilityState === 'hidden') saveNow() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', saveNow)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', saveNow)
    }
  }, [isOpen, saveNow])

  // ── Backend autosave — sync periódico a cada 30s ──────────────────────────
  // Redundância crítica: se o localStorage for limpo (Safari ITP, cache clear),
  // o backend tem a última versão conhecida.
  //
  // PERFORMANCE: usa requestIdleCallback para rodar APENAS quando o browser está
  // ocioso entre frames. Nunca bloqueia input do usuário ou animação do canvas.
  // O status de sync vai pro DOM direto via ref — sem setState, sem re-render.
  const lastElementCountRef = useRef(0)

  const setSyncLabel = useCallback((text, color = 'rgba(255,255,255,0.45)') => {
    if (syncLabelRef.current) {
      syncLabelRef.current.textContent = text
      syncLabelRef.current.style.color = color
    }
  }, [])

  const syncToBackend = useCallback(() => {
    const sid = sessionIdRef.current
    const fn  = onAutosaveRef.current
    if (!sid || !fn || !apiRef.current) return

    // Serialização pesada — roda em idle para não bloquear o canvas
    const doWork = async () => {
      try {
        const elements = apiRef.current?.getSceneElements()
        if (!elements) return

        // Não sincroniza se nada mudou desde o último sync
        if (elements.length === lastElementCountRef.current && elements.length === 0) return

        setSyncLabel('Sincronizando…')

        const canvasTextContent = elements
          .filter(el => el.type === 'text' && el.text?.trim())
          .sort((a, b) => a.y - b.y || a.x - b.x)
          .map(el => el.text.trim())
          .join('\n') || null

        const canvasDataJson = JSON.stringify({
          v: STORAGE_VERSION,
          savedAt: Date.now(),
          elements,
          appState: { viewBackgroundColor: apiRef.current.getAppState()?.viewBackgroundColor || '#F7F4EF' },
          files: apiRef.current.getFiles(),
        })

        await fn(sid, { canvasDataJson, canvasTextContent })
        lastElementCountRef.current = elements.length
        setSyncLabel('✓ Salvo')
        setIsDirty(false)
        setTimeout(() => setSyncLabel(''), 3000)
      } catch {
        setSyncLabel('Só local', '#F39C12')
      }
    }

    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(() => doWork(), { timeout: 8000 })
    } else {
      // Fallback para Safari que não tem requestIdleCallback
      setTimeout(doWork, 0)
    }
  }, [setSyncLabel])

  useEffect(() => {
    if (!isOpen) {
      clearInterval(backendSyncRef.current)
      return
    }
    // Primeiro sync após 20s (tempo para o sessionId chegar do backend)
    const firstSync = setTimeout(() => {
      syncToBackend()
      backendSyncRef.current = setInterval(syncToBackend, BACKEND_AUTOSAVE_INTERVAL_MS)
    }, 20_000)
    return () => {
      clearTimeout(firstSync)
      clearInterval(backendSyncRef.current)
    }
  }, [isOpen, syncToBackend])

  // Debounced localStorage save on every canvas change (debounce reduzido para 800ms)
  const handleChange = useCallback(() => {
    setIsDirty(true)
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveCanvas(patientIdRef.current, sessionIdRef.current, apiRef.current)
    }, 800)
  }, [])

  const exportCanvas = async () => {
    let imageBase64      = null
    let canvasDataJson   = null
    let canvasTextContent = null
    try {
      if (apiRef.current && exportToBlob) {
        const elements = apiRef.current.getSceneElements()
        const appState = apiRef.current.getAppState()
        const files    = apiRef.current.getFiles()

        canvasDataJson = JSON.stringify({
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor || '#F7F4EF' },
          files,
        })

        // Extrai texto exato de todos os elementos de texto do canvas.
        // Enviado junto com a imagem para a IA ter fidelidade total ao conteúdo escrito
        // (elimina erros de OCR que aconteceriam se a IA precisasse "ler" a imagem sozinha).
        const textParts = elements
          .filter(el => el.type === 'text' && el.text?.trim())
          .sort((a, b) => a.y - b.y || a.x - b.x)  // ordem de leitura: top-bottom, left-right
          .map(el => el.text.trim())
        if (textParts.length > 0) {
          canvasTextContent = textParts.join('\n')
        }

        if (elements.length > 0) {
          const blob = await exportToBlob({
            elements,
            mimeType: 'image/png',
            appState: { ...appState, exportWithDarkMode: false, exportBackground: true },
            files,
          })
          imageBase64 = await blobToBase64(blob)
        }
      }
    } catch (e) {
      console.warn('[PsicoAI] exportCanvas failed:', e)
    }
    return { imageBase64, canvasDataJson, canvasTextContent }
  }

  const handleEndWithoutAI = async () => {
    setExporting(true)
    const { canvasDataJson, canvasTextContent } = await exportCanvas()
    setExporting(false)
    setShowEndModal(false)
    setIsDirty(false)
    clearDraft(patient?.id, sessionId)
    onClose({ duration: 0, canvasDataJson, canvasTextContent })
  }

  const handleEndWithAI = async () => {
    setExporting(true)
    const { imageBase64, canvasDataJson, canvasTextContent } = await exportCanvas()
    setExporting(false)
    setShowEndModal(false)
    setIsDirty(false)
    clearDraft(patient?.id, sessionId)
    onAnalyze({ imageBase64, duration: 0, canvasDataJson, canvasTextContent })
  }

  if (!isOpen) return null

  const patientName = patient?.name || 'Paciente'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', background: '#EDEAE4' }}>

      {/* Topbar */}
      <div className="cs-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Botão voltar — minimiza sem encerrar */}
          {onMinimize && (
            <button
              onClick={onMinimize}
              title="Voltar ao app"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: '8px',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.7)', cursor: 'pointer', flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
          )}
          <div className="cs-logo">Ψ</div>
          <div className="cs-patient" title={patientName}>{patientName}</div>
          {/* Sync status — atualizado via DOM ref, sem re-render React */}
          <span
            ref={syncLabelRef}
            style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', transition: 'color 0.3s' }}
          />
          {!navigator.onLine && (
            <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: 'rgba(243,156,18,0.2)', color: '#F39C12' }}>
              Offline
            </span>
          )}
        </div>
        <button className="cs-end-btn" onClick={() => setShowEndModal(true)}>
          Salvar anotação
        </button>
      </div>

      {/* Banner de rascunho não salvo */}
      {isDirty && (
        <div style={{
          background: 'rgba(243,156,18,0.12)',
          borderBottom: '1px solid rgba(243,156,18,0.3)',
          padding: '6px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
          fontSize: '11px', color: '#B7770D', fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Rascunho não salvo — clique em "Salvar anotação" para finalizar
        </div>
      )}

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!canvasReady && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', fontSize: '14px', color: 'var(--gr4)', flexDirection: 'column', background: '#F7F4EF', zIndex: 2 }}>
            <span style={{ width: 24, height: 24, border: '2px solid var(--gr2)', borderTopColor: 'var(--g500)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            Carregando canvas...
          </div>
        )}
        <Excalidraw
          key={`exc-${patient?.id || 'x'}-${sessionId || 'draft'}`}
          initialData={initialData || undefined}
          excalidrawAPI={(api) => {
            apiRef.current = api
            setCanvasReady(true)
          }}
          onChange={handleChange}
          langCode="pt-BR"
          theme="light"
          UIOptions={{
            canvasActions: {
              changeViewBackgroundColor: false,
              export: { saveFileToDisk: false },
              loadScene: false,
            },
            tools: { image: false },
          }}
        >
          {/* Menu customizado — remove links do Excalidraw (GitHub, Discord, X) */}
          <MainMenu>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.Help />
          </MainMenu>
        </Excalidraw>

        {/* Auto-save indicator */}
        {canvasReady && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12, zIndex: 5,
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '10px', color: 'rgba(0,0,0,0.28)',
            pointerEvents: 'none',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#27AE60', display: 'inline-block' }} />
            Salvo localmente
          </div>
        )}
      </div>

      {/* End session modal */}
      {showEndModal && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', touchAction: 'none', overscrollBehavior: 'none',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px',
            width: '100%', maxWidth: '440px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)', overflow: 'hidden',
          }}>
            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '20px', fontWeight: 400, color: '#1C1C1C', marginBottom: '8px' }}>
                Salvar anotação
              </div>
              <div style={{ fontSize: '13px', color: '#8B8B8B', lineHeight: 1.6 }}>
                {patientName} · O canvas ficará salvo no prontuário
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Com IA */}
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
                    {exporting ? 'Exportando canvas...' : 'Gerar reflexão clínica com IA'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--g600)', lineHeight: 1.5, paddingLeft: '26px' }}>
                  A IA lê o que você desenhou e escreveu — devolve hipóteses, padrões e conexões com sessões anteriores.
                </div>
              </button>

              {/* Sem IA */}
              <button
                onClick={handleEndWithoutAI}
                disabled={exporting}
                style={{
                  width: '100%', padding: '14px 16px', border: '1px solid var(--gr2)',
                  borderRadius: '12px', background: 'var(--w)', cursor: 'pointer',
                  textAlign: 'left', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--ow)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--w)'}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>Encerrar e salvar</div>
                <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>Salva o canvas no prontuário. Você pode analisar com IA depois.</div>
              </button>

              <button
                onClick={() => setShowEndModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--gr4)', fontSize: '12px', cursor: 'pointer', padding: '4px', fontFamily: "'DM Sans', sans-serif" }}
              >
                ← Continuar anotando
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
