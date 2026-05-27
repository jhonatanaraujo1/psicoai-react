import { useState, useEffect, useCallback } from 'react'
import { api } from '../services'
import { showToast } from '../components/Toast'

const ABORDAGENS = ['TCC', 'Psicanálise', 'Humanista', 'EMDR', 'ACT', 'DBT', 'Gestalt', 'Integrativa', 'Outra']
const ESPECIALIDADES = ['Psicologia Clínica', 'Neuropsicologia', 'Psicologia Hospitalar', 'Psicologia Escolar', 'Psicologia do Esporte', 'Psicologia Organizacional', 'Psicoterapia Infantil']

const st = {
  input: {
    border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '9px 12px',
    fontSize: '13px', color: 'var(--d)', fontFamily: "'DM Sans', sans-serif",
    outline: 'none', background: 'var(--ow)', width: '100%', boxSizing: 'border-box',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  selectBg: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238B8B8B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") no-repeat right 12px center`,
}
const onFocus = e => { e.target.style.borderColor = 'var(--g300)'; e.target.style.boxShadow = '0 0 0 3px rgba(74,124,89,0.08)' }
const onBlur = e => { e.target.style.borderColor = 'var(--gr2)'; e.target.style.boxShadow = 'none' }

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: '11px', color: 'var(--gr4)' }}>{hint}</span>}
    </div>
  )
}

function Divider({ title, sub }) {
  return (
    <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--gr1)', marginBottom: '20px', marginTop: '4px' }}>
      <div style={{ fontFamily: "'Fraunces', serif", fontSize: '16px', fontWeight: 400, color: 'var(--d)' }}>{title}</div>
      {sub && <div style={{ fontSize: '12px', color: 'var(--gr5)', marginTop: '2px' }}>{sub}</div>}
    </div>
  )
}

function BtnSave({ saving, saved, onClick }) {
  return (
    <button onClick={onClick} disabled={saving} style={{ padding: '10px 22px', background: saved ? 'var(--g700)' : 'var(--g600)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'inline-flex', alignItems: 'center', gap: '7px', transition: 'background 0.2s', opacity: saving ? 0.7 : 1 }}>
      {saving ? 'Salvando…' : saved ? '✓  Alterações salvas' : 'Salvar alterações'}
    </button>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function TabPerfil({ profile, onSaved }) {
  const [form, setForm] = useState({ name: '', crp: '', specialty: '', email: '', phone: '', clinicName: '', address: '', bio: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) setForm({ name: profile.name || '', crp: profile.crp || '', specialty: profile.specialty || '', email: profile.email || '', phone: profile.phone || '', clinicName: profile.clinicName || '', address: profile.address || '', bio: profile.bio || '' })
  }, [profile])

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }
  const initials = form.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'DR'

  const save = async () => {
    setSaving(true)
    try { await api.updateProfile(form); setSaved(true); onSaved && onSaved(form) }
    finally { setSaving(false) }
  }

  const sel = (k, v) => ({ ...st.input, appearance: 'none', background: `var(--ow) ${st.selectBg}`, paddingRight: '32px', borderColor: 'var(--gr2)' })

  return (
    <div>
      {/* Avatar preview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', background: 'var(--ow)', borderRadius: 'var(--r2)', border: '1px solid var(--gr2)', marginBottom: '24px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--g600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: '22px', color: '#fff', flexShrink: 0 }}>{initials}</div>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '17px', color: 'var(--d)' }}>{form.name || 'Seu nome'}</div>
          <div style={{ fontSize: '12px', color: 'var(--gr5)', marginTop: '3px' }}>{form.crp ? `CRP ${form.crp}` : '—'} · {form.specialty || '—'}</div>
        </div>
      </div>

      <Divider title="Identificação profissional" sub="Exibido nos prontuários e recibos gerados" />
      <div className="cfg-grid-2">
        <Field label="Nome completo *"><input style={st.input} value={form.name} onChange={e => set('name', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Dra. Nome Sobrenome" /></Field>
        <Field label="Número do CRP" hint="Formato: estado/número — ex: 06/89234 (SP)"><input style={st.input} value={form.crp} onChange={e => set('crp', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Ex: 06/89234" /></Field>
        <Field label="Especialidade">
          <select style={sel()} value={form.specialty} onChange={e => set('specialty', e.target.value)} onFocus={onFocus} onBlur={onBlur}>
            <option value="">Selecione</option>
            {ESPECIALIDADES.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </Field>
        <Field label="E-mail profissional"><input style={st.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="seu@email.com.br" /></Field>
        <Field label="Telefone / WhatsApp"><input style={st.input} value={form.phone} onChange={e => set('phone', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="(11) 99999-9999" /></Field>
        <Field label="Nome do consultório"><input style={st.input} value={form.clinicName} onChange={e => set('clinicName', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Consultório Dra. Nome" /></Field>
      </div>

      <Field label="Endereço do consultório">
        <input style={{ ...st.input, marginBottom: '14px' }} value={form.address} onChange={e => set('address', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Rua, número, sala — Cidade, UF" />
      </Field>

      <Field label="Biografia profissional" hint="Aparece no link de agendamento público (em breve)">
        <textarea style={{ ...st.input, resize: 'vertical', lineHeight: 1.6, minHeight: '80px' }} value={form.bio} onChange={e => set('bio', e.target.value)} onFocus={onFocus} onBlur={onBlur} placeholder="Psicóloga com foco em..." />
      </Field>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--gr2)' }}>
        <BtnSave saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function TabPlano({ profile }) {
  const isClinico = true // plano único — todos têm acesso completo
  const used = profile?.analysesUsedThisMonth || 0
  const remaining = profile?.analysesRemaining ?? 5
  const total = 5 // 5 análises incluídas/mês no plano único
  const [billingLoading, setBillingLoading] = useState(false)
  const [coupon, setCoupon] = useState('')
  const [couponState, setCouponState] = useState(null)
  const [couponChecking, setCouponChecking] = useState(false)

  const checkCoupon = async () => {
    const code = coupon.trim()
    if (!code) return
    setCouponChecking(true)
    try {
      const res = await api.validateCoupon(code, 'clinico')
      setCouponState(res)
    } catch {
      setCouponState({ valid: false, message: 'Erro ao validar cupom.' })
    } finally {
      setCouponChecking(false)
    }
  }

  const handleUpgrade = async () => {
    setBillingLoading(true)
    try {
      const successUrl = window.location.origin + '/?payment=success'
      const cancelUrl = window.location.href
      const appliedCoupon = couponState?.valid ? coupon.trim() : null
      const { url } = await api.createCheckoutSession({ planId: 'clinico', successUrl, cancelUrl, couponCode: appliedCoupon })
      window.location.href = url
    } catch (e) {
      alert('Erro ao iniciar checkout. Tente novamente.')
      setBillingLoading(false)
    }
  }

  const handlePortal = async () => {
    setBillingLoading(true)
    try {
      const returnUrl = window.location.href
      const { url } = await api.createBillingPortalSession({ returnUrl })
      window.location.href = url
    } catch (e) {
      alert('Erro ao abrir portal de cobrança. Tente novamente.')
      setBillingLoading(false)
    }
  }

  return (
    <div>
      <Divider title="Plano atual" sub="Veja seu plano, análises disponíveis e cobrança" />

      <div style={{ background: 'var(--g700)', borderRadius: 'var(--r2)', padding: '24px', marginBottom: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '140px', height: '140px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: 'var(--g300)', textTransform: 'uppercase', marginBottom: '5px' }}>Plano ativo</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: '26px', color: '#fff', fontWeight: 300, marginBottom: '3px' }}>PsicoAI — R$79/mês</div>
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginBottom: '18px' }}>Tudo incluído · 5 análises IA/mês · extras por R$4,90</div>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
          {['Prontuário ilimitado', 'Canvas de anotações', 'Agenda integrada', 'Linha do tempo', '5 análises IA/mês'].map(f => (
            <span key={f} style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)', padding: '3px 10px', borderRadius: '20px' }}>✓ {f}</span>
          ))}
        </div>
      </div>

      {isClinico && (
        <div style={{ background: 'var(--w)', border: '1px solid var(--gr2)', borderRadius: 'var(--r2)', padding: '18px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>Créditos de análise IA este mês</div>
              <div style={{ fontSize: '11.5px', color: 'var(--gr5)', marginTop: '2px' }}>Incluídas no plano · extras por R$4,90/análise</div>
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '24px', color: 'var(--g600)' }}>{remaining}<span style={{ fontSize: '13px', color: 'var(--gr4)', fontFamily: "'DM Sans', sans-serif" }}>/{total}</span></div>
          </div>
          <div style={{ height: '5px', background: 'var(--gr2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
            <div style={{ width: `${total > 0 ? Math.min((used/total)*100, 100) : 0}%`, height: '100%', background: used >= total ? 'var(--danger)' : 'var(--g500)', borderRadius: '3px', transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--gr4)' }}><span>{used} usadas</span><span>{remaining} restantes</span></div>
        </div>
      )}

      <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 'var(--r)', padding: '12px 16px', fontSize: '13px', color: 'var(--g700)', marginBottom: '16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Análises IA acionadas por você — nunca automáticas. Consulte os planos disponíveis para ver os pacotes de análise.
      </div>

      {false && (
        <div style={{ background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r2)', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '17px', color: 'var(--d)', marginBottom: '5px' }}>Precisa de mais análises?</div>
          <div style={{ fontSize: '13px', color: 'var(--gr5)', marginBottom: '14px', lineHeight: 1.6 }}>Análises extras disponíveis por R$4,90/análise, acionadas sob demanda.</div>

          {/* Coupon */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.4px', textTransform: 'uppercase', marginBottom: '6px' }}>Tem um cupom de desconto?</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={coupon}
                onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponState(null) }}
                onKeyDown={e => e.key === 'Enter' && checkCoupon()}
                placeholder="Ex: YOUTUBE30"
                style={{
                  flex: 1, border: `1px solid ${couponState ? (couponState.valid ? '#27AE60' : '#E74C3C') : 'var(--gr2)'}`,
                  borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '13px',
                  fontFamily: "'DM Sans', sans-serif", outline: 'none',
                  background: 'var(--w)', color: 'var(--d)',
                  letterSpacing: '0.5px', fontWeight: 600, maxWidth: '200px',
                }}
              />
              <button
                onClick={checkCoupon}
                disabled={!coupon.trim() || couponChecking}
                style={{
                  padding: '8px 12px', background: 'none',
                  border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
                  fontSize: '12px', fontWeight: 600, color: 'var(--gr5)',
                  cursor: (!coupon.trim() || couponChecking) ? 'not-allowed' : 'pointer',
                  opacity: (!coupon.trim() || couponChecking) ? 0.5 : 1,
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {couponChecking ? 'Verificando…' : 'Aplicar'}
              </button>
            </div>
            {couponState && (
              <div style={{ marginTop: '6px', fontSize: '12px', fontWeight: 500, color: couponState.valid ? '#27AE60' : '#E74C3C' }}>
                {couponState.valid ? '✓' : '✕'} {couponState.message}
              </div>
            )}
          </div>

          <button onClick={handleUpgrade} disabled={billingLoading} style={{ padding: '10px 20px', background: 'var(--g600)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: 600, cursor: billingLoading ? 'default' : 'pointer', opacity: billingLoading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif" }}>{billingLoading ? 'Redirecionando…' : 'Comprar análises extras'}</button>
        </div>
      )}

      <div style={{ padding: '14px 16px', background: 'var(--w)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '13px', color: 'var(--gr5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Sem fidelidade · Cancele quando quiser · Acesso até o fim do período pago</span>
        <button onClick={handlePortal} disabled={billingLoading} style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', cursor: billingLoading ? 'default' : 'pointer', opacity: billingLoading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>{billingLoading ? 'Abrindo portal…' : 'Cancelar assinatura'}</button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function TabPreferencias({ profile, onSaved }) {
  const prefs = profile?.preferences || {}
  const [form, setForm] = useState({
    defaultApproach: prefs.defaultApproach || 'TCC',
    defaultSessionDuration: prefs.defaultSessionDuration || 50,
    defaultSessionValue: prefs.defaultSessionValue || 200,
    workHourStart: prefs.workingHours?.start || 8,
    workHourEnd: prefs.workingHours?.end || 18,
    notifyOnAlert: prefs.notifyOnAlert !== false,
    notifyByEmail: prefs.notifyByEmail !== false,
    notifyByWhatsApp: !!prefs.notifyByWhatsApp,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false) }

  const save = async () => {
    setSaving(true)
    try {
      await api.updateProfile({ preferences: { defaultApproach: form.defaultApproach, defaultSessionDuration: Number(form.defaultSessionDuration), defaultSessionValue: Number(form.defaultSessionValue), workingHours: { start: Number(form.workHourStart), end: Number(form.workHourEnd) }, notifyOnAlert: form.notifyOnAlert, notifyByEmail: form.notifyByEmail, notifyByWhatsApp: form.notifyByWhatsApp } })
      setSaved(true); onSaved && onSaved()
    } finally { setSaving(false) }
  }

  const ToggleRow = ({ field, label, desc }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
      <div><div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--d)' }}>{label}</div>{desc && <div style={{ fontSize: '12px', color: 'var(--gr5)', marginTop: '2px' }}>{desc}</div>}</div>
      <label className="toggle-switch" style={{ flexShrink: 0 }}><input type="checkbox" checked={form[field]} onChange={e => set(field, e.target.checked)} /><span className="toggle-slider" /></label>
    </div>
  )

  const selectSt = { ...st.input, appearance: 'none', background: `var(--ow) ${st.selectBg}`, paddingRight: '32px' }

  return (
    <div>
      <Divider title="Atendimento" sub="Valores padrão ao criar novos pacientes e sessões" />
      <div className="cfg-grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))' }}>
        <Field label="Abordagem padrão">
          <select style={selectSt} value={form.defaultApproach} onChange={e => set('defaultApproach', e.target.value)} onFocus={onFocus} onBlur={onBlur}>
            {ABORDAGENS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Duração padrão da sessão (min)"><input style={st.input} type="number" min={20} max={120} value={form.defaultSessionDuration} onChange={e => set('defaultSessionDuration', e.target.value)} onFocus={onFocus} onBlur={onBlur} /></Field>
        <Field label="Valor padrão da sessão (R$)"><input style={st.input} type="number" min={0} value={form.defaultSessionValue} onChange={e => set('defaultSessionValue', e.target.value)} onFocus={onFocus} onBlur={onBlur} /></Field>
      </div>

      <Divider title="Agenda" sub="Horário de trabalho exibido no calendário semanal" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
        <Field label="Horário de início" hint="Formato 24h — ex: 8 para 08:00"><input style={st.input} type="number" min={5} max={12} value={form.workHourStart} onChange={e => set('workHourStart', e.target.value)} onFocus={onFocus} onBlur={onBlur} /></Field>
        <Field label="Horário de término" hint="Formato 24h — ex: 18 para 18:00"><input style={st.input} type="number" min={12} max={23} value={form.workHourEnd} onChange={e => set('workHourEnd', e.target.value)} onFocus={onFocus} onBlur={onBlur} /></Field>
      </div>

      <Divider title="Notificações" sub="Como você quer ser alertado sobre eventos clínicos" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <ToggleRow field="notifyOnAlert" label="Alertas clínicos em tempo real" desc="Notificar quando a IA detectar padrões de risco em análise" />
        <div style={{ height: '1px', background: 'var(--gr1)' }} />
        <ToggleRow field="notifyByEmail" label="Resumos por e-mail" desc="Receber resumo diário de agenda e alertas pendentes" />
        <div style={{ height: '1px', background: 'var(--gr1)' }} />
        <ToggleRow field="notifyByWhatsApp" label="Notificações por WhatsApp" desc="Alertas críticos via WhatsApp (requer integração ativa)" />
      </div>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--gr2)' }}>
        <BtnSave saving={saving} saved={saved} onClick={save} />
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function TabSeguranca() {
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [pwOk, setPwOk] = useState(false)

  const handlePw = async () => {
    if (!pw.current) { setErr('Informe a senha atual'); return }
    if (pw.next.length < 8) { setErr('A nova senha deve ter pelo menos 8 caracteres'); return }
    if (pw.next !== pw.confirm) { setErr('As senhas não coincidem'); return }
    setErr(''); setSaving(true)
    try {
      await api.changePassword(pw.current, pw.next)
      setSaving(false); setPwOk(true); setPw({ current: '', next: '', confirm: '' })
      setTimeout(() => setPwOk(false), 3000)
    } catch (e) {
      setSaving(false)
      setErr(e.message || 'Erro ao alterar senha. Tente novamente.')
    }
  }

  const sessions = [
    { device: 'Chrome · macOS', location: 'São Paulo, SP', lastSeen: 'Agora', current: true },
    { device: 'Safari · iPhone 15', location: 'São Paulo, SP', lastSeen: 'há 2 horas', current: false },
    { device: 'Chrome · Windows', location: 'Campinas, SP', lastSeen: 'há 3 dias', current: false },
  ]

  return (
    <div>
      <Divider title="Alterar senha" sub="Mínimo 8 caracteres. Use uma senha forte." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '380px' }}>
        {[['current', 'Senha atual'], ['next', 'Nova senha'], ['confirm', 'Confirmar nova senha']].map(([k, lbl]) => (
          <Field key={k} label={lbl}>
            <input type="password" style={{ ...st.input, borderColor: err ? 'var(--danger)' : 'var(--gr2)' }}
              value={pw[k]} onChange={e => { setPw(f => ({ ...f, [k]: e.target.value })); setErr('') }}
              onFocus={onFocus} onBlur={onBlur} placeholder="••••••••" />
          </Field>
        ))}
        {err && <div style={{ fontSize: '12px', color: 'var(--danger)', background: 'var(--danger-l)', padding: '8px 12px', borderRadius: 'var(--r)', border: '1px solid #E8B4B0' }}>{err}</div>}
        <button onClick={handlePw} disabled={saving} style={{ padding: '10px 22px', background: pwOk ? 'var(--g700)' : 'var(--g600)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: 600, cursor: saving ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", alignSelf: 'flex-start', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Salvando…' : pwOk ? '✓ Senha alterada' : 'Alterar senha'}
        </button>
      </div>

      <div style={{ marginTop: '28px' }}>
        <Divider title="Sessões ativas" sub="Dispositivos conectados à sua conta agora" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sessions.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: s.current ? 'var(--g50)' : 'var(--w)', border: `1px solid ${s.current ? 'var(--g100)' : 'var(--gr2)'}`, borderRadius: 'var(--r)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.current ? 'var(--g600)' : 'var(--gr4)'} strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--d)', display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {s.device}
                  {s.current && <span style={{ fontSize: '10px', background: 'var(--g600)', color: '#fff', padding: '1px 7px', borderRadius: '10px', fontWeight: 600 }}>Esta sessão</span>}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '2px' }}>{s.location} · {s.lastSeen}</div>
              </div>
              {!s.current && <button onClick={() => alert('Sessão encerrada com sucesso')} style={{ fontSize: '11px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: '4px 8px' }}>Encerrar sessão</button>}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '24px', padding: '16px 20px', background: 'var(--danger-l)', border: '1px solid #E8B4B0', borderRadius: 'var(--r)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)', marginBottom: '2px' }}>Ação irreversível</div>
          <div style={{ fontSize: '12px', color: 'var(--danger)', opacity: 0.8 }}>Excluir sua conta e todos os dados clínicos de forma permanente</div>
        </div>
        <button onClick={() => alert('Para excluir sua conta, entre em contato via suporte@psicoai.com.br. Remoção em até 30 dias (LGPD art. 18).')}
          style={{ padding: '8px 16px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', flexShrink: 0 }}>
          Excluir conta
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function TabAjuda({ onOpenOnboarding, onOpenTermos }) {
  const resetTour = () => {
    localStorage.removeItem('psicoai_onboarding_seen')
    onOpenOnboarding()
  }

  const FAQS = [
    { q: 'Como funciona a análise IA?', a: 'Ao encerrar uma sessão (Canvas ou Texto), você aciona a análise. A IA processa as anotações e gera hipóteses diagnósticas DSM-5/CID-11 com probabilidade, detecta padrões comportamentais e emite alertas graduados.' },
    { q: 'A IA substitui meu diagnóstico?', a: 'Não. O PsicoAI é um assistente de raciocínio clínico. Todo output é explicitamente marcado como "suporte clínico" e o diagnóstico final é sempre responsabilidade exclusiva do psicólogo.' },
    { q: 'Meus dados são seguros?', a: 'Sim. Seus dados são criptografados em repouso e em trânsito. Cumprimos a LGPD e a Resolução CFP 09/2024. Nenhum dado clínico é usado para treinar modelos de IA.' },
    { q: 'Como cancelar o plano?', a: 'Sem burocracia — basta acessar a aba "Plano & Cobrança" e clicar em "Cancelar assinatura". Você mantém acesso até o fim do período pago.' },
  ]

  return (
    <div>
      {/* Tour */}
      <Divider title="Guia da plataforma" sub="Reveja o tour de funcionalidades a qualquer momento" />
      <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 'var(--r2)', padding: '20px 22px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--g700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--g700)', marginBottom: '4px' }}>Tour de funcionalidades</div>
          <div style={{ fontSize: '12px', color: 'var(--g600)', lineHeight: 1.5 }}>
            Percorra as 8 telas que explicam cada módulo da plataforma — Painel clínico, Pacientes, Sessões, IA, Insights, Agenda e mais.
          </div>
        </div>
        <button onClick={resetTour}
          style={{ padding: '10px 18px', background: 'var(--g600)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", flexShrink: 0, transition: 'background 0.15s', whiteSpace: 'nowrap' }}
          onMouseOver={e => e.currentTarget.style.background = 'var(--g700)'}
          onMouseOut={e => e.currentTarget.style.background = 'var(--g600)'}>
          Iniciar tour →
        </button>
      </div>

      {/* Atalhos rápidos */}
      <Divider title="Atalhos da plataforma" sub="O que você pode fazer em cada seção" />
      <div className="cfg-grid-2" style={{ gap: '10px', marginBottom: '28px' }}>
        {[
          { icon: '◉', label: 'Painel clínico', desc: 'Agenda do dia, alertas e atalhos de sessão' },
          { icon: '◈', label: 'Pacientes', desc: 'Prontuário, histórico e linha do tempo' },
          { icon: '⬡', label: 'Sessão', desc: 'Canvas livre ou anotação em texto estruturado' },
          { icon: '◇', label: 'Insights IA', desc: 'Padrões e hipóteses da sua carteira inteira' },
          { icon: '▷', label: 'Agenda', desc: 'Calendário semanal e teleatendimento' },
          { icon: '◑', label: 'Financeiro', desc: 'Sessões, pagamentos e relatórios de receita' },
        ].map((f, i) => (
          <div key={i} style={{ background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '14px' }}>
            <div style={{ fontSize: '18px', color: 'var(--g600)', marginBottom: '6px' }}>{f.icon}</div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>{f.label}</div>
            <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.4 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <Divider title="Perguntas frequentes" sub="Respostas rápidas para as dúvidas mais comuns" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {FAQS.map((faq, i) => (
          <FaqItem key={i} q={faq.q} a={faq.a} />
        ))}
      </div>

      {/* Termos de Uso */}
      <Divider title="Documentos legais" sub="Contrato de uso, privacidade e política de dados" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
        <div style={{ background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>Termos de Uso e Contrato de Serviço</div>
            <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.5 }}>
              Condições de uso, retenção de dados, encerramento de plataforma e direitos LGPD · Versão 1.0 — vigente desde 01/06/2026
            </div>
          </div>
          <button onClick={onOpenTermos}
            style={{ padding: '8px 16px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: 'var(--gr5)', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g300)'; e.currentTarget.style.color = 'var(--g600)' }}
            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.color = 'var(--gr5)' }}>
            Ler →
          </button>
        </div>
      </div>

      {/* Suporte */}
      <div style={{ background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r2)', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>Precisa de ajuda personalizada?</div>
          <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>Nossa equipe responde em até 1 dia útil via e-mail.</div>
        </div>
        <a href="mailto:suporte@psicoai.com.br" style={{ padding: '9px 16px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: 'var(--gr5)', textDecoration: 'none', whiteSpace: 'nowrap', transition: 'all 0.15s', display: 'inline-block' }}
          onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g300)'; e.currentTarget.style.color = 'var(--g600)' }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.color = 'var(--gr5)' }}>
          suporte@psicoai.com.br →
        </a>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
function TabIntegracoes() {
  const [status, setStatus] = useState(null)   // { connected, email, calendarSync }
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api.getGoogleStatus()
      .then(setStatus)
      .catch(() => setStatus({ connected: false, email: null, calendarSync: false }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const res = await api.getGoogleAuthUrl()
      if (res._mock) {
        // Mock mode: simulate immediate connection
        await new Promise(r => setTimeout(r, 600))
        api._googleConnected = true
        setStatus({ connected: true, email: 'demo@gmail.com', calendarSync: false })
        showToast('Google conectado com sucesso!', 'success')
      } else if (res.url) {
        // Real: redirect to Google OAuth
        window.location.href = res.url
      }
    } catch (e) {
      showToast('Erro ao conectar com o Google', 'error')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o Google? Links de videoatendimento (Meet) e a sincronização com o Google Agenda serão desativados.')) return
    setDisconnecting(true)
    try {
      await api.disconnectGoogle()
      setStatus({ connected: false, email: null, calendarSync: false })
      showToast('Google desconectado', 'success')
    } catch {
      showToast('Erro ao desconectar', 'error')
    } finally {
      setDisconnecting(false)
    }
  }

  const handleToggleSync = async () => {
    if (!status?.connected) return
    const next = !status.calendarSync
    setSyncing(true)
    try {
      await api.setGoogleCalendarSync(next)
      setStatus(s => ({ ...s, calendarSync: next }))
      showToast(next ? 'Agenda Google ativada' : 'Sincronização desativada', 'success')
    } catch {
      showToast('Erro ao alterar sincronização', 'error')
    } finally {
      setSyncing(false)
    }
  }

  const googleGreen = '#34A853'

  return (
    <div>
      <Divider title="Google" sub="Conecte sua conta Google para criar salas Meet e sincronizar a agenda" />

      {/* Connection card */}
      <div style={{ border: `1px solid ${status?.connected ? '#CEEAD6' : 'var(--gr2)'}`, borderRadius: 'var(--r2)', overflow: 'hidden', marginBottom: '20px', background: status?.connected ? '#F6FEF8' : 'var(--w)' }}>
        <div style={{ padding: '20px 22px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Google logo */}
          <div style={{ width: 44, height: 44, borderRadius: '12px', border: '1px solid var(--gr2)', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--d)', marginBottom: '2px' }}>
              Google Workspace
            </div>
            {loading ? (
              <div style={{ fontSize: '12px', color: 'var(--gr4)' }}>Verificando conexão…</div>
            ) : status?.connected ? (
              <div style={{ fontSize: '12px', color: googleGreen, fontWeight: 500 }}>
                ✓ Conectado como {status.email}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>
                Não conectado · Ative para criar salas Meet e sincronizar agenda
              </div>
            )}
          </div>
          {!loading && (
            status?.connected ? (
              <button onClick={handleDisconnect} disabled={disconnecting}
                style={{ padding: '8px 16px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', color: 'var(--danger)', fontSize: '12px', fontWeight: 600, cursor: disconnecting ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: disconnecting ? 0.6 : 1 }}>
                {disconnecting ? 'Desconectando…' : 'Desconectar'}
              </button>
            ) : (
              <button onClick={handleConnect} disabled={connecting}
                style={{ padding: '9px 18px', border: 'none', borderRadius: 'var(--r)', background: '#4285F4', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: connecting ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: connecting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '7px' }}>
                {connecting ? 'Redirecionando…' : 'Conectar Google'}
              </button>
            )
          )}
        </div>
      </div>

      {/* Features */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {/* Google Meet */}
        <div style={{ padding: '16px 18px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', display: 'flex', alignItems: 'flex-start', gap: '14px', opacity: status?.connected ? 1 : 0.5 }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={googleGreen} strokeWidth="1.8">
              <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>
              Criar salas Google Meet
            </div>
            <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.5 }}>
              Ao iniciar uma sessão, gere um link Meet vinculado ao e-mail da psicóloga automaticamente. O link aparece no briefing pré-sessão.
            </div>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: status?.connected ? googleGreen : 'var(--gr4)', background: status?.connected ? '#E8F5E9' : 'var(--gr1)', padding: '3px 10px', borderRadius: '20px', flexShrink: 0 }}>
            {status?.connected ? 'Ativo' : 'Requer conexão'}
          </span>
        </div>

        {/* Google Calendar Sync */}
        <div style={{ padding: '16px 18px', border: `1px solid ${status?.calendarSync ? '#CEEAD6' : 'var(--gr2)'}`, borderRadius: 'var(--r)', background: status?.calendarSync ? '#F6FEF8' : 'var(--w)', display: 'flex', alignItems: 'flex-start', gap: '14px', opacity: status?.connected ? 1 : 0.5 }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#E8F5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={googleGreen} strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>
              Sincronizar Google Agenda
            </div>
            <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.5 }}>
              Seus eventos do Google Agenda aparecem na Agenda do PsicoAI. Supervisões, reuniões e compromissos pessoais ficam visíveis junto com as sessões.
            </div>
          </div>
          <label style={{ flexShrink: 0, cursor: status?.connected ? 'pointer' : 'not-allowed' }}>
            <div
              onClick={status?.connected && !syncing ? handleToggleSync : undefined}
              style={{
                width: 36, height: 20, borderRadius: '10px',
                background: status?.calendarSync ? googleGreen : 'var(--gr2)',
                position: 'relative', cursor: status?.connected ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s', opacity: syncing ? 0.6 : 1,
              }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: status?.calendarSync ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
          </label>
        </div>
      </div>

      {/* Info note */}
      <div style={{ padding: '12px 14px', background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.6, display: 'flex', gap: '10px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        O PsicoAI solicita apenas permissões de agenda (criar eventos e ler calendário). Nenhum dado clínico é enviado ao Google. Você pode revogar o acesso a qualquer momento.
      </div>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ border: '1px solid var(--gr2)', borderRadius: 'var(--r)', overflow: 'hidden', transition: 'border-color 0.15s', borderColor: open ? 'var(--g300)' : 'var(--gr2)' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', background: open ? 'var(--g50)' : 'var(--w)', border: 'none', cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', textAlign: 'left' }}>{q}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px', fontSize: '13px', color: 'var(--gr5)', lineHeight: 1.6, background: 'var(--w)', borderTop: '1px solid var(--gr1)' }}>
          {a}
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
// SEC-010: ícones como JSX direto — sem dangerouslySetInnerHTML
const TABS = [
  { id: 'perfil',       label: 'Perfil',           icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
  { id: 'plano',        label: 'Plano & Cobrança',  icon: <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></> },
  { id: 'preferencias', label: 'Preferências',      icon: <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></> },
  { id: 'seguranca',    label: 'Segurança',          icon: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></> },
  { id: 'integracoes',  label: 'Integrações',        icon: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></> },
  { id: 'ajuda',        label: 'Ajuda & Guia',       icon: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></> },
]

export default function Configuracoes({ currentUser, onProfileUpdate, onOpenOnboarding, onOpenTermos }) {
  const [tab, setTab] = useState('perfil')
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getUserProfile().then(p => { setProfile(p); setLoading(false) })
  }, [])

  const handleSaved = (updated) => {
    setProfile(p => ({ ...p, ...updated }))
    onProfileUpdate && onProfileUpdate(updated)
  }

  if (loading) return (
    <div className="view" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '260px' }}>
      <div style={{ fontSize: '13px', color: 'var(--gr5)' }}>Carregando configurações…</div>
    </div>
  )

  return (
    <div className="view">
      <div className="cfg-layout">
        {/* Left nav */}
        <div style={{ background: 'var(--w)', borderRadius: 'var(--r2)', border: '1px solid var(--gr2)', overflow: 'hidden', position: 'sticky', top: '80px' }}>
          {TABS.map((t, i) => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ width: '100%', background: tab === t.id ? 'var(--g50)' : 'none', border: 'none', borderLeft: `3px solid ${tab === t.id ? 'var(--g600)' : 'transparent'}`, borderBottom: i < TABS.length - 1 ? '1px solid var(--gr1)' : 'none', textAlign: 'left', padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', color: tab === t.id ? 'var(--g700)' : 'var(--gr5)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: tab === t.id ? 600 : 400, transition: 'all 0.15s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">{t.icon}</svg>
              {t.label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div style={{ background: 'var(--w)', borderRadius: 'var(--r2)', border: '1px solid var(--gr2)', padding: '28px' }}>
          {tab === 'perfil' && <TabPerfil profile={profile} onSaved={handleSaved} />}
          {tab === 'plano' && <TabPlano profile={profile} />}
          {tab === 'preferencias' && <TabPreferencias profile={profile} onSaved={handleSaved} />}
          {tab === 'seguranca' && <TabSeguranca />}
          {tab === 'integracoes' && <TabIntegracoes />}
          {tab === 'ajuda' && <TabAjuda onOpenOnboarding={onOpenOnboarding} onOpenTermos={onOpenTermos} />}
        </div>
      </div>
    </div>
  )
}
