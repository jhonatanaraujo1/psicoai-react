import { useState, useEffect, useRef, useCallback } from 'react'
import DOMPurify from 'dompurify'

// FE-002: config de sanitização para editor clínico — formatação básica, zero scripts/eventos
const EDITOR_SANITIZE = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h3', 'h4', 'span', 'div'],
  ALLOWED_ATTR: [],
}
const sanitizeHtml = (html) => DOMPurify.sanitize(html || '', EDITOR_SANITIZE)

const TOOLS = [
  { cmd: 'bold',          icon: <strong>B</strong>,  title: 'Negrito' },
  { cmd: 'italic',        icon: <em>I</em>,           title: 'Itálico' },
  { cmd: 'underline',     icon: <u>U</u>,             title: 'Sublinhado' },
  { cmd: 'separator' },
  { cmd: 'formatBlock',   arg: 'h3',                  title: 'Título',
    icon: <span style={{ fontFamily: "'Fraunces',serif", fontSize: '15px' }}>H</span> },
  { cmd: 'insertUnorderedList', title: 'Lista',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
  { cmd: 'separator' },
  { cmd: 'removeFormat',  title: 'Limpar formatação',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/><line x1="15" y1="5" x2="19" y2="9"/></svg> },
]

const GUIDE_ITEMS = [
  { icon: '💬', label: 'O que o paciente trouxe', hint: 'Queixa do dia, como chegou, humor' },
  { icon: '👁', label: 'O que você observou', hint: 'Postura, tom de voz, pausas, emoções visíveis' },
  { icon: '🔁', label: 'Padrões que apareceram', hint: 'Evitação, ruminação, contradições no discurso' },
  { icon: '💡', label: 'O que emergiu ou surpreendeu', hint: 'Insights, associações, temas novos' },
  { icon: '📌', label: 'O que ficou para a próxima', hint: 'Temas em aberto, tarefas, observações' },
]

// ── LocalStorage key for text draft ──────────────────────────────────────────
const textDraftKey = (patientId) => `psicoai_text_draft_p${patientId}`

export default function TextSession({ patient, isOpen, onClose, onMinimize, onAnalyze, sessionId, onAutosave, initialHtml = '' }) {
  const [showEndModal, setShowEndModal] = useState(false)
  const [showGuide, setShowGuide] = useState(true)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const autosaveRef   = useRef(null)
  const localSaveRef  = useRef(null)
  const editorRef     = useRef(null)
  const patientIdRef  = useRef(patient?.id)
  const lastSavedTextRef = useRef('')

  useEffect(() => { patientIdRef.current = patient?.id }, [patient?.id])

  // Força save imediato — usado em visibilitychange / pagehide
  const saveNow = useCallback(() => {
    clearTimeout(localSaveRef.current)
    if (patientIdRef.current && editorRef.current) {
      localStorage.setItem(textDraftKey(patientIdRef.current), editorRef.current.innerHTML)
    }
  }, [])

  // Salva ao trocar de aba, minimizar, Ctrl+R, fechar janela
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

  useEffect(() => {
    if (isOpen) {
      setShowEndModal(false)
      // Load draft from localStorage or initialHtml
      setTimeout(() => {
        if (!editorRef.current) return
        const draft = patient?.id ? localStorage.getItem(textDraftKey(patient.id)) : null
        // FE-002 FIX: sanitizar antes de injetar — draft e initialHtml podem conter XSS
        if (draft) {
          editorRef.current.innerHTML = sanitizeHtml(draft)
        } else if (initialHtml) {
          editorRef.current.innerHTML = sanitizeHtml(initialHtml)
        } else {
          editorRef.current.innerHTML = ''
        }
        // Não auto-focar em touch devices: abre o teclado imediatamente,
        // encolhe o viewport e causa o "zoom" visual no Android.
        const isTouchDevice = window.matchMedia('(pointer:coarse)').matches
        if (!isTouchDevice) editorRef.current.focus()
      }, 80)
    } else {
      clearTimeout(localSaveRef.current)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave every 30s only when content changed since last save
  useEffect(() => {
    if (!isOpen || !sessionId || !onAutosave) return
    autosaveRef.current = setInterval(() => {
      const text = editorRef.current?.innerText || ''
      if (text.trim() && text !== lastSavedTextRef.current) {
        lastSavedTextRef.current = text
        onAutosave(sessionId, { textContent: text })
      }
    }, 30000)
    return () => clearInterval(autosaveRef.current)
  }, [isOpen, sessionId, onAutosave])

  const exec = (cmd, arg) => {
    document.execCommand(cmd, false, arg || null)
    editorRef.current?.focus()
  }

  // Save to localStorage on every input (debounced 400ms)
  const handleInput = () => {
    clearTimeout(localSaveRef.current)
    localSaveRef.current = setTimeout(() => {
      if (patient?.id && editorRef.current) {
        localStorage.setItem(textDraftKey(patient.id), editorRef.current.innerHTML)
        setSavedIndicator(true)
        setTimeout(() => setSavedIndicator(false), 1500)
      }
    }, 400)
  }

  const clearDraft = () => {
    if (patient?.id) localStorage.removeItem(textDraftKey(patient.id))
  }

  const handleEndWithoutAI = () => {
    const text = editorRef.current?.innerText || ''
    const html = editorRef.current?.innerHTML || ''
    setShowEndModal(false)
    clearDraft()
    onClose({ textContent: text, htmlContent: html, duration: 0 })
  }

  const handleEndWithAI = () => {
    const text = editorRef.current?.innerText || ''
    const html = editorRef.current?.innerHTML || ''
    setShowEndModal(false)
    clearDraft()
    onAnalyze({ imageBase64: null, textContent: text, htmlContent: html, duration: 0 })
  }

  if (!isOpen) return null

  const patientName = patient?.name || '—'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, display: 'flex', flexDirection: 'column', background: '#F5F2EC' }}>

      {/* Topbar */}
      <div className="cs-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Botão minimizar — volta ao app sem encerrar sessão */}
          {onMinimize && (
            <button
              onClick={onMinimize}
              title="Minimizar sessão"
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
          <div className="cs-patient">{patientName}</div>
          <span style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
            background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)',
            letterSpacing: '0.5px', textTransform: 'uppercase',
          }}>Texto</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="cs-end-btn" onClick={() => setShowEndModal(true)}>Salvar anotação</button>
        </div>
      </div>

      {/* Toolbar de formatação */}
      <div className="ts-toolbar" style={{
        background: '#fff', borderBottom: '1px solid #E8E5E0',
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '2px',
        flexShrink: 0, overflowX: 'auto',
      }}>
        {TOOLS.map((t, i) =>
          t.cmd === 'separator' ? (
            <div key={i} style={{ width: '1px', height: '20px', background: '#E8E5E0', margin: '0 6px' }} />
          ) : (
            <button
              key={i}
              title={t.title}
              onMouseDown={e => { e.preventDefault(); exec(t.cmd, t.arg) }}
              style={{
                width: '32px', height: '32px', border: 'none', borderRadius: '6px',
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', color: '#3D4A3D', transition: 'background 0.12s',
              }}
              onMouseOver={e => e.currentTarget.style.background = '#F0EDE8'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
            >
              {t.icon}
            </button>
          )
        )}
        <div style={{ flex: 1 }} />
        {/* Offline / local save indicator */}
        <span className="ts-save-hint" style={{ fontSize: '10px', color: savedIndicator ? '#27AE60' : (!navigator.onLine ? '#F39C12' : '#A0A0A0'), display: 'flex', alignItems: 'center', gap: '4px', transition: 'color 0.3s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flexShrink: 1 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
          {!navigator.onLine ? 'Offline — salvo localmente' : savedIndicator ? 'Salvo' : <span className="ts-kbd-hint">Ctrl+B negrito · Ctrl+I itálico</span>}
        </span>
      </div>

      {/* Área de escrita */}
      <div className="ts-write-area" style={{ flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '32px 24px' }}>
        <div style={{ width: '100%', maxWidth: '720px' }}>

          {/* Cabeçalho da nota */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', color: '#1C1C1C', fontWeight: 400, marginBottom: '6px' }}>
              {patientName}
            </div>
            <div style={{ fontSize: '12px', color: '#8B8B8B' }}>
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{ marginTop: '16px', borderBottom: '1px solid #E8E5E0' }} />
          </div>

          {/* Guia de anotação */}
          {showGuide && (
            <div style={{
              background: 'linear-gradient(135deg, #F0F7F3 0%, #EAF2EE 100%)',
              border: '1px solid #C8DDD0',
              borderLeft: '3px solid #4A7C59',
              borderRadius: '10px',
              padding: '16px 18px',
              marginBottom: '28px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#2D4A38', marginBottom: '2px' }}>
                    📝 O que anotar aqui é a base da análise IA
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#4A7C59', lineHeight: 1.5 }}>
                    Quanto mais você escrever sobre o que aconteceu na sessão, mais precisa será a análise. Escreva do seu jeito — sem formato certo.
                  </div>
                </div>
                <button
                  onClick={() => setShowGuide(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A7C59', padding: '0 0 0 12px', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}
                  title="Fechar guia"
                >×</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {GUIDE_ITEMS.map(item => (
                  <button
                    key={item.label}
                    title={item.hint}
                    onClick={() => {
                      const editor = editorRef.current
                      if (!editor) return
                      editor.focus()
                      const text = `${item.label}: `
                      document.execCommand('insertText', false, (editor.innerText.trim() ? '\n\n' : '') + text)
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.7)', border: '1px solid #C8DDD0',
                      borderRadius: '20px', padding: '4px 10px',
                      fontSize: '11.5px', color: '#2D4A38', cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '5px',
                      transition: 'background 0.15s',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.95)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.7)'}
                  >
                    {item.icon} {item.label}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: '10px', fontSize: '10.5px', color: '#6A9A7A', fontStyle: 'italic' }}>
                Clique em qualquer tópico para inserir no texto · Passe o mouse para ver sugestões
              </div>
            </div>
          )}

          {/* Botão para reabrir guia */}
          {!showGuide && (
            <button
              onClick={() => setShowGuide(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '1px dashed #C8DDD0', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', color: '#6A9A7A', cursor: 'pointer', marginBottom: '20px', fontFamily: "'DM Sans', sans-serif' " }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              O que anotar?
            </button>
          )}

          {/* Editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Escreva o que aconteceu na sessão — o que o paciente trouxe, o que você observou, o que emergiu..."
            style={{
              minHeight: '420px', outline: 'none',
              fontSize: '15px', lineHeight: '1.8',
              color: '#1C1C1C', fontFamily: "'DM Sans', sans-serif",
              caretColor: 'var(--g500)',
            }}
            onInput={handleInput}
            onKeyDown={e => {
              // Tab insere espaços
              if (e.key === 'Tab') {
                e.preventDefault()
                document.execCommand('insertText', false, '    ')
              }
            }}
          />
        </div>
      </div>

      {/* Modal de encerramento */}
      {showEndModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', touchAction: 'none', overscrollBehavior: 'none',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px',
            width: '100%', maxWidth: '440px',
            maxHeight: 'min(90dvh,90svh,90vh)', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
          }}>
            <div style={{ padding: '24px 24px 16px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '20px', fontWeight: 400, color: '#1C1C1C', marginBottom: '6px' }}>
                Salvar anotação
              </div>
              <div style={{ fontSize: '13px', color: '#8B8B8B', lineHeight: 1.6, marginBottom: '12px' }}>
                {patientName} · {new Date().toLocaleDateString('pt-BR')}
              </div>
              {/* word count hint */}
              {(() => {
                const wc = editorRef.current?.innerText?.trim().split(/\s+/).filter(Boolean).length || 0
                const color = wc < 30 ? '#E74C3C' : wc < 80 ? '#F39C12' : '#27AE60'
                const msg = wc < 30
                  ? `Só ${wc} palavras — anotações curtas limitam a precisão da IA. Considere detalhar mais antes de encerrar.`
                  : wc < 80
                  ? `${wc} palavras — bom começo. Quanto mais detalhes, mais rica a análise.`
                  : `${wc} palavras — ótimo nível de detalhe para a IA trabalhar.`
                return (
                  <div style={{ fontSize: '12px', color, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: '7px', padding: '8px 12px', lineHeight: 1.5 }}>
                    {msg}
                  </div>
                )
              })()}
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <button
                onClick={handleEndWithAI}
                style={{
                  width: '100%', padding: '16px', border: '2px solid var(--g300)',
                  borderRadius: '12px', background: 'var(--g50)', cursor: 'pointer',
                  textAlign: 'left', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'var(--g100)'; e.currentTarget.style.borderColor = 'var(--g400)' }}
                onMouseOut={e => { e.currentTarget.style.background = 'var(--g50)'; e.currentTarget.style.borderColor = 'var(--g300)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--g700)' }}>Analisar minhas anotações com IA</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--g600)', lineHeight: 1.5, paddingLeft: '26px' }}>
                  A IA lê exatamente o que você escreveu e devolve hipóteses diagnósticas, padrões comportamentais e sugestões para a próxima sessão — tudo baseado nas suas anotações.
                </div>
              </button>

              <button
                onClick={handleEndWithoutAI}
                style={{
                  width: '100%', padding: '14px 16px', border: '1px solid var(--gr2)',
                  borderRadius: '12px', background: 'var(--w)', cursor: 'pointer',
                  textAlign: 'left', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--ow)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--w)'}
              >
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>Só salvar</div>
                <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>Suas notas ficam salvas no prontuário. Você pode pedir a análise depois, direto pelo paciente.</div>
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

      {/* Estilos do placeholder e headings */}
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #B0ADA8;
          pointer-events: none;
        }
        [contenteditable] h3 {
          font-family: 'Fraunces', serif;
          font-size: 18px;
          font-weight: 500;
          color: #1C1C1C;
          margin: 20px 0 8px;
        }
        [contenteditable] ul {
          padding-left: 20px;
          margin: 8px 0;
        }
        [contenteditable] li { margin-bottom: 4px; }
        [contenteditable] strong { font-weight: 700; }
        [contenteditable] em { font-style: italic; }

        /* ── Mobile first ───────────────────────────────────────────── */
        .ts-toolbar::-webkit-scrollbar { display: none }

        /* Em touch, esconde o hint de teclado (sem sentido com toque) */
        @media (hover: none) {
          .ts-kbd-hint { display: none }
        }

        /* Área de escrita: padding menor em mobile */
        @media (max-width: 640px) {
          .ts-write-area { padding: 20px 16px !important; }
          .ts-write-area > div:first-child { max-width: 100% !important; }
        }

        /* Botões da toolbar: aumenta área de toque em touch */
        @media (hover: none) and (pointer: coarse) {
          .ts-toolbar button { width: 40px !important; height: 40px !important; }
        }
      `}</style>
    </div>
  )
}
