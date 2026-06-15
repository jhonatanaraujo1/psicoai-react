import { useState, useEffect } from 'react'
import { auth, api } from '../services'
import RegisterFlow from '../components/RegisterFlow'
import TermsOfUse from './TermsOfUse'

export default function Login({ onLogin }) {
  // Email capturado da landing via ?email=xxx
  const [prefillEmail] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const e = params.get('email') || ''
      // Limpa o parâmetro da URL para não reaparecer ao navegar
      if (e) window.history.replaceState({}, '', window.location.pathname)
      return e
    } catch { return '' }
  })

  // 'login' | 'register' | 'termos' | 'forgot' | 'reset'
  const [mode, setMode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.has('reset')) return 'reset'
    // Se veio com email ou ?register=1 da landing, abre direto no cadastro
    if (params.get('email') || params.get('register')) return 'register'
    return 'login'
  })
  const [email, setEmail] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('email') || ''
    } catch { return '' }
  })
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)
  // Forgot password
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  // Reset password
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [resetDone, setResetDone] = useState(false)

  if (mode === 'register') return <RegisterFlow onLogin={onLogin} onBack={() => setMode('login')} initialEmail={prefillEmail} />
  if (mode === 'termos')   return <TermsOfUse onClose={() => setMode('login')} />

  // ── Esqueci minha senha ─────────────────────────────────────────────────────
  if (mode === 'forgot') {
    const handleForgot = async (e) => {
      e.preventDefault()
      if (!forgotEmail.trim()) { setError('Informe seu e-mail.'); return }
      setLoading(true); setError('')
      try {
        await auth.forgotPassword(forgotEmail.trim())
        setForgotSent(true)
      } catch (err) {
        // Mostra mensagem genérica — não revela se email existe
        setForgotSent(true)
      } finally { setLoading(false) }
    }
    return (
      <div className="login-root">
        <div className="login-left"><div className="login-left-inner">
          <div className="login-brand"><div className="login-psi-icon">Ψ</div><span className="login-brand-name">PsicNotes</span></div>
          <div className="login-hero-text"><h1>Recuperação de acesso</h1><p>Enviaremos um link seguro para redefinir sua senha diretamente no seu e-mail profissional.</p></div>
        </div></div>
        <div className="login-right"><div className="login-form-wrap">
          <div className="login-form-header">
            <h2>{forgotSent ? 'E-mail enviado!' : 'Esqueci minha senha'}</h2>
            <p>{forgotSent ? 'Verifique sua caixa de entrada (e a pasta de spam).' : 'Informe o e-mail cadastrado na plataforma.'}</p>
          </div>
          {forgotSent ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>📬</div>
              <p style={{ fontSize: '14px', color: 'var(--gr5)', lineHeight: 1.7, marginBottom: '24px' }}>
                Se <strong>{forgotEmail}</strong> estiver cadastrado, você receberá as instruções em instantes.<br/>
                O link expira em <strong>1 hora</strong>.
              </p>
              <button className="btn-outline" style={{ width: '100%', padding: '12px' }} onClick={() => setMode('login')}>Voltar para o login</button>
            </div>
          ) : (
            <form onSubmit={handleForgot} className="login-form">
              <div className="login-field">
                <label>E-mail profissional</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input type="email" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setError('') }} placeholder="dr@exemplo.com.br" autoFocus />
                </div>
              </div>
              {error && <div className="login-error"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? <><span className="login-spinner" />Enviando…</> : 'Enviar link de recuperação'}
              </button>
              <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px' }}>
                <a href="#" style={{ color: 'var(--g600)' }} onClick={e => { e.preventDefault(); setMode('login') }}>← Voltar para o login</a>
              </p>
            </form>
          )}
        </div></div>
      </div>
    )
  }

  // ── Redefinir senha (vem do link do email) ──────────────────────────────────
  if (mode === 'reset') {
    const handleReset = async (e) => {
      e.preventDefault()
      if (newPassword.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return }
      if (newPassword !== newPasswordConfirm) { setError('As senhas não coincidem.'); return }
      setLoading(true); setError('')
      try {
        await auth.resetPassword(resetToken, newPassword)
        setResetDone(true)
        window.history.replaceState({}, '', window.location.pathname)
      } catch (err) {
        setError(err.message || 'Link inválido ou expirado. Solicite um novo.')
      } finally { setLoading(false) }
    }
    return (
      <div className="login-root">
        <div className="login-left"><div className="login-left-inner">
          <div className="login-brand"><div className="login-psi-icon">Ψ</div><span className="login-brand-name">PsicNotes</span></div>
          <div className="login-hero-text"><h1>Nova senha</h1><p>Crie uma senha forte para proteger seu prontuário clínico.</p></div>
        </div></div>
        <div className="login-right"><div className="login-form-wrap">
          <div className="login-form-header">
            <h2>{resetDone ? 'Senha atualizada!' : 'Criar nova senha'}</h2>
            <p>{resetDone ? 'Faça login com sua nova senha.' : 'Mínimo 8 caracteres.'}</p>
          </div>
          {resetDone ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
              <p style={{ fontSize: '14px', color: 'var(--gr5)', lineHeight: 1.7, marginBottom: '24px' }}>
                Sua senha foi atualizada com sucesso. Faça login para continuar.
              </p>
              <button className="login-submit" onClick={() => setMode('login')}>Ir para o login</button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="login-form">
              <div className="login-field">
                <label>Nova senha</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input type={showPass ? 'text' : 'password'} value={newPassword} onChange={e => { setNewPassword(e.target.value); setError('') }} placeholder="••••••••" autoFocus />
                  <button type="button" className="login-pass-toggle" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                    {showPass ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                  </button>
                </div>
              </div>
              <div className="login-field">
                <label>Confirmar nova senha</label>
                <div className="login-input-wrap">
                  <svg className="login-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input type={showPass ? 'text' : 'password'} value={newPasswordConfirm} onChange={e => { setNewPasswordConfirm(e.target.value); setError('') }} placeholder="••••••••" />
                </div>
              </div>
              {error && <div className="login-error"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>{error}</div>}
              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? <><span className="login-spinner" />Atualizando…</> : 'Salvar nova senha'}
              </button>
            </form>
          )}
        </div></div>
      </div>
    )
  }

  const handleDemo = () => {
    setEmail('demo@psicnotes.com')
    setPassword('demo1234')
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email && !password) { setError('Informe seu e-mail e senha para continuar.'); return }
    if (!email) { setError('Informe seu e-mail profissional.'); return }
    if (!password) { setError('Informe sua senha.'); return }
    setLoading(true)
    try {
      const res = await auth.login({ email, password })
      onLogin(res.user)
    } catch (err) {
      setError(err.message || 'Erro ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-root">
      {/* Left panel */}
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
            <blockquote>
              "Finalmente consigo ver o que eu sentia intuitivamente, mas não conseguia nomear."
            </blockquote>
            <cite>Dra. Camila Rezende · CRP 06/89234 · São Paulo</cite>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="login-right">
        <div className="login-form-wrap">
          <div className="login-form-header">
            <h2>Entrar na plataforma</h2>
            <p>Acesse seu prontuário e o assistente clínico</p>
          </div>

          {/* Demo CTA — só em modo mock/dev (sem backend real) */}
          {!import.meta.env.VITE_API_BASE_URL && (
            <>
              <button type="button" className="login-demo-btn" onClick={handleDemo}>
                <span className="login-demo-icon">▶</span>
                <div>
                  <div className="login-demo-label">Experimentar sem cadastro</div>
                  <div className="login-demo-sub">Credenciais de demonstração já preenchidas</div>
                </div>
              </button>
              <div className="login-divider">
                <span>ou entre com sua conta</span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="email">E-mail profissional</label>
              <div className="login-input-wrap">
                <svg className="login-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                <input
                  id="email" type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  placeholder="dr@exemplo.com.br"
                  autoComplete="username"
                  autoFocus={!email}
                />
              </div>
            </div>

            <div className="login-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label htmlFor="password" style={{ margin: 0 }}>Senha</label>
                <a href="#" style={{ fontSize: '12px', color: 'var(--g600)', textDecoration: 'none' }}
                   onClick={e => { e.preventDefault(); setMode('forgot') }}>
                  Esqueci minha senha
                </a>
              </div>
              <div className="login-input-wrap">
                <svg className="login-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <input
                  id="password" type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button type="button" className="login-pass-toggle" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div className="login-error">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            <button type="submit" className="login-submit" disabled={loading}>
              {loading
                ? <><span className="login-spinner" />Entrando…</>
                : 'Entrar na plataforma'
              }
            </button>
          </form>

          <p className="login-register-hint">
            Ainda não tem conta?{' '}
            <a href="#" onClick={e => { e.preventDefault(); setMode('register') }}>Criar conta — 14 dias grátis →</a>
          </p>

          <div className="login-footer-note">
            PsicNotes não é um serviço médico e não substitui o julgamento clínico profissional.<br />
            Conformidade CFP 09/2024 · Dados criptografados · LGPD<br />
            <button type="button" onClick={() => setMode('termos')} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', opacity: 0.6, textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>Termos de Uso</button>
          </div>
        </div>
      </div>
    </div>
  )
}
