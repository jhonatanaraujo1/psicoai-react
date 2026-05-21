import { useState } from 'react'

const ESPECIALIDADES = [
  'Psicologia Clínica', 'Neuropsicologia', 'Psicologia Hospitalar',
  'Psicologia Escolar', 'Psicoterapia Infantil', 'Psicologia do Esporte',
  'Psicologia Organizacional', 'Outra',
]
const ABORDAGENS = ['TCC', 'Psicanálise', 'Humanista', 'EMDR', 'ACT', 'DBT', 'Gestalt', 'Integrativa', 'Outra']

// ── Password strength ────────────────────────────────────────────────────────
function PwStrength({ pw }) {
  if (!pw) return null
  const s = pw.length < 6 ? 1 : pw.length < 8 ? 2 : /[A-Z]/.test(pw) && /\d/.test(pw) ? 4 : 3
  const colors = ['', '#E74C3C', '#F39C12', '#27AE60', '#1a7a3f']
  const labels = ['', 'Muito fraca', 'Fraca', 'Boa', 'Forte']
  return (
    <div style={{ marginTop: '7px' }}>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '5px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: '3px', borderRadius: '2px', background: i <= s ? colors[s] : 'var(--gr2)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <span style={{ fontSize: '11px', color: colors[s], fontWeight: 500 }}>{labels[s]}</span>
    </div>
  )
}

// ── Step indicator ──────────────────────────────────────────────────────────
function StepBar({ step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '22px' }}>
      {[1, 2].map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i === 0 ? 'none' : 1 }}>
          {i > 0 && (
            <div style={{ flex: 1, height: '2px', background: step > 1 ? 'var(--g500)' : 'var(--gr2)', transition: 'background 0.4s', margin: '0 10px' }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
              background: step > s ? 'var(--g500)' : step === s ? 'var(--g700)' : 'var(--gr2)',
              color: step >= s ? '#fff' : 'var(--gr4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, transition: 'all 0.3s',
            }}>
              {step > s ? '✓' : s}
            </div>
            <span style={{ fontSize: '12px', fontWeight: step === s ? 600 : 400, color: step === s ? 'var(--d)' : 'var(--gr4)', transition: 'color 0.2s' }}>
              {s === 1 ? 'Identidade' : 'Consultório'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Input / Select helpers ───────────────────────────────────────────────────
const baseSt = (hasError) => ({
  border: `1px solid ${hasError ? 'var(--danger)' : 'var(--gr2)'}`,
  borderRadius: 'var(--r)', padding: '11px 14px', fontSize: '14px',
  color: 'var(--d)', fontFamily: "'DM Sans', sans-serif", outline: 'none',
  background: 'var(--w)', width: '100%', boxSizing: 'border-box',
  transition: 'border-color 0.15s, box-shadow 0.15s',
})
const onFo = e => { e.target.style.borderColor = 'var(--g400)'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.1)' }
const onBl = e => { e.target.style.borderColor = 'var(--gr2)'; e.target.style.boxShadow = 'none' }

const Label = ({ children, opt }) => (
  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.5px', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
    {children}
    {!opt && <span style={{ color: 'var(--danger)', marginLeft: '3px' }}>*</span>}
    {opt && <span style={{ fontSize: '10px', fontWeight: 400, textTransform: 'none', color: 'var(--gr3)', marginLeft: '5px' }}>(opcional)</span>}
  </label>
)
const ErrMsg = ({ msg }) => msg ? <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '5px' }}>{msg}</div> : null

// ── SelectInput ──────────────────────────────────────────────────────────────
const chevronBg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B8B8B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 13px center`

// ── Main component ───────────────────────────────────────────────────────────
export default function RegisterFlow({ onLogin, onBack }) {
  const [step, setStep] = useState(1)
  const [fading, setFading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState({})
  const [form, setForm] = useState({
    name: '', crp: '', email: '', password: '',
    specialty: '', approach: '', clinicName: '', city: '',
  })

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })) }

  const fadeAndGo = (fn) => {
    setFading(true)
    setTimeout(() => { fn(); setFading(false) }, 180)
  }

  const goBack = () => {
    if (step === 1) { onBack(); return }
    fadeAndGo(() => setStep(s => s - 1))
  }

  const goNext = async () => {
    if (step === 1) {
      const e = {}
      if (!form.name.trim()) e.name = 'Informe seu nome completo'
      if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'E-mail inválido'
      if (form.password.length < 8) e.password = 'Mínimo 8 caracteres'
      if (Object.keys(e).length) { setErrors(e); return }
      fadeAndGo(() => setStep(2))
      return
    }
    if (step === 2) {
      const e = {}
      if (!form.specialty) e.specialty = 'Selecione uma especialidade'
      if (!form.approach) e.approach = 'Selecione sua abordagem principal'
      if (Object.keys(e).length) { setErrors(e); return }
      setLoading(true)
      await new Promise(r => setTimeout(r, 1100))
      setLoading(false)
      fadeAndGo(() => setStep(3))
    }
  }

  const handleEnter = () => {
    const user = {
      id: 'usr-' + Date.now(),
      email: form.email,
      name: form.name,
      crp: form.crp || '',
      specialty: form.specialty,
      clinicName: form.clinicName || `Consultório ${firstName}`,
      plan: 'base',
      analysesRemaining: 3,
      analysesUsedThisMonth: 0,
      subscriptionStatus: 'trial',
      trialDaysRemaining: 14,
      preferences: {
        defaultApproach: form.approach,
        defaultSessionDuration: 50,
        defaultSessionValue: 200,
        workingHours: { start: 8, end: 18 },
        notifyOnAlert: true,
        notifyByEmail: true,
        notifyByWhatsApp: false,
      },
    }
    localStorage.setItem('psicoai_token', 'mock-jwt-' + Date.now())
    localStorage.setItem('psicoai_user', JSON.stringify(user))
    localStorage.removeItem('psicoai_onboarding_seen') // garante tour para novo usuário
    onLogin(user)
  }

  const firstName = (form.name.split(' ').filter(Boolean)[0] || 'você')

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(150deg, #EBF4EE 0%, #F5F5F0 60%, #D4E8DA 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '448px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', background: 'var(--g700)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: '20px', color: '#fff' }}>Ψ</div>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: '20px', color: 'var(--g900, #1E3328)', fontWeight: 400 }}>PsicoAI</span>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--w)', borderRadius: '20px',
          boxShadow: '0 8px 48px rgba(0,0,0,0.11), 0 2px 10px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          opacity: fading ? 0 : 1, transform: fading ? 'translateY(6px)' : 'translateY(0)',
          transition: 'opacity 0.18s, transform 0.18s',
        }}>

          {/* Header area (steps 1 & 2) */}
          {step < 3 && (
            <div style={{ background: 'var(--ow)', borderBottom: '1px solid var(--gr2)', padding: '24px 28px 20px' }}>
              <StepBar step={step} />
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: 'var(--d)', marginBottom: '4px' }}>
                {step === 1 ? 'Sobre você' : 'Seu consultório'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--gr5)' }}>
                {step === 1
                  ? 'Crie sua conta em segundos — sem cartão de crédito'
                  : 'Personaliza sua experiência desde o primeiro dia'}
              </div>
            </div>
          )}

          {/* ── Step 1 ─────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div>
                <Label>Nome completo</Label>
                <input autoFocus style={baseSt(errors.name)} value={form.name}
                  onChange={e => set('name', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder="Dra. Nome Sobrenome" />
                <ErrMsg msg={errors.name} />
              </div>

              <div>
                <Label opt>CRP</Label>
                <input style={baseSt(false)} value={form.crp}
                  onChange={e => set('crp', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder="Ex: 06/89234" />
              </div>

              <div>
                <Label>E-mail profissional</Label>
                <input type="email" style={baseSt(errors.email)} value={form.email}
                  onChange={e => set('email', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder="dr@exemplo.com.br" />
                <ErrMsg msg={errors.email} />
              </div>

              <div>
                <Label>Senha</Label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'}
                    style={{ ...baseSt(errors.password), paddingRight: '46px' }}
                    value={form.password}
                    onChange={e => set('password', e.target.value)} onFocus={onFo} onBlur={onBl}
                    placeholder="Mínimo 8 caracteres" />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', right: '13px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', padding: '4px', display: 'flex', alignItems: 'center' }}>
                    {showPass
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                <PwStrength pw={form.password} />
                <ErrMsg msg={errors.password} />
              </div>

              {/* Trial banner */}
              <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: '10px', padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '18px', lineHeight: 1 }}>🎁</div>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g700)', marginBottom: '2px' }}>14 dias gratuitos incluídos</div>
                  <div style={{ fontSize: '11px', color: 'var(--g600)', lineHeight: 1.5 }}>Acesso completo. Sem cartão de crédito. Cancele quando quiser.</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2 ─────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <div>
                <Label>Especialidade</Label>
                <select style={{ ...baseSt(errors.specialty), appearance: 'none', background: `var(--w) ${chevronBg}`, paddingRight: '36px' }}
                  value={form.specialty} onChange={e => set('specialty', e.target.value)} onFocus={onFo} onBlur={onBl}>
                  <option value="">Selecione sua especialidade</option>
                  {ESPECIALIDADES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <ErrMsg msg={errors.specialty} />
              </div>

              <div>
                <Label>Abordagem principal</Label>
                <select style={{ ...baseSt(errors.approach), appearance: 'none', background: `var(--w) ${chevronBg}`, paddingRight: '36px' }}
                  value={form.approach} onChange={e => set('approach', e.target.value)} onFocus={onFo} onBlur={onBl}>
                  <option value="">Selecione sua abordagem</option>
                  {ABORDAGENS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <ErrMsg msg={errors.approach} />
              </div>

              <div>
                <Label opt>Nome do consultório</Label>
                <input style={baseSt(false)} value={form.clinicName}
                  onChange={e => set('clinicName', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder={`Consultório ${firstName}`} />
              </div>

              <div>
                <Label opt>Cidade / Estado</Label>
                <input style={baseSt(false)} value={form.city}
                  onChange={e => set('city', e.target.value)} onFocus={onFo} onBlur={onBl}
                  placeholder="São Paulo, SP" />
              </div>

              {/* What's personalised */}
              <div style={{ background: 'var(--ow)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--gr2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gr5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Isso personaliza</div>
                {['Templates de sessão pré-configurados para sua abordagem', 'Sugestões da IA alinhadas à sua especialidade', 'Abordagem padrão ao criar novos pacientes'].map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: 'var(--gr5)', marginBottom: i < 2 ? '5px' : 0, lineHeight: 1.4 }}>
                    <span style={{ color: 'var(--g500)', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Done ───────────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ padding: '40px 28px 36px', textAlign: 'center' }}>
              {/* Check circle */}
              <div style={{ position: 'relative', display: 'inline-flex', marginBottom: '22px' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--g50)', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%) scale(1.7)', zIndex: 0 }} />
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'var(--g600)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1, boxShadow: '0 4px 20px rgba(61,107,74,0.3)' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>

              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '26px', fontWeight: 400, color: 'var(--d)', marginBottom: '8px' }}>
                Bem-vinda, {firstName}!
              </div>
              <div style={{ fontSize: '14px', color: 'var(--gr5)', marginBottom: '28px', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto 28px' }}>
                Sua conta está pronta. Aqui está o que espera por você:
              </div>

              {/* Feature grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '28px', textAlign: 'left' }}>
                {[
                  { icon: '◉', bg: '#EBF4EE', color: '#2D4A38', label: 'Prontuário inteligente', desc: 'Histórico, timeline e notas de sessão' },
                  { icon: '⬡', bg: '#D4E8DA', color: '#1E3328', label: 'Análise IA pós-sessão', desc: 'Hipóteses DSM-5 e CID-11 automáticas' },
                  { icon: '◈', bg: '#EBF4EE', color: '#2D4A38', label: 'Canvas de anotações', desc: 'Desenhe e escreva durante a sessão' },
                  { icon: '◇', bg: '#D4E8DA', color: '#1E3328', label: 'Insights clínicos', desc: 'Padrões da sua carteira em tempo real' },
                ].map((f, i) => (
                  <div key={i} style={{ background: f.bg, borderRadius: '12px', padding: '14px 12px' }}>
                    <div style={{ fontSize: '20px', color: f.color, marginBottom: '6px' }}>{f.icon}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: f.color, marginBottom: '3px' }}>{f.label}</div>
                    <div style={{ fontSize: '11px', color: '#4A7C59', lineHeight: 1.4 }}>{f.desc}</div>
                  </div>
                ))}
              </div>

              <button onClick={handleEnter}
                style={{ width: '100%', padding: '14px', background: 'var(--g600)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--g700)'}
                onMouseOut={e => e.currentTarget.style.background = 'var(--g600)'}>
                Entrar na plataforma
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
              <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '12px' }}>
                Um tour rápido vai apresentar as funcionalidades principais
              </div>
            </div>
          )}

          {/* Footer nav (steps 1 & 2) */}
          {step < 3 && (
            <div style={{ padding: '0 28px 24px', display: 'flex', gap: '10px' }}>
              <button onClick={goBack}
                style={{ flex: 1, padding: '12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: 'var(--gr5)' }}>
                {step === 1 ? '← Voltar' : '← Anterior'}
              </button>
              <button onClick={goNext} disabled={loading}
                style={{ flex: 2, padding: '12px', border: 'none', borderRadius: 'var(--r)', background: loading ? 'var(--g400)' : 'var(--g600)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: loading ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}
                onMouseOver={e => !loading && (e.currentTarget.style.background = 'var(--g700)')}
                onMouseOut={e => !loading && (e.currentTarget.style.background = loading ? 'var(--g400)' : 'var(--g600)')}>
                {loading
                  ? <><span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Criando conta…</>
                  : <>{step === 1 ? 'Continuar' : 'Criar minha conta'} →</>
                }
              </button>
            </div>
          )}
        </div>

        {/* Bottom note */}
        {step < 3 && (
          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.7 }}>
            Sem cartão de crédito · 14 dias grátis · LGPD compliant<br />
            <span>Já tem conta? </span>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--g600)', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', cursor: 'pointer', fontWeight: 600, padding: 0 }}>Entrar →</button>
          </div>
        )}
      </div>
    </div>
  )
}
