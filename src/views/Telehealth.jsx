import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api } from '../services'
import { DatePicker, TimePicker, CustomSelect } from '../components/DateTimePickers'
import { showToast } from '../components/Toast'

function formatScheduledAt(iso) {
  const d = new Date(iso)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diff = Math.round((target - today) / 86400000)
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const day = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  return { day, time, isToday: diff === 0 }
}

export default function Telehealth() {
  const location = useLocation()
  const navigate = useNavigate()

  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)

  const [googleStatus, setGoogleStatus] = useState({ connected: false, email: null, calendarSync: false })
  const [checkingConn, setCheckingConn] = useState(false)
  const [connectingGoogle, setConnectingGoogle] = useState(false)

  const [generatingLink, setGeneratingLink] = useState(null)

  const [teleModal, setTeleModal] = useState(false)
  const [teleForm, setTeleForm] = useState({ patientId: '', date: '', time: '', notes: '' })
  const [allPatients, setAllPatients] = useState([])
  const [teleSaving, setTeleSaving] = useState(false)

  // ── Load sessions + google status ──────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    setLoadingSessions(true)
    try {
      const data = await api.getTeleSessions()
      setSessions(data)
    } catch {
      showToast('Erro ao carregar sessões', 'error')
    } finally {
      setLoadingSessions(false)
    }
  }, [])

  const loadGoogleStatus = useCallback(async () => {
    try {
      const status = await api.getGoogleStatus()
      setGoogleStatus(status)
    } catch {
      // não bloqueia a tela se falhar
    }
  }, [])

  useEffect(() => {
    loadSessions()
    loadGoogleStatus()
  }, [loadSessions, loadGoogleStatus])

  // ── Handle OAuth callback (?google=connected / ?google=error) ─────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const googleParam = params.get('google')
    if (googleParam === 'connected') {
      showToast('Google Meet conectado com sucesso!', 'success')
      loadGoogleStatus()
      navigate(location.pathname, { replace: true })
    } else if (googleParam === 'error') {
      showToast('Falha ao conectar com Google. Tente novamente.', 'error')
      navigate(location.pathname, { replace: true })
    }
  }, [location.search, location.pathname, navigate, loadGoogleStatus])

  useEffect(() => {
    if (teleModal) api.getPatients({ size: 100 }).then(r => setAllPatients(r.content || []))
  }, [teleModal])

  // ── Google connection ──────────────────────────────────────────────────────
  async function handleCheckConnection() {
    setCheckingConn(true)
    try {
      const status = await api.getGoogleStatus()
      setGoogleStatus(status)
      showToast(status.connected ? 'Conexão com Google Meet verificada — tudo certo!' : 'Google não conectado', status.connected ? 'success' : 'error')
    } catch {
      showToast('Erro ao verificar conexão', 'error')
    } finally {
      setCheckingConn(false)
    }
  }

  async function handleConnectGoogle() {
    setConnectingGoogle(true)
    try {
      const { url, _mock } = await api.getGoogleAuthUrl()
      if (_mock) {
        // Mock: status já foi atualizado internamente no mockApi
        const status = await api.getGoogleStatus()
        setGoogleStatus(status)
        showToast('Google Meet conectado!', 'success')
      } else if (url) {
        window.location.href = url
      }
    } catch {
      showToast('Erro ao iniciar conexão com Google', 'error')
    } finally {
      setConnectingGoogle(false)
    }
  }

  // ── Generate real Google Meet link ─────────────────────────────────────────
  async function handleGenerateLink(session) {
    if (!googleStatus.connected) {
      showToast('Conecte sua conta Google primeiro', 'error')
      return
    }
    setGeneratingLink(session.id)
    try {
      const { meetLink } = await api.createGoogleMeet(session.patientName || 'Paciente')
      // Persiste o link na sessão
      await api.updateTeleSession(session.id, { roomLink: meetLink })
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, roomLink: meetLink } : s))
      showToast('Link do Google Meet gerado!', 'success')
    } catch (e) {
      showToast(e.message || 'Erro ao gerar link', 'error')
    } finally {
      setGeneratingLink(null)
    }
  }

  function copyLink(link) {
    navigator.clipboard?.writeText(link).then(() => showToast('Link copiado!', 'success'))
  }

  function openLink(link) {
    window.open(link, '_blank', 'noopener,noreferrer')
  }

  // ── Schedule new session ───────────────────────────────────────────────────
  async function handleTeleSave() {
    setTeleSaving(true)
    try {
      const selectedPatient = allPatients.find(p => String(p.id) === String(teleForm.patientId))
      const patientName = selectedPatient?.name || ''
      const scheduledAt = teleForm.date && teleForm.time ? `${teleForm.date}T${teleForm.time}:00` : new Date().toISOString()
      await api.createTeleSession({
        patientId: teleForm.patientId,
        patientName,
        scheduledAt,
        platform: 'meet',
        notes: teleForm.notes,
        status: 'scheduled',
      })
      showToast('Sessão agendada!', 'success')
      setTeleModal(false)
      setTeleForm({ patientId: '', date: '', time: '', notes: '' })
      loadSessions()
    } catch {
      showToast('Erro ao agendar sessão', 'error')
    } finally {
      setTeleSaving(false)
    }
  }

  const upcoming = sessions.filter(s => s.status !== 'done')
  const history  = sessions.filter(s => s.status === 'done').slice(0, 10)

  const inputSt = { border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--ow)', width: '100%', boxSizing: 'border-box', color: 'var(--d)' }
  const labelSt = { fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', display: 'block', marginBottom: '6px' }

  return (
    <>
    <div className="view">
      <div className="tele-grid">

        {/* LEFT — session list */}
        <div>
          <div className="tele-stats-mini">
            <div className="tele-stat">
              <div className="tele-stat-val">{sessions.filter(s => s.status !== 'done').length}</div>
              <div className="tele-stat-label">Sessões remotas próximas</div>
            </div>
          </div>

          <button className="btn-primary" style={{ fontSize: '12px', padding: '8px 14px', marginBottom: '16px' }} onClick={() => setTeleModal(true)}>
            + Agendar sessão remota
          </button>

          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '13px', color: 'var(--gr5)', marginBottom: '12px' }}>Próximas sessões remotas</div>

          {loadingSessions ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gr4)', fontSize: '13px' }}>Carregando…</div>
          ) : upcoming.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gr4)', fontSize: '13px' }}>Nenhuma sessão agendada</div>
          ) : upcoming.map(s => {
            const { day, time } = formatScheduledAt(s.scheduledAt)
            const isLive = s.status === 'live'
            const isPending = s.confirmationStatus === 'pending' && !isLive
            const isGenerating = generatingLink === s.id
            const initials = s.patientInitials || (s.patientName || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

            return (
              <div key={s.id} className={`tele-session-card${isLive ? ' live' : ''}`} style={{ flexDirection: 'column', gap: 0, padding: '16px' }}>

                {/* ── Cabeçalho: avatar + nome + badges ── */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                  <div className="tele-av" style={{ flexShrink: 0, ...(isLive ? { background: 'var(--g400)' } : {}) }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--d)' }}>{s.patientName || 'Paciente'}</span>
                      {isLive && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: 'var(--g500)', borderRadius: '20px', padding: '2px 8px', letterSpacing: '0.3px' }}>● AO VIVO</span>
                      )}
                      {isPending && (
                        <span style={{ fontSize: '10px', fontWeight: 600, color: '#92400E', background: '#FEF3C7', borderRadius: '20px', padding: '2px 8px' }}>⚠ Confirmação pendente</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gr5)', marginTop: '3px' }}>
                      <strong style={{ color: 'var(--d)' }}>{day}</strong> às <strong style={{ color: 'var(--d)' }}>{time}</strong>
                      <span style={{ color: 'var(--gr3)', margin: '0 5px' }}>·</span>
                      <span>Google Meet</span>
                    </div>
                  </div>
                </div>

                {/* ── Status do lembrete ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  fontSize: '11px', fontWeight: 500,
                  color: s.reminderSent ? 'var(--g700)' : 'var(--gr4)',
                  background: s.reminderSent ? 'var(--g50)' : 'var(--ow)',
                  border: `1px solid ${s.reminderSent ? 'var(--g100)' : 'var(--gr2)'}`,
                  borderRadius: '7px', padding: '6px 10px', marginBottom: '10px'
                }}>
                  {s.reminderSent ? (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      Lembrete enviado{s.roomLink ? ' com link da sala' : ''}
                    </>
                  ) : (
                    <>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      Lembrete ainda não enviado
                    </>
                  )}
                </div>

                {/* ── Link da sala ── */}
                {s.roomLink && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: '7px', padding: '6px 10px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6A5 5 0 0 1 6 7h3"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <span style={{ fontSize: '11px', color: 'var(--gr5)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{s.roomLink}</span>
                  </div>
                )}

                {/* ── Ações ── */}
                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                  {/* Prontuário — sempre visível */}
                  <button
                    onClick={() => navigate(`/patient/${s.patientId}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--ow)', fontSize: '12px', fontWeight: 600, color: 'var(--d)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                    Prontuário
                  </button>

                  {/* Nova anotação — abre paciente direto em nova sessão */}
                  <button
                    onClick={() => navigate(`/patient/${s.patientId}?newSession=1`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--ow)', fontSize: '12px', fontWeight: 600, color: 'var(--d)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Anotar sessão
                  </button>

                  {/* Link / entrar na sala */}
                  {s.roomLink ? (
                    <>
                      <button
                        onClick={() => copyLink(s.roomLink)}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--ow)', fontSize: '12px', fontWeight: 600, color: 'var(--d)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copiar link
                      </button>
                      <button
                        onClick={() => openLink(s.roomLink)}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', fontSize: '12px', fontWeight: 700 }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                        Entrar na sala
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-primary"
                      disabled={isGenerating}
                      onClick={() => handleGenerateLink(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, opacity: isGenerating ? 0.7 : 1 }}
                    >
                      {isGenerating ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          Gerando link…
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          Gerar link Meet
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {history.length > 0 && (
            <div className="card" style={{ marginTop: '20px' }}>
              <div className="card-header"><div className="card-title">Histórico de sessões remotas</div></div>
              <div style={{ padding: 0 }}>
                {history.map((h, i) => {
                  const initials = h.patientInitials || (h.patientName || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                  const date = new Date(h.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                  return (
                    <div key={i} className="tele-hist-item">
                      <div className="tele-av" style={{ width: '36px', height: '36px', fontSize: '13px', borderRadius: '10px', background: 'var(--g50)', color: 'var(--g600)' }}>{initials}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{h.patientName || 'Paciente'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '2px' }}>
                          {date} · Google Meet
                        </div>
                      </div>
                      <span className="card-badge badge-green" style={{ marginLeft: '8px' }}>Concluída</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — google connection + settings */}
        <div>
          <div className="tele-platform-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fff', border: '1px solid var(--gr2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
                  <path d="M29 23.5L35.5 18V30L29 24.5" fill="#00897B"/>
                  <rect x="8" y="16" width="22" height="16" rx="3" fill="#00897B"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>Google Meet</div>
                <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '2px' }}>Plataforma de videochamada</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: googleStatus.connected ? 'var(--g600)' : 'var(--gr4)' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: googleStatus.connected ? 'var(--g500)' : 'var(--gr3)' }} />
                {googleStatus.connected ? 'Conectado' : 'Desconectado'}
              </div>
            </div>

            {googleStatus.connected ? (
              <div style={{ background: 'var(--g50)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--g700)', lineHeight: 1.5 }}>
                  Conta: <strong>{googleStatus.email || 'conta vinculada'}</strong>
                  <br />Links gerados via Google Calendar API
                </div>
              </div>
            ) : (
              <div style={{ background: 'var(--ow)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5 }}>
                  Conecte sua conta Google para gerar links reais do Google Meet para cada sessão.
                </div>
              </div>
            )}

            {googleStatus.connected ? (
              <button
                onClick={handleCheckConnection}
                disabled={checkingConn}
                style={{ width: '100%', padding: '9px 14px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--ow)', fontSize: '12px', fontWeight: 600, color: 'var(--d)', cursor: checkingConn ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: checkingConn ? 0.7 : 1, transition: 'opacity 0.15s' }}
              >
                {checkingConn ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Verificando…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Verificar conexão
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleConnectGoogle}
                disabled={connectingGoogle}
                className="btn-primary"
                style={{ width: '100%', padding: '9px 14px', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: connectingGoogle ? 0.7 : 1 }}
              >
                {connectingGoogle ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Conectando…
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" style={{ display: 'none' }}/><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    Conectar com Google
                  </>
                )}
              </button>
            )}
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Configurações</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { title: 'Enviar link automático no lembrete', desc: 'Inclui o link do Google Meet nos lembretes de sessão remota', checked: true },
                { title: 'Antessala ativada', desc: 'Paciente aguarda até você autorizar a entrada na chamada', checked: true },
              ].map((c, i) => (
                <div key={i}>
                  {i > 0 && <div style={{ height: '1px', background: 'var(--gr1)', marginBottom: '14px' }} />}
                  <div className="lembrete-config-row" style={{ padding: 0, border: 'none' }}>
                    <div className="lembrete-cfg-info">
                      <div className="lembrete-cfg-title" style={{ fontSize: '13px' }}>{c.title}</div>
                      <div className="lembrete-cfg-desc">{c.desc}</div>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" defaultChecked={c.checked} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {teleModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', touchAction: 'none', overscrollBehavior: 'none' }}>
        <div style={{ background: 'var(--w)', borderRadius: 'var(--r2)', width: '100%', maxWidth: '480px', maxHeight: 'min(90dvh,90svh,90vh)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--gr1)' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--d)', fontFamily: "'DM Sans', sans-serif" }}>Agendar Sessão Remota</div>
            <button onClick={() => setTeleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelSt}>Paciente</label>
              <CustomSelect
                value={teleForm.patientId}
                onChange={v => setTeleForm(f => ({ ...f, patientId: v }))}
                options={[{ label: 'Selecione um paciente…', value: '' }, ...allPatients.map(p => ({ label: p.name, value: p.id }))]}
                placeholder="Selecione um paciente…"
                style={inputSt}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelSt}>Data</label>
                <DatePicker value={teleForm.date} onChange={v => setTeleForm(f => ({ ...f, date: v }))} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Horário</label>
                <TimePicker value={teleForm.time} onChange={v => setTeleForm(f => ({ ...f, time: v }))} style={inputSt} />
              </div>
            </div>

            <div>
              <label style={labelSt}>Plataforma</label>
              <div style={{ ...inputSt, opacity: 0.7, cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--d)' }}>
                <span>Google Meet</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>

            <div>
              <label style={labelSt}>Notas (opcional)</label>
              <textarea
                value={teleForm.notes}
                onChange={e => setTeleForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observações sobre a sessão…"
                rows={3}
                style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gr1)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button onClick={() => setTeleModal(false)} style={{ padding: '9px 18px', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: '1px solid var(--gr2)', background: 'none', color: 'var(--d)' }}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={handleTeleSave}
              disabled={teleSaving || !teleForm.patientId || !teleForm.date || !teleForm.time}
              style={{ padding: '9px 20px', fontSize: '13px', opacity: (teleSaving || !teleForm.patientId || !teleForm.date || !teleForm.time) ? 0.6 : 1 }}
            >
              {teleSaving ? 'Agendando…' : 'Agendar'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
