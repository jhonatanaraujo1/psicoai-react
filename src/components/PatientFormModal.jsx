import { useState, useEffect, useRef } from 'react'
import { DatePicker, TimePicker, CustomSelect } from './DateTimePickers'

const GENEROS = ['Feminino', 'Masculino', 'Não-binário', 'Prefiro não informar']
const ABORDAGENS = ['TCC', 'Psicanálise', 'Humanista', 'EMDR', 'ACT', 'DBT', 'Gestalt', 'Outra']
const FREQUENCIAS = ['Semanal', 'Quinzenal', 'Mensal', 'Sob demanda']

// CIDs mais comuns — aparecem como sugestões de tag
const CID_SUGESTOES = [
  { code: 'F32.1', label: 'Depressão moderada' },
  { code: 'F33.1', label: 'Depressão recorrente' },
  { code: 'F40.1', label: 'Fobia social' },
  { code: 'F41.1', label: 'TAG' },
  { code: 'F41.0', label: 'Transtorno de pânico' },
  { code: 'F43.1', label: 'TEPT' },
  { code: 'F43.2', label: 'Transtorno adaptativo' },
  { code: 'F60.3', label: 'TPB' },
  { code: 'F90.0', label: 'TDAH' },
  { code: 'F20.0', label: 'Esquizofrenia paranoide' },
  { code: 'F31.1', label: 'Transtorno bipolar' },
  { code: 'F50.0', label: 'Anorexia nervosa' },
  { code: 'F50.2', label: 'Bulimia nervosa' },
]

const DIAS_SEMANA = [
  { label: 'Segunda-feira', value: '1' },
  { label: 'Terça-feira',   value: '2' },
  { label: 'Quarta-feira',  value: '3' },
  { label: 'Quinta-feira',  value: '4' },
  { label: 'Sexta-feira',   value: '5' },
  { label: 'Sábado',        value: '6' },
  { label: 'Domingo',       value: '7' },
]

const Field = ({ label, required, hint, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
      {label}{required && <span style={{ color: 'var(--danger)', marginLeft: '3px' }}>*</span>}
    </label>
    {children}
    {hint && <span style={{ fontSize: '11px', color: 'var(--gr4)' }}>{hint}</span>}
  </div>
)

const inputStyle = {
  border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
  padding: '9px 12px', fontSize: '13px', color: 'var(--d)',
  fontFamily: "'DM Sans', sans-serif", outline: 'none',
  background: 'var(--ow)', transition: 'border-color 0.15s',
  width: '100%', boxSizing: 'border-box',
}

const onFocus = e => { e.target.style.borderColor = 'var(--g300)'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.08)' }
const onBlur  = e => { e.target.style.borderColor = 'var(--gr2)'; e.target.style.boxShadow = 'none' }

// ─── Top-level input primitives ───────────────────────────────────────────────
// MUST stay outside any component function — defining them inside causes React to
// create a new component type on every render, unmounting/remounting the element
// and losing focus after every keystroke.
const CadastroInput = ({ value, onChange, placeholder, type = 'text', error = false }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    onFocus={onFocus}
    onBlur={onBlur}
    style={{ ...inputStyle, borderColor: error ? 'var(--danger)' : 'var(--gr2)' }}
  />
)

const CadastroTextarea = ({ value, onChange, placeholder, rows = 3, error = false }) => (
  <textarea
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    rows={rows}
    onFocus={onFocus}
    onBlur={onBlur}
    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, borderColor: error ? 'var(--danger)' : 'var(--gr2)' }}
  />
)

// ─── CID Tag Input ─────────────────────────────────────────────────────────────
// Armazena como string separada por vírgula no form.cid (retrocompatível).
function CidTagInput({ value, onChange }) {
  const [inputVal, setInputVal]     = useState('')
  const [showSugs, setShowSugs]     = useState(false)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  // Parse — value é string "F32.1 — Depressão moderada, F41.1 — TAG"
  const tags = value
    ? value.split(',').map(t => t.trim()).filter(Boolean)
    : []

  const filteredSugs = CID_SUGESTOES.filter(s => {
    const q = inputVal.toLowerCase()
    const full = `${s.code} ${s.label}`.toLowerCase()
    const alreadyAdded = tags.some(t => t.includes(s.code))
    return !alreadyAdded && (!q || full.includes(q))
  })

  function addTag(tag) {
    const newTags = [...tags, tag]
    onChange(newTags.join(', '))
    setInputVal('')
    inputRef.current?.focus()
  }

  function removeTag(idx) {
    const newTags = tags.filter((_, i) => i !== idx)
    onChange(newTags.join(', '))
  }

  function handleKey(e) {
    if ((e.key === 'Enter' || e.key === ',') && inputVal.trim()) {
      e.preventDefault()
      addTag(inputVal.trim())
      setInputVal('')
    }
    if (e.key === 'Backspace' && !inputVal && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowSugs(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Tag + input wrapper */}
      <div
        onClick={() => { inputRef.current?.focus(); setShowSugs(true) }}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
          minHeight: '40px', padding: '6px 10px',
          border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
          background: 'var(--ow)', cursor: 'text',
          transition: 'border-color 0.15s',
        }}
        onFocus={() => setShowSugs(true)}
      >
        {tags.map((tag, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '3px 8px', borderRadius: '20px',
            background: 'var(--g50)', color: 'var(--g700)',
            border: '1px solid var(--g100)',
            fontSize: '12px', fontWeight: 500, lineHeight: 1.4,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {tag}
            <button
              onMouseDown={e => { e.preventDefault(); removeTag(i) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--g500)', padding: '0', lineHeight: 1, fontSize: '13px', display: 'flex', alignItems: 'center' }}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setShowSugs(true) }}
          onFocus={() => setShowSugs(true)}
          onKeyDown={handleKey}
          placeholder={tags.length === 0 ? 'Digitar ou selecionar CID…' : ''}
          style={{
            border: 'none', outline: 'none', background: 'transparent',
            fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
            color: 'var(--d)', flex: '1 1 120px', minWidth: '80px',
            padding: '2px 0',
          }}
        />
      </div>

      {/* Dropdown sugestões */}
      {showSugs && filteredSugs.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--w)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
          boxShadow: 'var(--sh2)', zIndex: 400,
          maxHeight: '200px', overflowY: 'auto',
        }}>
          {filteredSugs.map(s => (
            <div
              key={s.code}
              onMouseDown={e => { e.preventDefault(); addTag(`${s.code} — ${s.label}`) }}
              style={{
                padding: '9px 12px', cursor: 'pointer', fontSize: '13px',
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--g50)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}
            >
              <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--g600)', minWidth: '52px' }}>{s.code}</span>
              <span style={{ color: 'var(--gr5)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      <span style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '2px', display: 'block' }}>
        Selecione nas sugestões ou digitar o código + Enter. Múltiplos CIDs permitidos.
      </span>
    </div>
  )
}

const emptyForm = {
  nome: '', dataNasc: '', genero: '', email: '', telefone: '',
  queixa: '', historico: '', medicacao: '', abordagem: '', frequencia: '',
  cid: '', pagamento: 'Particular',
  // Recorrência + cobrança
  recurringDayOfWeek: '', recurringTime: '', recurringDurationMin: '50',
  billingType: '',
  billingDay: '',
  valor: '',
  monthlyValue: '',
}

function formFromData(d) {
  if (!d) return emptyForm
  return {
    nome: d.name || '', dataNasc: d.birthDate || '', genero: d.gender || '',
    email: d.email || '', telefone: d.phone || '', queixa: d.complaint || '',
    historico: d.history || '', medicacao: d.medication || '',
    abordagem: d.approach || '', frequencia: d.frequency || '',
    cid: d.cid || '', pagamento: d.payment || 'Particular',
    valor: d.sessionValue ? String(d.sessionValue) : '',
    // Recorrência
    recurringDayOfWeek:   d.recurringDayOfWeek   ? String(d.recurringDayOfWeek)   : '',
    recurringTime:        d.recurringTime         || '',
    recurringDurationMin: d.recurringDurationMin  ? String(d.recurringDurationMin) : '50',
    billingType:          d.billingType           || '',
    billingDay:           d.billingDay            ? String(d.billingDay)            : '',
    monthlyValue:         d.monthlyValue          ? String(d.monthlyValue)         : '',
  }
}

export default function PatientFormModal({ isOpen, onClose, onSave, initialData = null }) {
  const [form, setForm] = useState(() => formFromData(initialData))
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (isOpen) {
      setForm(formFromData(initialData))
      setErrors({})
    }
  }, [initialData, isOpen])

  if (!isOpen) return null

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const validate = () => {
    const e = {}
    if (!form.nome.trim()) e.nome = true
    if (!form.genero) e.genero = true
    if (!form.queixa.trim()) e.queixa = true
    if (!form.abordagem) e.abordagem = true
    if (form.email && form.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(form.email.trim())) {
        e.email = 'Email inválido'
      }
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave(form)
    onClose()
  }

  // Label e campo do valor dependem do modelo de cobrança
  const isPerSession = form.billingType === 'per_session' || !form.billingType
  const isRecurring  = !isPerSession && form.billingType !== ''
  const VALUE_LABELS = { weekly: 'Valor semanal (R$)', biweekly: 'Valor quinzenal (R$)', monthly: 'Valor mensal (R$)', quarterly: 'Valor trimestral (R$)', annual: 'Valor anual (R$)' }
  const valueLabel   = isRecurring ? (VALUE_LABELS[form.billingType] || 'Valor do ciclo (R$)') : 'Valor por sessão (R$)'
  const valueKey     = isRecurring ? 'monthlyValue' : 'valor'
  const valueVal     = isRecurring ? form.monthlyValue : form.valor
  const valuePlaceholder = isRecurring ? 'Ex: 800' : 'Ex: 200'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 260,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--w)', borderRadius: 'var(--r3)',
        width: '100%', maxWidth: '640px', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ background: 'var(--g700)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', color: '#fff', fontWeight: 400 }}>{initialData ? 'Editar prontuário' : 'Novo paciente'}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>{initialData ? 'Atualize os dados clínicos e de atendimento' : 'Preencha os dados clínicos e de atendimento'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', scrollbarWidth: 'thin', scrollbarColor: 'var(--gr2) transparent' }}>

          {/* Seção: Identificação */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--gr1)' }}>
              Identificação
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
              <Field label="Nome completo" required>
                <CadastroInput value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Como aparece no prontuário" error={!!errors.nome} />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Data de nascimento">
                  <DatePicker value={form.dataNasc} onChange={v => set('dataNasc', v)} />
                </Field>
                <Field label="Gênero" required>
                  <CustomSelect value={form.genero} onChange={v => set('genero', v)} options={GENEROS.map(o => ({ label: o, value: o }))} placeholder="Selecione" error={!!errors.genero} />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="E-mail">
                  <CadastroInput value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" type="email" error={!!errors.email} />
                  {errors.email && <span style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '2px' }}>{errors.email}</span>}
                </Field>
                <Field label="Telefone / WhatsApp">
                  <CadastroInput value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="(11) 99999-9999" />
                </Field>
              </div>
            </div>
          </div>

          {/* Seção: Clínico */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--gr1)' }}>
              Dados Clínicos
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="Queixa principal" required>
                <CadastroTextarea value={form.queixa} onChange={e => set('queixa', e.target.value)} placeholder="Motivo da procura, como o paciente descreve o sofrimento..." rows={2} error={!!errors.queixa} />
              </Field>
              <Field label="Histórico relevante">
                <CadastroTextarea value={form.historico} onChange={e => set('historico', e.target.value)} placeholder="Histórico familiar, internações, tratamentos anteriores, eventos significativos..." rows={2} />
              </Field>
              <Field label="Medicação em uso">
                <CadastroInput value={form.medicacao} onChange={e => set('medicacao', e.target.value)} placeholder="Ex: Sertralina 50mg — prescrição Dr. João Silva (CRM 12345)" />
              </Field>
              <Field label="Hipótese diagnóstica — CID-10/11 (opcional)">
                <CidTagInput value={form.cid} onChange={v => set('cid', v)} />
              </Field>
            </div>
          </div>

          {/* Seção: Atendimento */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--gr1)' }}>
              Atendimento
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Abordagem" required>
                <CustomSelect value={form.abordagem} onChange={v => set('abordagem', v)} options={ABORDAGENS.map(o => ({ label: o, value: o }))} placeholder="Selecione" error={!!errors.abordagem} />
              </Field>
              <Field label="Frequência">
                <CustomSelect value={form.frequencia} onChange={v => set('frequencia', v)} options={FREQUENCIAS.map(o => ({ label: o, value: o }))} placeholder="Selecione" />
              </Field>
              <Field label="Modalidade de pagamento">
                <CustomSelect value={form.pagamento} onChange={v => set('pagamento', v)} options={['Particular', 'Plano de saúde', 'Convênio empresarial', 'Gratuito'].map(o => ({ label: o, value: o }))} placeholder="Selecione" />
              </Field>
            </div>
          </div>

          {/* Seção: Recorrência e Cobrança */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '4px', paddingBottom: '8px', borderBottom: '1px solid var(--gr1)' }}>
              Recorrência e Cobrança
            </div>
            <div style={{ fontSize: '11px', color: 'var(--gr4)', marginBottom: '12px' }}>
              Horário fixo para lembretes automáticos. O valor se adapta ao modelo escolhido.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Dia da semana fixo">
                <CustomSelect value={form.recurringDayOfWeek} onChange={v => set('recurringDayOfWeek', v)} options={[{ label: 'Não definido', value: '' }, ...DIAS_SEMANA]} placeholder="Não definido" />
              </Field>
              <Field label="Horário fixo">
                <TimePicker value={form.recurringTime} onChange={v => set('recurringTime', v)} />
              </Field>
              <Field label="Duração da sessão (min)">
                <input
                  type="number"
                  value={form.recurringDurationMin}
                  onChange={e => set('recurringDurationMin', e.target.value)}
                  placeholder="50"
                  onFocus={onFocus} onBlur={onBlur}
                  style={inputStyle}
                  min="10" max="240"
                />
              </Field>
              <Field label="Modelo de cobrança">
                <CustomSelect
                  value={form.billingType}
                  onChange={v => set('billingType', v)}
                  options={[
                    { label: 'Não definido',    value: '' },
                    { label: 'Por sessão',       value: 'per_session' },
                    { label: 'Semanal',          value: 'weekly' },
                    { label: 'Quinzenal',        value: 'biweekly' },
                    { label: 'Mensal',           value: 'monthly' },
                    { label: 'Trimestral',       value: 'quarterly' },
                    { label: 'Anual',            value: 'annual' },
                  ]}
                  placeholder="Não definido"
                />
              </Field>

              {/* Dia do mês para vencimento — só aparece em recorrentes */}
              {isRecurring && (
                <Field label="Dia de vencimento" hint="Dia do mês em que a cobrança vence (1–28)">
                  <input
                    type="number"
                    value={form.billingDay}
                    onChange={e => set('billingDay', e.target.value)}
                    placeholder="Ex: 5"
                    onFocus={onFocus} onBlur={onBlur}
                    style={inputStyle}
                    min="1" max="28"
                  />
                </Field>
              )}

              {/* Campo de valor — label e binding mudam com o modelo de cobrança */}
              <Field label={valueLabel}>
                <input
                  type="number"
                  value={valueVal}
                  onChange={e => set(valueKey, e.target.value)}
                  placeholder={valuePlaceholder}
                  onFocus={onFocus} onBlur={onBlur}
                  style={inputStyle}
                  min="0"
                />
              </Field>
            </div>
          </div>

          {Object.keys(errors).length > 0 && (
            <div style={{ background: 'var(--danger-l)', border: '1px solid #E8B4B0', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '12px', color: 'var(--danger)' }}>
              Preencha os campos obrigatórios marcados com * antes de salvar o prontuário:{' '}
              {[
                errors.nome && 'Nome completo',
                errors.genero && 'Gênero',
                errors.queixa && 'Queixa principal',
                errors.abordagem && 'Abordagem',
              ].filter(Boolean).join(', ')}.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gr2)', display: 'flex', gap: '10px', flexShrink: 0, background: 'var(--w)' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: 'var(--gr5)' }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            style={{ flex: 3, padding: '11px', border: 'none', borderRadius: 'var(--r)', background: 'var(--g500)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}
            onMouseOver={e => e.currentTarget.style.background = 'var(--g600)'}
            onMouseOut={e => e.currentTarget.style.background = 'var(--g500)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
            {initialData ? 'Salvar alterações no prontuário' : 'Criar prontuário do paciente'}
          </button>
        </div>
      </div>
    </div>
  )
}
