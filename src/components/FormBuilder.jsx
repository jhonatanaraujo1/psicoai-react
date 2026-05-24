import { useState, useCallback } from 'react'

// ── Field type definitions ────────────────────────────────────────────────────
export const FIELD_TYPES = [
  { id: 'text',     label: 'Texto curto',       icon: '—',  placeholder: 'Ex: Nome do responsável' },
  { id: 'textarea', label: 'Texto longo',        icon: '≡',  placeholder: 'Ex: Descreva como se sente...' },
  { id: 'radio',    label: 'Múltipla escolha',   icon: '◉',  placeholder: '' },
  { id: 'checkbox', label: 'Caixas de seleção',  icon: '☑',  placeholder: '' },
  { id: 'scale',    label: 'Escala (1–10)',       icon: '◀▶', placeholder: '' },
  { id: 'select',   label: 'Lista suspensa',      icon: '▾',  placeholder: '' },
  { id: 'date',     label: 'Data',               icon: '📅', placeholder: '' },
  { id: 'yesno',    label: 'Sim / Não',           icon: '○●', placeholder: '' },
  { id: 'section',  label: 'Separador de seção', icon: '─',  placeholder: 'Ex: Histórico de saúde' },
]

// ── Generate a stable ID ───────────────────────────────────────────────────────
const uid = () => `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

// ── Default new field ─────────────────────────────────────────────────────────
function newField(type = 'text') {
  const def = FIELD_TYPES.find(t => t.id === type) || FIELD_TYPES[0]
  return {
    id: uid(),
    type,
    label: '',
    placeholder: def.placeholder,
    required: false,
    options: (type === 'radio' || type === 'checkbox' || type === 'select')
      ? ['Opção 1', 'Opção 2']
      : [],
  }
}

// ── localStorage helpers ───────────────────────────────────────────────────────
export function loadCustomForms() {
  try { return JSON.parse(localStorage.getItem('psicoai_custom_forms') || '[]') } catch { return [] }
}
export function saveCustomForms(forms) {
  localStorage.setItem('psicoai_custom_forms', JSON.stringify(forms))
}

// ── Field preview (inside builder) ───────────────────────────────────────────
function FieldPreview({ field }) {
  const s = { fontSize: '13px', color: 'var(--d)', fontFamily: "'DM Sans', sans-serif" }
  if (field.type === 'section') {
    return (
      <div style={{ paddingBottom: '4px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--g600)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
          {field.label || 'Seção sem título'}
        </div>
        <div style={{ height: '1px', background: 'var(--gr2)', marginTop: '4px' }} />
      </div>
    )
  }
  if (field.type === 'text') return <input disabled placeholder={field.placeholder || 'Resposta curta'} style={{ ...s, width: '100%', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '7px 10px', background: 'var(--ow)', boxSizing: 'border-box', opacity: 0.7 }} />
  if (field.type === 'textarea') return <textarea disabled placeholder={field.placeholder || 'Resposta longa…'} rows={2} style={{ ...s, width: '100%', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '7px 10px', background: 'var(--ow)', resize: 'none', boxSizing: 'border-box', opacity: 0.7 }} />
  if (field.type === 'date') return <input type="date" disabled style={{ ...s, border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '7px 10px', background: 'var(--ow)', opacity: 0.7 }} />
  if (field.type === 'yesno') return (
    <div style={{ display: 'flex', gap: '10px' }}>
      {['Sim', 'Não'].map(o => <label key={o} style={{ ...s, display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.7 }}><input type="radio" disabled /> {o}</label>)}
    </div>
  )
  if (field.type === 'scale') return (
    <div style={{ opacity: 0.7 }}>
      <input type="range" min="1" max="10" disabled style={{ width: '100%', accentColor: 'var(--g500)' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--gr4)' }}><span>1</span><span>10</span></div>
    </div>
  )
  if (field.type === 'radio' || field.type === 'checkbox') {
    const inputType = field.type === 'radio' ? 'radio' : 'checkbox'
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', opacity: 0.7 }}>
        {(field.options || []).map((o, i) => (
          <label key={i} style={{ ...s, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type={inputType} disabled /> {o || `Opção ${i + 1}`}
          </label>
        ))}
      </div>
    )
  }
  if (field.type === 'select') return (
    <select disabled style={{ ...s, border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '7px 10px', background: 'var(--ow)', opacity: 0.7 }}>
      {(field.options || []).map((o, i) => <option key={i}>{o || `Opção ${i + 1}`}</option>)}
    </select>
  )
  return null
}

// ── Field editor row ──────────────────────────────────────────────────────────
function FieldEditor({ field, index, total, onChange, onDelete, onMove }) {
  const [open, setOpen] = useState(index === 0)

  const update = (key, val) => onChange({ ...field, [key]: val })
  const updateOption = (i, val) => {
    const opts = [...(field.options || [])]
    opts[i] = val
    update('options', opts)
  }
  const addOption = () => update('options', [...(field.options || []), ''])
  const removeOption = (i) => update('options', (field.options || []).filter((_, j) => j !== i))

  const typeDef = FIELD_TYPES.find(t => t.id === field.type)

  return (
    <div style={{ border: `1px solid ${open ? 'var(--g200)' : 'var(--gr2)'}`, borderRadius: 'var(--r)', background: 'var(--w)', overflow: 'hidden', transition: 'border-color 0.15s' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', gap: '10px', cursor: 'pointer', background: open ? 'var(--g50)' : 'var(--w)' }}
        onClick={() => setOpen(o => !o)}>
        {/* Order buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove(index, -1)} disabled={index === 0}
            style={{ width: 18, height: 16, border: '1px solid var(--gr2)', borderRadius: '3px', background: 'none', cursor: index === 0 ? 'not-allowed' : 'pointer', fontSize: '9px', color: 'var(--gr4)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: index === 0 ? 0.3 : 1 }}>▲</button>
          <button onClick={() => onMove(index, 1)} disabled={index === total - 1}
            style={{ width: 18, height: 16, border: '1px solid var(--gr2)', borderRadius: '3px', background: 'none', cursor: index === total - 1 ? 'not-allowed' : 'pointer', fontSize: '9px', color: 'var(--gr4)', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: index === total - 1 ? 0.3 : 1 }}>▼</button>
        </div>
        {/* Type badge */}
        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--g600)', background: 'var(--g50)', border: '1px solid var(--g100)', padding: '2px 8px', borderRadius: '20px', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {typeDef?.icon} {typeDef?.label}
        </span>
        {/* Label preview */}
        <span style={{ fontSize: '13px', color: field.label ? 'var(--d)' : 'var(--gr4)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: field.label ? 'normal' : 'italic' }}>
          {field.label || 'Campo sem título'}
        </span>
        {/* Required badge */}
        {field.required && <span style={{ fontSize: '10px', color: 'var(--danger)', flexShrink: 0 }}>*</span>}
        {/* Expand chevron */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="2"
          style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(90deg)' : 'none' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>

      {open && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--gr2)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Type selector */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {FIELD_TYPES.map(t => (
              <button key={t.id} onClick={() => update('type', t.id)}
                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '20px', border: `1px solid ${field.type === t.id ? 'var(--g300)' : 'var(--gr2)'}`, background: field.type === t.id ? 'var(--g50)' : 'var(--w)', color: field.type === t.id ? 'var(--g600)' : 'var(--gr5)', cursor: 'pointer', fontWeight: field.type === t.id ? 700 : 400, fontFamily: "'DM Sans', sans-serif", transition: 'all 0.12s' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Label */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '6px' }}>
              PERGUNTA / RÓTULO {field.required && <span style={{ color: 'var(--danger)' }}>*</span>}
            </div>
            <input
              value={field.label}
              onChange={e => update('label', e.target.value)}
              placeholder="Ex: Qual sua queixa principal?"
              style={{ width: '100%', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--ow)', color: 'var(--d)', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = 'var(--g300)'}
              onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
            />
          </div>

          {/* Placeholder (text/textarea) */}
          {(field.type === 'text' || field.type === 'textarea') && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '6px' }}>PLACEHOLDER</div>
              <input
                value={field.placeholder}
                onChange={e => update('placeholder', e.target.value)}
                placeholder="Texto de exemplo dentro do campo"
                style={{ width: '100%', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--ow)', color: 'var(--d)', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--g300)'}
                onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
              />
            </div>
          )}

          {/* Options (radio/checkbox/select) */}
          {(field.type === 'radio' || field.type === 'checkbox' || field.type === 'select') && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '8px' }}>OPÇÕES</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {(field.options || []).map((opt, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      value={opt}
                      onChange={e => updateOption(i, e.target.value)}
                      placeholder={`Opção ${i + 1}`}
                      style={{ flex: 1, border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '6px 10px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--ow)', color: 'var(--d)' }}
                      onFocus={e => e.target.style.borderColor = 'var(--g300)'}
                      onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
                    />
                    <button onClick={() => removeOption(i)} disabled={field.options.length <= 1}
                      style={{ width: 28, height: 28, borderRadius: 'var(--r)', border: '1px solid var(--gr2)', background: 'none', cursor: 'pointer', color: 'var(--gr4)', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: field.options.length <= 1 ? 0.3 : 1 }}>
                      ×
                    </button>
                  </div>
                ))}
                <button onClick={addOption}
                  style={{ alignSelf: 'flex-start', fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--r)', border: '1px dashed var(--gr2)', background: 'none', color: 'var(--g600)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  + Adicionar opção
                </button>
              </div>
            </div>
          )}

          {/* Preview */}
          {field.type !== 'section' && (
            <div style={{ background: 'var(--ow)', borderRadius: 'var(--r)', padding: '12px', border: '1px solid var(--gr2)' }}>
              <div style={{ fontSize: '10px', color: 'var(--gr4)', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.5px' }}>PRÉ-VISUALIZAÇÃO</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--d2)', marginBottom: '6px' }}>
                {field.label || 'Campo sem título'}{field.required ? <span style={{ color: 'var(--danger)' }}> *</span> : ''}
              </div>
              <FieldPreview field={field} />
            </div>
          )}

          {/* Footer: required toggle + delete */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}>
              <div
                onClick={() => update('required', !field.required)}
                style={{
                  width: 34, height: 18, borderRadius: '9px', background: field.required ? 'var(--g500)' : 'var(--gr2)',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: field.required ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
              <span style={{ fontSize: '12px', color: 'var(--gr5)' }}>Obrigatório</span>
            </label>
            <button onClick={onDelete}
              style={{ fontSize: '12px', padding: '5px 12px', borderRadius: 'var(--r)', border: '1px solid var(--danger-l)', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              Remover campo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main FormBuilder modal ────────────────────────────────────────────────────
export default function FormBuilder({ isOpen, initial = null, onSave, onClose }) {
  const [title, setTitle] = useState(initial?.name || '')
  const [desc, setDesc]   = useState(initial?.desc || '')
  const [fields, setFields] = useState(initial?.fields || [newField('text')])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // reset when reopened
  const handleOpen = useCallback(() => {
    setTitle(initial?.name || '')
    setDesc(initial?.desc || '')
    setFields(initial?.fields || [newField('text')])
    setAddMenuOpen(false)
  }, [initial])

  // expose reset via effect
  if (!isOpen) return null

  const updateField = (idx, updated) => setFields(fs => fs.map((f, i) => i === idx ? updated : f))
  const deleteField = (idx) => setFields(fs => fs.filter((_, i) => i !== idx))
  const moveField = (idx, dir) => setFields(fs => {
    const next = [...fs]
    const target = idx + dir
    if (target < 0 || target >= next.length) return fs
    ;[next[idx], next[target]] = [next[target], next[idx]]
    return next
  })
  const addField = (type) => {
    setFields(fs => [...fs, newField(type)])
    setAddMenuOpen(false)
  }

  const handleSave = () => {
    if (!title.trim()) return
    setSaving(true)
    const form = {
      id: initial?.id || uid(),
      name: title.trim(),
      desc: desc.trim(),
      fields,
      icon: '🗒️',
      type: 'custom',
      meta: `${fields.filter(f => f.type !== 'section').length} campos`,
      badge: 'Personalizado',
      badgeClass: 'badge-gray',
      createdAt: initial?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    onSave(form)
    setSaving(false)
  }

  const canSave = title.trim().length > 0 && fields.length > 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end',
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        width: '100%', maxWidth: '640px',
        background: 'var(--w)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        animation: 'slideInRight 0.22s ease',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gr2)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 400, color: 'var(--d)', marginBottom: '2px' }}>
              {initial ? 'Editar formulário' : 'Novo formulário'}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--gr4)' }}>
              {fields.filter(f => f.type !== 'section').length} campo{fields.filter(f => f.type !== 'section').length !== 1 ? 's' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--gr5)', lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Form meta */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: 'var(--ow)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '6px' }}>NOME DO FORMULÁRIO *</div>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Ex: Avaliação de ansiedade social"
                style={{ width: '100%', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, outline: 'none', background: 'var(--w)', color: 'var(--d)', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--g300)'}
                onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
              />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '6px' }}>DESCRIÇÃO (opcional)</div>
              <input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Ex: Enviado antes da primeira sessão"
                style={{ width: '100%', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--w)', color: 'var(--d)', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--g300)'}
                onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
              />
            </div>
          </div>

          {/* Fields */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '10px' }}>CAMPOS DO FORMULÁRIO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {fields.map((field, idx) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  index={idx}
                  total={fields.length}
                  onChange={updated => updateField(idx, updated)}
                  onDelete={() => deleteField(idx)}
                  onMove={(i, dir) => moveField(i, dir)}
                />
              ))}
            </div>

            {/* Add field button */}
            <div style={{ position: 'relative', marginTop: '10px' }}>
              <button
                onClick={() => setAddMenuOpen(o => !o)}
                style={{ width: '100%', padding: '10px', border: '1.5px dashed var(--g200)', borderRadius: 'var(--r)', background: 'none', color: 'var(--g600)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 0.12s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--g50)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Adicionar campo
              </button>

              {addMenuOpen && (
                <div style={{
                  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
                  background: 'var(--w)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)',
                  boxShadow: 'var(--sh2)', zIndex: 50, overflow: 'hidden',
                }}>
                  <div style={{ padding: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' }}>
                    {FIELD_TYPES.map(t => (
                      <button key={t.id} onClick={() => addField(t.id)}
                        style={{ padding: '8px 10px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--ow)', cursor: 'pointer', fontSize: '12px', color: 'var(--d)', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '6px', textAlign: 'left', transition: 'all 0.1s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--g50)'; e.currentTarget.style.borderColor = 'var(--g200)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--ow)'; e.currentTarget.style.borderColor = 'var(--gr2)' }}
                      >
                        <span style={{ fontSize: '14px' }}>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gr2)', flexShrink: 0, display: 'flex', gap: '10px', justifyContent: 'flex-end', background: 'var(--ow)' }}>
          <button onClick={onClose}
            style={{ padding: '9px 18px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', color: 'var(--gr5)', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={!canSave || saving}
            style={{ padding: '9px 22px', border: 'none', borderRadius: 'var(--r)', background: canSave ? 'var(--g500)' : 'var(--gr2)', color: canSave ? '#fff' : 'var(--gr4)', cursor: canSave ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            {saving ? 'Salvando…' : 'Salvar formulário'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
