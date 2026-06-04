import { useState, useEffect } from 'react'
import { DatePicker, TimePicker, CustomSelect } from './DateTimePickers'

const GENEROS = ['Feminino', 'Masculino', 'Não-binário', 'Prefiro não informar']
const ABORDAGENS = ['TCC', 'Psicanálise', 'Humanista', 'EMDR', 'ACT', 'DBT', 'Gestalt', 'Outra']
const FREQUENCIAS = ['Semanal', 'Quinzenal', 'Mensal', 'Sob demanda']
const CID_SUGESTOES = ['F32.1 — Depressão moderada', 'F33.1 — Depressão recorrente', 'F40.1 — Fobia social', 'F41.1 — TAG', 'F43.1 — TEPT', 'F60.3 — TPB', 'F90.0 — TDAH']
const DIAS_SEMANA = [
  { label: 'Segunda-feira', value: '1' },
  { label: 'Terça-feira',   value: '2' },
  { label: 'Quarta-feira',  value: '3' },
  { label: 'Quinta-feira',  value: '4' },
  { label: 'Sexta-feira',   value: '5' },
  { label: 'Sábado',        value: '6' },
  { label: 'Domingo',       value: '7' },
]

const Field = ({ label, required, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
      {label}{required && <span style={{ color: 'var(--danger)', marginLeft: '3px' }}>*</span>}
    </label>
    {children}
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

const emptyForm = {
  nome: '', dataNasc: '', genero: '', email: '', telefone: '',
  queixa: '', historico: '', medicacao: '', abordagem: '', frequencia: '',
  cid: '', pagamento: 'Particular', valor: '',
  // Recorrência
  recurringDayOfWeek: '', recurringTime: '', recurringDurationMin: '50',
  billingType: '', monthlyValue: '',
}

function formFromData(d) {
  if (!d) return emptyForm
  return {
    nome: d.name || '', dataNasc: d.birthDate || '', genero: d.gender || '',
    email: d.email || '', telefone: d.phone || '', queixa: d.complaint || '',
    historico: d.history || '', medicacao: d.medication || '',
    abordagem: d.approach || '', frequencia: d.frequency || '',
    cid: d.cid || '', pagamento: d.payment || 'Particular', valor: d.sessionValue || '',
    // Recorrência
    recurringDayOfWeek:   d.recurringDayOfWeek   ? String(d.recurringDayOfWeek)   : '',
    recurringTime:        d.recurringTime         || '',
    recurringDurationMin: d.recurringDurationMin  ? String(d.recurringDurationMin) : '50',
    billingType:          d.billingType           || '',
    monthlyValue:         d.monthlyValue          || '',
  }
}

export default function CadastroModal({ isOpen, onClose, onSave, initialData = null }) {
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
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave(form)
    onClose()
  }

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
                  <CadastroInput value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@exemplo.com" type="email" />
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
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={form.cid}
                    onChange={e => set('cid', e.target.value)}
                    placeholder="Ex: F43.1 — TEPT"
                    onFocus={onFocus}
                    onBlur={onBlur}
                    style={inputStyle}
                    list="cid-list"
                  />
                  <datalist id="cid-list">
                    {CID_SUGESTOES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--gr4)' }}>Hipótese clínica inicial — a IA refinará após análise das sessões</span>
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
              <Field label="Valor por sessão (R$)">
                <CadastroInput value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="Ex: 200" type="number" />
              </Field>
            </div>
          </div>

          {/* Seção: Recorrência */}
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '4px', paddingBottom: '8px', borderBottom: '1px solid var(--gr1)' }}>
              Recorrência e Cobrança
            </div>
            <div style={{ fontSize: '11px', color: 'var(--gr4)', marginBottom: '12px' }}>
              Defina o horário fixo do paciente. Os lembretes automáticos usam essas informações.
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
                <CustomSelect value={form.billingType} onChange={v => set('billingType', v)} options={[{ label: 'Não definido', value: '' }, { label: 'Por sessão', value: 'per_session' }, { label: 'Mensalidade fixa', value: 'monthly' }]} placeholder="Não definido" />
              </Field>
              {form.billingType === 'monthly' && (
                <Field label="Valor mensal (R$)">
                  <input
                    type="number"
                    value={form.monthlyValue}
                    onChange={e => set('monthlyValue', e.target.value)}
                    placeholder="Ex: 800"
                    onFocus={onFocus} onBlur={onBlur}
                    style={inputStyle}
                    min="0"
                  />
                </Field>
              )}
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
