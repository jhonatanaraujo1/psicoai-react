import { useState, useEffect } from 'react'

const GENEROS = ['Feminino', 'Masculino', 'Não-binário', 'Prefiro não informar']
const ABORDAGENS = ['TCC', 'Psicanálise', 'Humanista', 'EMDR', 'ACT', 'DBT', 'Gestalt', 'Outra']
const FREQUENCIAS = ['Semanal', 'Quinzenal', 'Mensal', 'Sob demanda']
const CID_SUGESTOES = ['F32.1 — Depressão moderada', 'F33.1 — Depressão recorrente', 'F40.1 — Fobia social', 'F41.1 — TAG', 'F43.1 — TEPT', 'F60.3 — TPB', 'F90.0 — TDAH']

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

const emptyForm = { nome: '', dataNasc: '', genero: '', email: '', telefone: '', queixa: '', historico: '', medicacao: '', abordagem: '', frequencia: '', cid: '', pagamento: 'Particular', valor: '' }

function formFromData(d) {
  if (!d) return emptyForm
  return {
    nome: d.name || '', dataNasc: d.birthDate || '', genero: d.gender || '',
    email: d.email || '', telefone: d.phone || '', queixa: d.complaint || '',
    historico: d.history || '', medicacao: d.medication || '',
    abordagem: d.approach || '', frequencia: d.frequency || '',
    cid: d.cid || '', pagamento: d.payment || 'Particular', valor: d.sessionValue || '',
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
  const focusStyle = e => { e.target.style.borderColor = 'var(--g300)'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.08)' }
  const blurStyle = e => { e.target.style.borderColor = 'var(--gr2)'; e.target.style.boxShadow = 'none' }

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

  const Input = ({ field, placeholder, type = 'text' }) => (
    <input
      type={type}
      value={form[field]}
      onChange={e => set(field, e.target.value)}
      placeholder={placeholder}
      onFocus={focusStyle}
      onBlur={blurStyle}
      style={{ ...inputStyle, borderColor: errors[field] ? 'var(--danger)' : 'var(--gr2)' }}
    />
  )

  const Select = ({ field, options, placeholder }) => (
    <select
      value={form[field]}
      onChange={e => set(field, e.target.value)}
      onFocus={focusStyle}
      onBlur={blurStyle}
      style={{ ...inputStyle, borderColor: errors[field] ? 'var(--danger)' : 'var(--gr2)', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B8B8B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )

  const Textarea = ({ field, placeholder, rows = 3 }) => (
    <textarea
      value={form[field]}
      onChange={e => set(field, e.target.value)}
      placeholder={placeholder}
      rows={rows}
      onFocus={focusStyle}
      onBlur={blurStyle}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, borderColor: errors[field] ? 'var(--danger)' : 'var(--gr2)' }}
    />
  )

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
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', color: '#fff', fontWeight: 400 }}>{initialData ? 'Editar Paciente' : 'Cadastrar Paciente'}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>Preencha os dados clínicos e de contato</div>
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
                <Input field="nome" placeholder="Nome do paciente" />
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Data de nascimento">
                  <Input field="dataNasc" type="date" />
                </Field>
                <Field label="Gênero" required>
                  <Select field="genero" options={GENEROS} placeholder="Selecione" />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="E-mail">
                  <Input field="email" placeholder="email@exemplo.com" type="email" />
                </Field>
                <Field label="Telefone / WhatsApp">
                  <Input field="telefone" placeholder="(11) 99999-9999" />
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
                <Textarea field="queixa" placeholder="Descreva a queixa principal do paciente..." rows={2} />
              </Field>
              <Field label="Histórico relevante">
                <Textarea field="historico" placeholder="Histórico familiar, internações, tratamentos anteriores..." rows={2} />
              </Field>
              <Field label="Medicação em uso">
                <Input field="medicacao" placeholder="Ex: Sertralina 50mg — Dr. João (CRM 12345)" />
              </Field>
              <Field label="Hipótese diagnóstica (CID-11)">
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={form.cid}
                    onChange={e => set('cid', e.target.value)}
                    placeholder="Ex: F43.1 — TEPT (opcional)"
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                    style={inputStyle}
                    list="cid-list"
                  />
                  <datalist id="cid-list">
                    {CID_SUGESTOES.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--gr4)' }}>Hipótese clínica inicial — pode ser atualizada pela IA após sessões</span>
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
                <Select field="abordagem" options={ABORDAGENS} placeholder="Selecione" />
              </Field>
              <Field label="Frequência">
                <Select field="frequencia" options={FREQUENCIAS} placeholder="Selecione" />
              </Field>
              <Field label="Modalidade">
                <Select field="pagamento" options={['Particular', 'Plano de saúde', 'Convênio empresarial', 'Gratuito']} placeholder="Selecione" />
              </Field>
              <Field label="Valor por sessão (R$)">
                <Input field="valor" placeholder="Ex: 200" type="number" />
              </Field>
            </div>
          </div>

          {Object.keys(errors).length > 0 && (
            <div style={{ background: 'var(--danger-l)', border: '1px solid #E8B4B0', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: '12px', color: 'var(--danger)' }}>
              Preencha os campos obrigatórios antes de salvar.
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
            {initialData ? 'Salvar Alterações' : 'Cadastrar Paciente'}
          </button>
        </div>
      </div>
    </div>
  )
}
