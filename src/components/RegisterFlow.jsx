import { useState } from 'react'
import { auth } from '../services/index.js'
import { CustomSelect } from './DateTimePickers'

const ESPECIALIDADES = [
  'Psicologia Clínica', 'Neuropsicologia', 'Psicologia Hospitalar',
  'Psicologia Escolar', 'Psicoterapia Infantil', 'Psicologia do Esporte',
  'Psicologia Organizacional', 'Outra',
]
const ABORDAGENS = ['TCC', 'Psicanálise', 'Humanista', 'EMDR', 'ACT', 'DBT', 'Gestalt', 'Integrativa', 'Outra']

function PwStrength({ pw }) {
  if (!pw) return null
  const s = pw.length < 6 ? 1 : pw.length < 8 ? 2 : /[A-Z]/.test(pw) && /\d/.test(pw) ? 4 : 3
  const colors = ['', '#E74C3C', '#F39C12', '#27AE60', '#1a7a3f']
  const labels = ['', 'Muito fraca', 'Fraca', 'Boa', 'Forte']
  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', gap: '3px', marginBottom: '4px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= s ? colors[s] : '#E5E7EB', transition: 'background 0.3s' }} />
        ))}
      </div>
      <span style={{ fontSize: '11px', color: colors[s], fontWeight: 500 }}>{labels[s]}</span>
    </div>
  )
}

function StepBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '20px' }}>
      {[1, 2].map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === 0 ? 'none' : 1 }}>
          {i > 0 && (
            <div style={{ flex: 1, height: '2px', background: step > 1 ? 'var(--g500)' : '#E5E7EB', transition: 'background 0.4s', margin: '0 8px' }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
              background: step > s ? 'var(--g500)' : step === s ? 'var(--g700)' : '#E5E7EB',
              color: step >= s ? '#fff' : '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 700, transition: 'all 0.3s',
            }}>
              {step > s ? '✓' : s}
            </div>
            <span style={{ fontSize: '12px', fontWeight: step === s ? 600 : 400, color: step === s ? 'var(--d)' : '#9CA3AF' }}>
              {s === 1 ? 'Identidade' : 'Consultório'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

const Lbl = ({ children, opt }) => (
  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '5px' }}>
    {children}
    {opt && <span style={{ fontSize: '10px', fontWeight: 400, textTransform: 'none', color: '#9CA3AF', marginLeft: '4px' }}>(opcional)</span>}
  </label>
)

const inputSt = (err) => ({
  width: '100%', boxSizing: 'border-box',
  padding: '10px 13px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
  color: 'var(--d)', background: '#fff',
  border: `1px solid ${err ? '#EF4444' : '#E5E7EB'}`,
  borderRadius: '8px', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
})
const onFo = e => { e.target.style.borderColor = 'var(--g400)'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.1)' }
const onBl = e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none' }
const Err = ({ msg }) => msg ? <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{msg}</div> : null

const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B8B8B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 12px center`

export default function RegisterFlow({ onLogin, onBack, initialEmail = '' }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState({})
  const [registeredUser, setRegisteredUser] = useState(null)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [form, setForm] = useState({
    name: '', crp: '', email: initialEmail, password: '',
    specialty: '', approach: '', clinicName: '', city: '',
  })

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined, _global: undefined })) }
  const firstName = form.name.split(' ').filter(Boolean)[0] || 'você'

  const goNext = async () => {
    if (step === 1) {
      const e = {}
      if (!form.name.trim()) e.name = 'Informe seu nome completo'
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'E-mail inválido'
      if (form.password.length < 8) e.password = 'Mínimo 8 caracteres'
      if (!termsAccepted) e.terms = 'Você precisa aceitar os Termos de Uso para continuar'
      if (Object.keys(e).length) { setErrors(e); return }
      setStep(2)
      return
    }
    if (step === 2) {
      const e = {}
      if (!form.specialty) e.specialty = 'Selecione uma especialidade'
      if (!form.approach) e.approach = 'Selecione sua abordagem principal'
      if (Object.keys(e).length) { setErrors(e); return }
      setLoading(true)
      try {
        const result = await auth.register({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          crp: form.crp.trim() || undefined,
          lgpdConsentVersion: 'v1',
        })
        setRegisteredUser(result.user)
        setStep(3)
      } catch (err) {
        const msg = err.message || 'Erro ao criar conta. Tente novamente.'
        if (msg.toLowerCase().includes('email') || msg.toLowerCase().includes('cadastrado')) {
          setErrors({ _global: msg })
          setStep(1)
        } else {
          setErrors({ _global: msg })
        }
      } finally {
        setLoading(false)
      }
    }
  }

  const handleEnter = () => {
    localStorage.removeItem('psicoai_onboarding_seen')
    onLogin(registeredUser)
  }

  // ── Left panel (idêntico ao Login) ─────────────────────────────────────────
  const leftPanel = (
    <div className="login-left">
      <div className="login-left-inner">
        <div className="login-brand">
          <div className="login-psi-icon">Ψ</div>
          <span className="login-brand-name">PsicNotes</span>
        </div>
        <div className="login-hero-text">
          <h1>O raciocínio clínico que faltava na sua prática.</h1>
          <p>Hipóteses diagnósticas DSM-5 e CID-11 com probabilidade ponderada, alertas de padrão e linha do tempo clínica — tudo em um único lugar.</p>
        </div>
        <div className="login-features">
          {[
            { icon: '⬡', text: 'Hipóteses diagnósticas com probabilidade' },
            { icon: '◈', text: 'Alertas de padrão: evitação, ruminação, risco' },
            { icon: '◇', text: 'Timeline visual de evolução por paciente' },
            { icon: '◉', text: 'Conformidade CFP 09/2024' },
          ].map((f, i) => (
            <div key={i} className="login-feature-item">
              <span className="login-feature-icon">{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
        <div className="login-quote">
          <blockquote>"Finalmente consigo ver o que eu sentia intuitivamente, mas não conseguia nomear."</blockquote>
          <cite>Dra. Camila Rezende · CRP 06/89234 · São Paulo</cite>
        </div>
      </div>
    </div>
  )

  // ── Step 3: Sucesso ────────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div className="login-root">
        {leftPanel}
        <div className="login-right">
          <div className="login-form-wrap" style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', marginBottom: '20px', position: 'relative' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--g50)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) scale(1.8)', zIndex: 0 }} />
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--g600)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, boxShadow: '0 4px 20px rgba(61,107,74,0.3)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '24px', fontWeight: 400, color: 'var(--d)', marginBottom: '8px' }}>
              Tudo pronto, {firstName}!
            </div>
            <div style={{ fontSize: '14px', color: '#6B7280', marginBottom: '28px', lineHeight: 1.6 }}>
              Sua conta está criada. 14 dias de acesso completo incluídos.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px', textAlign: 'left' }}>
              {[
                { icon: '◉', bg: '#EBF4EE', color: '#2D4A38', label: 'Prontuário inteligente', desc: 'Histórico, timeline e notas de sessão' },
                { icon: '⬡', bg: '#D4E8DA', color: '#1E3328', label: 'Análise IA pós-sessão', desc: 'Hipóteses DSM-5 e CID-11 automáticas' },
                { icon: '◈', bg: '#EBF4EE', color: '#2D4A38', label: 'Canvas de anotações', desc: 'Desenhe e escreva durante a sessão' },
                { icon: '◇', bg: '#D4E8DA', color: '#1E3328', label: 'Insights clínicos', desc: 'Padrões da sua carteira em tempo real' },
              ].map((f, i) => (
                <div key={i} style={{ background: f.bg, borderRadius: '10px', padding: '13px 11px' }}>
                  <div style={{ fontSize: '18px', color: f.color, marginBottom: '5px' }}>{f.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: f.color, marginBottom: '2px' }}>{f.label}</div>
                  <div style={{ fontSize: '11px', color: '#4A7C59', lineHeight: 1.4 }}>{f.desc}</div>
                </div>
              ))}
            </div>
            <button onClick={handleEnter} className="login-submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Acessar meu consultório
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
            <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '12px' }}>
              Você vai conhecer cada módulo em um tour rápido
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Steps 1 e 2 ───────────────────────────────────────────────────────────
  return (
    <div className="login-root">
      {leftPanel}
      <div className="login-right">
        <div className="login-form-wrap">

          <div className="login-form-header">
            <h2>{step === 1 ? 'Criar conta gratuita' : 'Seu consultório'}</h2>
            <p>{step === 1 ? '14 dias grátis · Sem cartão de crédito' : 'Personaliza o assistente para a sua prática'}</p>
          </div>

          <StepBar step={step} />

          {errors._global && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '11px 13px', fontSize: '13px', color: '#DC2626', marginBottom: '16px' }}>
              {errors._global}
            </div>
          )}

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <Lbl>Nome completo</Lbl>
                <input autoFocus style={inputSt(errors.name)} value={form.name}
                  onChange={e => set('name', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder="Dra. Nome Sobrenome" />
                <Err msg={errors.name} />
              </div>
              <div>
                <Lbl opt>Número do CRP</Lbl>
                <input style={inputSt(false)} value={form.crp}
                  onChange={e => set('crp', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder="Ex: 06/89234" />
              </div>
              <div>
                <Lbl>E-mail profissional</Lbl>
                <input type="email" style={inputSt(errors.email)} value={form.email}
                  onChange={e => set('email', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder="dr@exemplo.com.br" autoComplete="username" />
                <Err msg={errors.email} />
              </div>
              <div>
                <Lbl>Senha de acesso</Lbl>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'}
                    style={{ ...inputSt(errors.password), paddingRight: '42px' }}
                    value={form.password}
                    onChange={e => set('password', e.target.value)} onFocus={onFo} onBlur={onBl}
                    placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPass(v => !v)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: '3px', display: 'flex', alignItems: 'center' }}>
                    {showPass
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                <PwStrength pw={form.password} />
                <Err msg={errors.password} />
              </div>

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '11px 13px', display: 'flex', gap: '10px' }}>
                <div style={{ fontSize: '16px', lineHeight: 1 }}>🎁</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g700)', marginBottom: '1px' }}>14 dias gratuitos incluídos</div>
                  <div style={{ fontSize: '11px', color: 'var(--g600)', lineHeight: 1.5 }}>Acesso completo. Sem cartão. Cancele quando quiser.</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="terms-check"
                  checked={termsAccepted}
                  onChange={e => { setTermsAccepted(e.target.checked); setErrors(er => ({ ...er, terms: undefined })) }}
                  style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, accentColor: 'var(--g600)', cursor: 'pointer' }}
                />
                <label htmlFor="terms-check" style={{ fontSize: '12px', color: '#6B7280', lineHeight: 1.5, cursor: 'pointer' }}>
                  Li e aceito os{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--g700)', fontWeight: 500, textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>
                    Termos de Uso
                  </a>
                  {' '}e a{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--g700)', fontWeight: 500, textDecoration: 'underline' }} onClick={e => e.stopPropagation()}>
                    Política de Privacidade
                  </a>
                </label>
              </div>
              {errors.terms && <Err msg={errors.terms} />}
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <Lbl>Especialidade</Lbl>
                <CustomSelect value={form.specialty} onChange={v => set('specialty', v)} options={ESPECIALIDADES.map(s => ({ label: s, value: s }))} placeholder="Selecione sua especialidade" error={!!errors.specialty} />
                <Err msg={errors.specialty} />
              </div>
              <div>
                <Lbl>Abordagem principal</Lbl>
                <CustomSelect value={form.approach} onChange={v => set('approach', v)} options={ABORDAGENS.map(a => ({ label: a, value: a }))} placeholder="Selecione sua abordagem" error={!!errors.approach} />
                <Err msg={errors.approach} />
              </div>
              <div>
                <Lbl opt>Nome do consultório</Lbl>
                <input style={inputSt(false)} value={form.clinicName}
                  onChange={e => set('clinicName', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder={`Consultório ${firstName}`} />
              </div>
              <div>
                <Lbl opt>Cidade / Estado</Lbl>
                <input style={inputSt(false)} value={form.city}
                  onChange={e => set('city', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder="São Paulo, SP" />
              </div>

              {errors._global && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '11px 13px', fontSize: '13px', color: '#DC2626' }}>
                  {errors._global}
                </div>
              )}
            </div>
          )}

          {/* ── Nav buttons ── */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={() => step === 1 ? onBack() : setStep(1)}
              style={{ flex: 1, padding: '11px', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: '#6B7280' }}>
              ← Voltar
            </button>
            <button onClick={goNext} disabled={loading}
              className="login-submit"
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading
                ? <><span className="login-spinner" />{step === 2 ? 'Criando conta…' : 'Aguarde…'}</>
                : step === 1 ? 'Continuar →' : 'Criar minha conta →'
              }
            </button>
          </div>

          <p className="login-register-hint" style={{ textAlign: 'center', marginTop: '16px' }}>
            Já tem conta?{' '}
            <a href="#" onClick={e => { e.preventDefault(); onBack() }}>Entrar →</a>
          </p>

          <div className="login-footer-note">
            Sem cartão de crédito · 14 dias grátis · LGPD compliant
          </div>
        </div>
      </div>
    </div>
  )
}
