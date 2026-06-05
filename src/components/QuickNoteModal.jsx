import { useState, useRef, useEffect, useCallback } from 'react'
import DOMPurify from 'dompurify'

// FE-002: sanitizar draft do localStorage antes de usar como innerHTML
const sanitizeQN = (html) => DOMPurify.sanitize(html || '', {
  ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'em', 'i', 'u', 'ul', 'ol', 'li', 'span'],
  ALLOWED_ATTR: [],
})

const NOTE_TYPES = [
  { id: 'post', label: 'Pós-atendimento', hint: 'Reflexões após a sessão' },
  { id: 'pre',  label: 'Pré-atendimento', hint: 'Preparação para a próxima' },
  { id: 'obs',  label: 'Observação livre', hint: 'Registro entre sessões' },
]

const CHIP_ICONS = {
  trouxe:   <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  observou: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg>,
  padroes:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  emergiu:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  proxima:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 12h18"/><path d="M13 5l7 7-7 7"/></svg>,
}

const GUIDE_CHIPS = [
  { icon: CHIP_ICONS.trouxe,   label: 'O que o paciente trouxe' },
  { icon: CHIP_ICONS.observou, label: 'O que você observou' },
  { icon: CHIP_ICONS.padroes,  label: 'Padrões que apareceram' },
  { icon: CHIP_ICONS.emergiu,  label: 'O que emergiu' },
  { icon: CHIP_ICONS.proxima,  label: 'Para a próxima sessão' },
]

const draftKey = (patientId) => `psicoai_quicknote_${patientId}`

/**
 * C-04: Insere texto na posição atual do cursor usando Selection API.
 * Substitui document.execCommand('insertText') que é deprecated e quebrado no iOS Safari.
 */
function insertAtCursor(el, text) {
  el.focus()
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0 && el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
    const range = sel.getRangeAt(0)
    range.deleteContents()
    const node = document.createTextNode(text)
    range.insertNode(node)
    range.setStartAfter(node)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    // fallback: append ao final e move cursor
    const range = document.createRange()
    const textNode = document.createTextNode(text)
    el.appendChild(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(range)
  }
}

export default function QuickNoteModal({ isOpen, patient, onClose, onSave, onAnalyze, onOpenCanvas }) {
  const [noteType, setNoteType]     = useState('post')
  const [saving, setSaving]         = useState(false)
  const [wordCount, setWordCount]   = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const editorRef  = useRef(null)
  const key = patient?.id ? draftKey(patient.id) : null

  // N-02: isTouchDevice dentro do componente, reativo a mudanças de pointer (ex: tablet + mouse externo)
  const isTouchDevice = useRef(
    typeof window !== 'undefined' && window.matchMedia('(pointer:coarse)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(pointer:coarse)')
    const handler = (e) => { isTouchDevice.current = e.matches }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // M-08: Travar scroll do body quando modal abre — única forma confiável no iOS Safari
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-lock')
    } else {
      document.body.classList.remove('modal-lock')
    }
    return () => document.body.classList.remove('modal-lock')
  }, [isOpen])

  // N-04: Reset com setTimeout limpo (cancel flag evita setState em componente desmontado)
  useEffect(() => {
    if (!isOpen) return
    setNoteType('post')
    setSaving(false)
    setFullscreen(false)
    let cancelled = false
    const id = setTimeout(() => {
      if (cancelled || !editorRef.current) return
      const draft = key ? localStorage.getItem(key) : null
      editorRef.current.innerHTML = sanitizeQN(draft) // FE-002 FIX
      setWordCount(editorRef.current.innerText.trim().split(/\s+/).filter(Boolean).length || 0)
      // Em touch NÃO auto-focamos: abre o teclado virtual imediatamente no Android/iOS
      if (!isTouchDevice.current) editorRef.current.focus()
    }, 60)
    return () => { cancelled = true; clearTimeout(id) }
  }, [isOpen, patient?.id]) // eslint-disable-line

  // N-01: Escape fecha o modal
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // C-05: Visual Viewport API — rola editor para ficar visível quando teclado virtual abre
  useEffect(() => {
    if (!isOpen) return
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      if (editorRef.current) {
        editorRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [isOpen])

  const handleInput = useCallback(() => {
    if (!editorRef.current) return
    const text = editorRef.current.innerText
    setWordCount(text.trim().split(/\s+/).filter(Boolean).length || 0)
    if (key) localStorage.setItem(key, editorRef.current.innerHTML)
  }, [key])

  const getContent = () => ({
    textContent: editorRef.current?.innerText?.trim() || '',
    htmlContent: editorRef.current?.innerHTML || '',
  })

  const clearDraft = () => { if (key) localStorage.removeItem(key) }

  const handleSave = async () => {
    const { textContent, htmlContent } = getContent()
    if (!textContent) return
    setSaving(true)
    try { clearDraft(); await onSave({ textContent, htmlContent, noteType }) }
    finally { setSaving(false) }
  }

  const handleAnalyze = async () => {
    const { textContent, htmlContent } = getContent()
    if (!textContent) return
    setSaving(true)
    try { clearDraft(); await onAnalyze({ textContent, htmlContent, noteType }) }
    finally { setSaving(false) }
  }

  const handleOpenCanvas = () => {
    clearDraft()
    onClose()
    onOpenCanvas?.()
  }

  if (!isOpen) return null

  const warnColor = wordCount === 0
    ? 'var(--gr4)'
    : wordCount < 30
    ? 'var(--warn)'
    : 'var(--g600)'

  return (
    /* N-01: role + aria-modal para screen readers */
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Anotação clínica — ${patient?.name || 'Paciente'}`}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        zIndex: 600,
        // M-07: overlay SEMPRE rgba escuro — nunca var(--ow)
        background: 'rgba(28,28,28,0.5)',
        display: 'flex',
        alignItems: fullscreen ? 'stretch' : 'center',
        justifyContent: 'center',
        padding: fullscreen ? '0' : '20px',
        // C-01: pan-x pan-y no overlay — permite scroll interno nos filhos
        touchAction: 'pan-x pan-y',
        overscrollBehavior: 'none',
      }}
    >
      <div style={{
        background: 'var(--ow)',
        borderRadius: fullscreen ? '0' : '20px',
        width: '100%',
        // M-06: maxWidth e maxHeight animados junto com border-radius
        maxWidth: fullscreen ? '100%' : '640px',
        maxHeight: fullscreen ? '100dvh' : 'min(90dvh, 90vh)',
        height: fullscreen ? '100%' : undefined,
        display: 'flex', flexDirection: 'column',
        boxShadow: fullscreen ? 'none' : '0 28px 80px rgba(0,0,0,0.22)',
        overflow: 'hidden',
        transition: 'border-radius 0.2s, box-shadow 0.2s, max-width 0.25s, max-height 0.25s',
        // C-03: safe-area em fullscreen — protege contra notch e home indicator iOS
        paddingTop:    fullscreen ? 'env(safe-area-inset-top, 0px)' : undefined,
        paddingBottom: fullscreen ? 'env(safe-area-inset-bottom, 0px)' : undefined,
        paddingLeft:   fullscreen ? 'env(safe-area-inset-left, 0px)' : undefined,
        paddingRight:  fullscreen ? 'env(safe-area-inset-right, 0px)' : undefined,
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '16px 20px 14px', borderBottom: '1px solid var(--gr2)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '12px',
            gap: '8px',
          }}>
            {/* M-02: flex: 1 + minWidth: 0 + overflow ellipsis — nome não quebra o header */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "'Fraunces', serif", fontSize: '19px', fontWeight: 400,
                color: 'var(--d)', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {patient?.name || 'Paciente'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gr4)', marginTop: '3px' }}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>

            {/* M-02: flexShrink: 0 — botões nunca comprimem */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>

              {/* Fullscreen toggle — M-01: min 44×44 via classe CSS */}
              <button
                onClick={() => setFullscreen(v => !v)}
                aria-label={fullscreen ? 'Sair do fullscreen' : 'Expandir para fullscreen'}
                title={fullscreen ? 'Sair do fullscreen' : 'Expandir para fullscreen'}
                className="qnm-icon-btn"
              >
                {fullscreen ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                    <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/>
                    <path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/>
                  </svg>
                )}
              </button>

              {/* Canvas — N-05: label some em < 400px via CSS */}
              {onOpenCanvas && (
                <button
                  onClick={handleOpenCanvas}
                  title="Abrir canvas de desenho"
                  className="qnm-canvas-btn"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                    <path d="M2 2l7.586 7.586"/>
                    <circle cx="11" cy="11" r="2"/>
                  </svg>
                  <span className="qnm-canvas-label">Usar canvas</span>
                </button>
              )}

              {/* Fechar — M-01: min 44×44, N-01: aria-label */}
              <button
                onClick={onClose}
                aria-label="Fechar modal"
                title="Fechar"
                className="qnm-icon-btn"
                style={{ fontSize: '22px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Tipo da anotação — M-01: minHeight 36px */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {NOTE_TYPES.map(t => (
              <button
                key={t.id}
                title={t.hint}
                onClick={() => setNoteType(t.id)}
                style={{
                  padding: '7px 14px', borderRadius: '20px', fontSize: '12px',
                  minHeight: '36px',
                  fontWeight: noteType === t.id ? 600 : 400,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.15s', border: '1.5px solid',
                  touchAction: 'manipulation',
                  background:  noteType === t.id ? 'var(--g600)' : 'var(--w)',
                  color:       noteType === t.id ? '#fff' : 'var(--gr5)',
                  borderColor: noteType === t.id ? 'var(--g600)' : 'var(--gr2)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Editor ── */}
        {/* C-01: touchAction: pan-y neste div permite scroll vertical interno no iOS */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 20px',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch', // N-06: momentum scroll iOS < 13
        }}>
          {/* Guide chips — C-04: onPointerDown + Selection API (sem execCommand) */}
          {/* M-04: sem onMouseEnter/Leave inline — hover via CSS classe */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
            {GUIDE_CHIPS.map(chip => (
              <button
                key={chip.label}
                title={`Inserir: ${chip.label}`}
                className="qnm-chip"
                onPointerDown={e => {
                  e.preventDefault() // mantém foco no editor sem fechar teclado
                  const ed = editorRef.current
                  if (!ed) return
                  const prefix = ed.innerText.trim() ? '\n\n' : ''
                  insertAtCursor(ed, prefix + chip.label + ': ')
                  handleInput()
                }}
              >
                <span style={{ color: 'var(--g600)', display: 'flex', alignItems: 'center' }}>
                  {chip.icon}
                </span>
                {chip.label}
              </button>
            ))}
          </div>

          {/* C-02: fontSize 16px — >= 16px é obrigatório para não disparar auto-zoom iOS */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Escreva livremente — o que trouxe, o que observou, o que ficou em aberto. Sem formato obrigatório."
            onInput={handleInput}
            style={{
              minHeight: fullscreen ? '60vh' : '180px',
              outline: 'none',
              fontSize: '16px',
              lineHeight: '1.75',
              color: 'var(--d)',
              fontFamily: "'DM Sans', sans-serif",
              caretColor: 'var(--g500)',
            }}
          />
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--gr2)',
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--w)', flexShrink: 0,
        }}>
          {/* M-03: minWidth: 0 para não comprimir os botões */}
          <span style={{
            fontSize: '11px', color: warnColor, flex: 1,
            minWidth: 0, transition: 'color 0.2s',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {wordCount === 0
              ? 'Escreva algo para salvar'
              : wordCount < 30
              ? `${wordCount} palavras — adicione mais detalhes`
              : `${wordCount} palavras ✓`}
          </span>

          {/* M-03: flexShrink: 0 + whiteSpace: nowrap — botões nunca quebram texto */}
          <button
            onClick={handleSave}
            disabled={saving || wordCount === 0}
            style={{
              padding: '9px 16px', borderRadius: '10px',
              border: '1px solid var(--gr2)', background: 'var(--w)',
              color: 'var(--d)', fontSize: '13px', fontWeight: 500,
              cursor: (saving || wordCount === 0) ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              opacity: (saving || wordCount === 0) ? 0.5 : 1,
              transition: 'opacity 0.15s',
              flexShrink: 0, whiteSpace: 'nowrap',
              touchAction: 'manipulation',
            }}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>

          <button
            onClick={handleAnalyze}
            disabled={saving || wordCount === 0}
            style={{
              padding: '9px 18px', borderRadius: '10px', border: 'none',
              background: wordCount === 0 ? 'var(--gr2)' : 'var(--g600)',
              color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: (saving || wordCount === 0) ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              transition: 'background 0.15s',
              flexShrink: 0, whiteSpace: 'nowrap',
              touchAction: 'manipulation',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {saving ? 'Aguarde…' : 'Analisar com IA'}
          </button>
        </div>

      </div>
    </div>
  )
}
