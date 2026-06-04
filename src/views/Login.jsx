import { useState } from 'react'
import { auth } from '../services'
import RegisterFlow from '../components/RegisterFlow'
import TermosDeUso from './TermosDeUso'

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login') // 'login' | 'register' | 'termos'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  if (mode === 'register') {
    return <RegisterFlow onLogin={onLogin} onBack={() => setMode('login')} />
  }

  if (mode === 'termos') {
    return <TermosDeUso onClose={() => setMode('login')} />
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
            <span className="login-brand-name">PsicoNotes</span>
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
              <label htmlFor="password">Senha</label>
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
            PsicoNotes não é um serviço médico e não substitui o julgamento clínico profissional.<br />
            Conformidade CFP 09/2024 · Dados criptografados · LGPD<br />
            <button type="button" onClick={() => setMode('termos')} style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', opacity: 0.6, textDecoration: 'underline', cursor: 'pointer', fontSize: 'inherit', fontFamily: 'inherit' }}>Termos de Uso</button>
          </div>
        </div>
      </div>
    </div>
  )
}
