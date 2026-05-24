import { useState, useRef, useEffect, useCallback } from 'react'

const NOTE_TYPES = [
  { id: 'post',  label: 'Pós-atendimento',  hint: 'Reflexões após a sessão' },
  { id: 'pre',   label: 'Pré-atendimento',  hint: 'Preparação para a próxima' },
  { id: 'obs',   label: 'Observação livre', hint: 'Registro entre sessões' },
]

const GUIDE_CHIPS = [
  { icon: '💬', label: 'O que o paciente trouxe' },
  { icon: '👁',  label: 'O que você observou' },
  { icon: '🔁', label: 'Padrões que apareceram' },
  { icon: '💡', label: 'O que emergiu' },
  { icon: '📌', label: 'Para a próxima sessão' },
]

const draftKey = (patientId) => `psicoai_quicknote_${patientId}`

export default function QuickNoteModal({ isOpen, patient, onClose, onSave, onAnalyze }) {
  const [noteType, setNoteType] = useState('post')
  const [saving, setSaving]     = useState(false)
  const [wordCount, setWordCount] = useState(0)
  const editorRef = useRef(null)
  const key = patient?.id ? draftKey(patient.id) : null

  // Reset & load draft when modal opens
  useEffect(() => {
    if (!isOpen) return
    setNoteType('post')
    setSaving(false)
    setTimeout(() => {
      if (!editorRef.current) return
      const draft = key ? localStorage.getItem(key) : null
      editorRef.current.innerHTML = draft || ''
      setWordCount(editorRef.current.innerText.trim().split(/\s+/).filter(Boolean).length || 0)
      editorRef.current.focus()
    }, 60)
  }, [isOpen, patient?.id]) // eslint-disable-line

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
    try {
      clearDraft()
      await onSave({ textContent, htmlContent, noteType })
    } finally {
      setSaving(false)
    }
  }

  const handleAnalyze = async () => {
    const { textContent, htmlContent } = getContent()
    if (!textContent) return
    setSaving(true)
    try {
      clearDraft()
      await onAnalyze({ textContent, htmlContent, noteType })
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const warnColor = wordCount === 0 ? 'var(--gr4)' : wordCount < 30 ? 'var(--warn)' : 'var(--g600)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(28,28,28,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <div style={{
        background: 'var(--ow)', borderRadius: '20px',
        width: '100%', maxWidth: '620px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 28px 80px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gr2)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '19px', fontWeight: 400, color: 'var(--d)', lineHeight: 1.2 }}>
                {patient?.name || 'Paciente'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gr4)', marginTop: '3px' }}>
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', padding: '4px', borderRadius: '6px', fontSize: '22px', lineHeight: 1, marginTop: '-2px' }}
            >
              ×
            </button>
          </div>

          {/* Tipo da anotação */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {NOTE_TYPES.map(t => (
              <button
                key={t.id}
                title={t.hint}
                onClick={() => setNoteType(t.id)}
                style={{
                  padding: '5px 14px', borderRadius: '20px', fontSize: '12px',
                  fontWeight: noteType === t.id ? 600 : 400,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.15s', border: '1.5px solid',
                  background: noteType === t.id ? 'var(--g600)' : 'var(--w)',
                  color:      noteType === t.id ? '#fff' : 'var(--gr5)',
                  borderColor: noteType === t.id ? 'var(--g600)' : 'var(--gr2)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Editor ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
          {/* Guide chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
            {GUIDE_CHIPS.map(chip => (
              <button
                key={chip.label}
                title={`Inserir tópico: ${chip.label}`}
                onMouseDown={e => {
                  e.preventDefault()
                  const ed = editorRef.current
                  if (!ed) return
                  ed.focus()
                  document.execCommand('insertText', false, (ed.innerText.trim() ? '\n\n' : '') + chip.label + ': ')
                  handleInput()
                }}
                style={{
                  background: 'var(--w)', border: '1px solid var(--gr2)',
                  borderRadius: '20px', padding: '4px 11px',
                  fontSize: '11.5px', color: 'var(--d2)',
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--g50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--w)'}
              >
                {chip.icon} {chip.label}
              </button>
            ))}
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            data-placeholder="Escreva livremente — o que trouxe, o que observou, o que ficou em aberto. Sem formato obrigatório."
            onInput={handleInput}
            style={{
              minHeight: '200px', outline: 'none',
              fontSize: '14.5px', lineHeight: '1.85',
              color: 'var(--d)', fontFamily: "'DM Sans', sans-serif",
              caretColor: 'var(--g500)',
            }}
          />
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 24px', borderTop: '1px solid var(--gr2)',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'var(--w)',
        }}>
          <span style={{ fontSize: '11px', color: warnColor, flex: 1, transition: 'color 0.2s' }}>
            {wordCount === 0
              ? 'Escreva algo para salvar'
              : wordCount < 30
              ? `${wordCount} palavras — adicione mais detalhes para uma análise rica`
              : `${wordCount} palavras ✓`}
          </span>

          <button
            onClick={handleSave}
            disabled={saving || wordCount === 0}
            style={{
              padding: '9px 18px', borderRadius: '10px',
              border: '1px solid var(--gr2)', background: 'var(--w)',
              color: 'var(--d)', fontSize: '13px', fontWeight: 500,
              cursor: (saving || wordCount === 0) ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif", opacity: (saving || wordCount === 0) ? 0.5 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {saving ? 'Salvando…' : 'Salvar anotação'}
          </button>

          <button
            onClick={handleAnalyze}
            disabled={saving || wordCount === 0}
            style={{
              padding: '9px 20px', borderRadius: '10px', border: 'none',
              background: wordCount === 0 ? 'var(--gr2)' : 'var(--g600)',
              color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: (saving || wordCount === 0) ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              transition: 'background 0.15s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            {saving ? 'Aguarde…' : 'Analisar com IA'}
          </button>
        </div>
      </div>

      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #B0ADA8;
          pointer-events: none;
        }
      `}</style>
    </div>
  )
}
