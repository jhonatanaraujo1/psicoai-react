import { useState, useEffect } from 'react'

const BASE = import.meta.env.VITE_API_BASE_URL

async function fetchPublicForm(token) {
  const res = await fetch(`${BASE}/public/forms/${token}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Formulário não encontrado')
  }
  return res.json()
}

async function submitForm(token, response) {
  const res = await fetch(`${BASE}/public/forms/${token}/answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || 'Erro ao enviar resposta')
  }
  return res.json()
}

function ScaleField({ field, value, onChange }) {
  const num = parseInt(value ?? '5', 10)
  return (
    <div>
      <input
        type="range" min="0" max="10"
        value={num}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', accentColor: '#2D4A38' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#888', marginTop: '2px' }}>
        <span>Mal (0)</span>
        <span style={{ fontWeight: 600, color: '#2D4A38' }}>{num}</span>
        <span>Bem (10)</span>
      </div>
    </div>
  )
}

function FormField({ field, value, onChange }) {
  const inputStyle = { width: '100%', boxSizing: 'border-box', border: '1px solid #D4D0CA', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", color: '#1C1C1C', background: '#fff', outline: 'none' }

  if (field.type === 'textarea') {
    return (
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={3}
        required={field.required}
        style={{ ...inputStyle, resize: 'vertical' }}
      />
    )
  }

  if (field.type === 'select') {
    return (
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        required={field.required}
        style={{ ...inputStyle, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px', cursor: 'pointer' }}
      >
        <option value="">Selecione…</option>
        {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (field.type === 'radio') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
        {(field.options || []).map(o => (
          <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#333', cursor: 'pointer', padding: '8px 12px', border: `1.5px solid ${value === o ? '#2D4A38' : '#E0DDD8'}`, borderRadius: '8px', background: value === o ? '#F4F7F5' : '#fff', transition: 'all 0.15s' }}>
            <input
              type="radio"
              name={field.id}
              value={o}
              checked={value === o}
              onChange={() => onChange(o)}
              required={field.required}
              style={{ accentColor: '#2D4A38', width: '16px', height: '16px', flexShrink: 0 }}
            />
            {o}
          </label>
        ))}
      </div>
    )
  }

  if (field.type === 'scale') {
    return <ScaleField field={field} value={value} onChange={onChange} />
  }

  // default: text
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      required={field.required}
      style={inputStyle}
    />
  )
}

export default function PublicFormPage() {
  const token = window.location.pathname.split('/f/')[1]?.split('/')[0]

  const [state, setState] = useState('loading') // loading | error | form | done
  const [form, setForm] = useState(null)
  const [fields, setFields] = useState([])
  const [answers, setAnswers] = useState({})
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!token) { setState('error'); setErrorMsg('Link inválido.'); return }
    fetchPublicForm(token)
      .then(data => {
        let parsedFields = []
        try { parsedFields = JSON.parse(data.fields) } catch (_) {}
        setForm(data)
        setFields(parsedFields)
        setState(data.status === 'answered' ? 'done' : 'form')
      })
      .catch(e => { setState('error'); setErrorMsg(e.message) })
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await submitForm(token, answers)
      setState('done')
    } catch (e) {
      setErrorMsg(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F0EDE8', padding: '32px 16px 64px', boxSizing: 'border-box' }}>
      <div style={{ width: '100%', maxWidth: '560px', margin: '0 auto' }}>

      {/* Brand header */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '22px', color: '#2D4A38', letterSpacing: '-0.3px' }}>Ψ PsicoNotes</div>
      </div>

      <div>

        {state === 'loading' && (
          <div style={{ background: '#fff', borderRadius: '14px', padding: '48px 32px', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid #E0DDD8', borderTopColor: '#2D4A38', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '14px', color: '#888' }}>Carregando formulário…</div>
          </div>
        )}

        {state === 'error' && (
          <div style={{ background: '#fff', borderRadius: '14px', padding: '40px 32px', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>⚠️</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#1C1C1C', marginBottom: '8px' }}>Formulário indisponível</div>
            <div style={{ fontSize: '14px', color: '#666', lineHeight: 1.5 }}>{errorMsg || 'Este link pode ter expirado ou já ter sido respondido.'}</div>
          </div>
        )}

        {state === 'done' && (
          <div style={{ background: '#fff', borderRadius: '14px', padding: '40px 32px', textAlign: 'center', boxShadow: '0 2px 16px rgba(0,0,0,0.07)' }}>
            <div style={{ width: '56px', height: '56px', background: '#F4F7F5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '26px' }}>✓</div>
            <div style={{ fontSize: '20px', fontFamily: 'Georgia, serif', color: '#1C1C1C', marginBottom: '10px', fontWeight: 400 }}>Formulário enviado!</div>
            <div style={{ fontSize: '14px', color: '#666', lineHeight: 1.6 }}>Suas respostas foram registradas com segurança e já estão disponíveis para o seu psicólogo.</div>
          </div>
        )}

        {state === 'form' && form && (
          <form onSubmit={handleSubmit}>
            {/* Form header */}
            <div style={{ background: '#2D4A38', borderRadius: '14px 14px 0 0', padding: '24px 28px' }}>
              <div style={{ fontSize: '18px', fontFamily: 'Georgia, serif', color: '#fff', fontWeight: 400, marginBottom: '4px' }}>{form.title}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>Preencha com atenção. Suas respostas são confidenciais.</div>
            </div>

            <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', padding: '24px 28px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {fields.length === 0 && (
                <div style={{ textAlign: 'center', color: '#888', padding: '16px 0', fontSize: '14px' }}>Este formulário não possui campos definidos.</div>
              )}

              {fields.map(field => (
                <div key={field.id}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#666', letterSpacing: '0.5px', marginBottom: '8px' }}>
                    {field.label.toUpperCase()}
                    {field.required && <span style={{ color: '#C0392B', marginLeft: '4px' }}>*</span>}
                  </label>
                  <FormField
                    field={field}
                    value={answers[field.id]}
                    onChange={v => setAnswers(prev => ({ ...prev, [field.id]: v }))}
                  />
                </div>
              ))}

              {errorMsg && state === 'form' && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#991B1B' }}>
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{ background: '#2D4A38', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px 24px', fontSize: '15px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1, transition: 'opacity 0.15s' }}
              >
                {submitting ? 'Enviando…' : 'Enviar respostas'}
              </button>

              <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'center' }}>
                Seus dados são protegidos conforme a LGPD (Lei 13.709/2018).
              </div>
            </div>
          </form>
        )}
      </div>

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
      </div>
    </div>
  )
}
