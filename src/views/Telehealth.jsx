import { useState, useEffect, useCallback } from 'react'
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

// ── Skeleton shimmer ──────────────────────────────────────────────────────────
function Skel({ w = '100%', h = 12, r = 6 }) {
  return <div className="skel-pulse" style={{ width: w, height: h, borderRadius: r }} />
}

function TeleSessionSkeleton() {
  return (
    <div style={{ background: 'var(--w)', borderRadius: 'var(--r2)', border: '1px solid var(--gr2)', padding: '16px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <Skel w={48} h={48} r={14} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px' }}>
          <Skel w="55%" h={14} />
          <Skel w="40%" h={11} />
        </div>
      </div>
      <Skel w="100%" h={32} r={7} />
    </div>
  )
}

// ── Ícone Google Meet real ────────────────────────────────────────────────────
function GoogleMeetIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="12" width="24" height="24" rx="4" fill="#00897B"/>
      <path d="M28 20l11-7v22l-11-7V20z" fill="#00897B"/>
      <rect x="10" y="19" width="12" height="10" rx="2" fill="#fff" opacity=".9"/>
    </svg>
  )
}

export default function Telehealth({ onGoToPatient, onNewSession }) {
  const [sessions, setSessions] = useState([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [sessionCount, setSessionCount] = useState({ upcoming: 0, thisMonth: 0 })

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
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      setSessionCount({
        upcoming: data.filter(s => s.status !== 'done' && s.status !== 'cancelled').length,
        thisMonth: data.filter(s => new Date(s.scheduledAt) >= startOfMonth).length,
      })
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
      await api.updateTeleSession(session.id, { meetLink })
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, meetLink } : s))
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
      const scheduledAt = teleForm.date && teleForm.time
        ? new Date(`${teleForm.date}T${teleForm.time}:00`).toISOString()
        : new Date().toISOString()
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

  const upcoming = sessions.filter(s => s.status !== 'done' && s.status !== 'cancelled')
  const history  = sessions.filter(s => s.status === 'done').slice(0, 10)

  // ── Estilos do modal ───────────────────────────────────────────────────────
  const inputSt = {
    border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '11px 14px',
    fontSize: '16px', fontFamily: "'DM Sans', sans-serif", outline: 'none',
    background: 'var(--ow)', width: '100%', boxSizing: 'border-box', color: 'var(--d)',
  }
  const labelSt = {
    fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase',
    color: 'var(--gr4)', display: 'block', marginBottom: '6px',
  }
  const actionBtnSt = {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '10px 14px', minHeight: '44px',
    border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
    background: 'var(--ow)', fontSize: '12px', fontWeight: 600,
    color: 'var(--d)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
    transition: 'var(--t)',
  }

  return (
    <>
    <div className="view">
      <div className="tele-grid">

        {/* LEFT — session list */}
        <div>
          {/* Stats */}
          <div className="tele-stats-mini">
            <div className="tele-stat">
              <div className="tele-stat-val">{loadingSessions ? '—' : sessionCount.upcoming}</div>
              <div className="tele-stat-label">Próximas sessões</div>
            </div>
            <div className="tele-stat">
              <div className="tele-stat-val">{loadingSessions ? '—' : sessionCount.thisMonth}</div>
              <div className="tele-stat-label">Realizadas este mês</div>
            </div>
          </div>

          <button
            className="btn-primary"
            style={{ fontSize: '13px', padding: '10px 18px', marginBottom: '16px', minHeight: '44px', width: '100%' }}
            onClick={() => setTeleModal(true)}
          >
            + Agendar sessão remota
          </button>

          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '13px', color: 'var(--gr5)', marginBottom: '12px' }}>
            Próximas sessões remotas
          </div>

          {/* Loading skeleton */}
          {loadingSessions ? (
            <>
              <TeleSessionSkeleton />
              <TeleSessionSkeleton />
            </>
          ) : upcoming.length === 0 ? (
            /* Empty state com CTA */
            <div style={{
              background: 'var(--w)', border: '1px solid var(--gr2)', borderRadius: 'var(--r2)',
              padding: '40px 24px', textAlign: 'center',
            }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '14px',
                background: 'var(--g50)', border: '1px solid var(--g100)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--g500)" strokeWidth="1.5">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2"/>
                </svg>
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--d)', marginBottom: '6px' }}>
                Nenhuma sessão remota agendada
              </div>
              <div style={{ fontSize: '13px', color: 'var(--gr5)', lineHeight: 1.6, marginBottom: '20px', maxWidth: '280px', margin: '0 auto 20px' }}>
                Agende sua primeira sessão via Google Meet e o link será gerado automaticamente.
              </div>
              <button
                className="btn-primary"
                style={{ fontSize: '13px', padding: '10px 20px', minHeight: '44px' }}
                onClick={() => setTeleModal(true)}
              >
                Agendar primeira sessão
              </button>
            </div>
          ) : upcoming.map(s => {
            const { day, time } = formatScheduledAt(s.scheduledAt)
            const isLive = s.status === 'live'
            const isGenerating = generatingLink === s.id
            const initials = (s.patientName || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

            return (
              <div key={s.id} className={`tele-session-card${isLive ? ' live' : ''}`} style={{ flexDirection: 'column', gap: 0, padding: '16px' }}>

                {/* Cabeçalho: avatar + nome + badges */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div className="tele-av" style={{ flexShrink: 0, ...(isLive ? { background: 'var(--g400)' } : {}) }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--d)' }}>
                        {s.patientName || 'Paciente'}
                      </span>
                      {isLive && (
                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: 'var(--g500)', borderRadius: '20px', padding: '2px 8px', letterSpacing: '0.3px' }}>
                          ● AO VIVO
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>
                      <strong style={{ color: 'var(--d)' }}>{day}</strong> às <strong style={{ color: 'var(--d)' }}>{time}</strong>
                      <span style={{ color: 'var(--gr3)', margin: '0 5px' }}>·</span>
                      <span>Google Meet</span>
                    </div>
                  </div>
                </div>

                {/* Link da sala (quando existe) */}
                {s.meetLink && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px',
                    background: 'var(--g50)', border: '1px solid var(--g100)',
                    borderRadius: '8px', padding: '8px 12px',
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <path d="M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6A5 5 0 0 1 6 7h3"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    <span style={{ fontSize: '11px', color: 'var(--g700)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontWeight: 500 }}>
                      {s.meetLink}
                    </span>
                  </div>
                )}

                {/* Ações */}
                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                  <button onClick={() => onGoToPatient?.({ id: s.patientId, name: s.patientName })} style={actionBtnSt}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    Prontuário
                  </button>

                  <button onClick={() => onNewSession?.({ id: s.patientId, name: s.patientName })} style={actionBtnSt}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Anotar sessão
                  </button>

                  {s.meetLink ? (
                    <>
                      <button onClick={() => copyLink(s.meetLink)} style={actionBtnSt}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        Copiar link
                      </button>
                      <button
                        onClick={() => openLink(s.meetLink)}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', minHeight: '44px', fontSize: '12px', fontWeight: 700 }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
                        </svg>
                        Entrar na sessão
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-primary"
                      disabled={isGenerating || !googleStatus.connected}
                      onClick={() => handleGenerateLink(s)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', minHeight: '44px', fontSize: '12px', fontWeight: 700, opacity: (isGenerating || !googleStatus.connected) ? 0.65 : 1 }}
                      title={!googleStatus.connected ? 'Conecte o Google Meet primeiro' : ''}
                    >
                      {isGenerating ? (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                          Gerando…
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                          </svg>
                          Gerar link Meet
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Histórico */}
          {history.length > 0 && (
            <div className="card" style={{ marginTop: '20px' }}>
              <div className="card-header"><div className="card-title">Histórico</div></div>
              <div style={{ padding: 0 }}>
                {history.map((h, i) => {
                  const initials = (h.patientName || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                  const date = new Date(h.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                  return (
                    <div key={i} className="tele-hist-item">
                      <div className="tele-av" style={{ width: '36px', height: '36px', fontSize: '13px', borderRadius: '10px', background: 'var(--g50)', color: 'var(--g600)' }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 500 }}>{h.patientName || 'Paciente'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '2px' }}>{date} · Google Meet</div>
                      </div>
                      <span className="card-badge badge-green">Concluída</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — Google Meet connection + info */}
        <div>
          {/* Google Meet card */}
          <div className="tele-platform-card" style={{ padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: '#fff', border: '1px solid var(--gr2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}>
                <GoogleMeetIcon size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--d)' }}>Google Meet</div>
                <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '2px' }}>Videochamada segura</div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                fontSize: '11px', fontWeight: 600,
                color: googleStatus.connected ? 'var(--g600)' : 'var(--gr4)',
              }}>
                <div style={{
                  width: '7px', height: '7px', borderRadius: '50%',
                  background: googleStatus.connected ? 'var(--g500)' : 'var(--gr3)',
                }} />
                {googleStatus.connected ? 'Conectado' : 'Desconectado'}
              </div>
            </div>

            {googleStatus.connected ? (
              <>
                <div style={{
                  background: 'var(--g50)', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px',
                  border: '1px solid var(--g100)',
                }}>
                  <div style={{ fontSize: '11px', color: 'var(--g700)', lineHeight: 1.5 }}>
                    <strong>{googleStatus.email || 'conta vinculada'}</strong>
                    <br />Links gerados via Google Calendar API
                  </div>
                </div>
                <button
                  onClick={handleCheckConnection}
                  disabled={checkingConn}
                  style={{ ...actionBtnSt, width: '100%', justifyContent: 'center', fontSize: '13px' }}
                >
                  {checkingConn ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Verificando…
                    </>
                  ) : (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      Verificar conexão
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <div style={{
                  background: 'var(--ow)', borderRadius: '8px', border: '1px solid var(--gr2)',
                  padding: '12px', marginBottom: '12px',
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.6 }}>
                    Conecte sua conta Google para gerar links únicos do Meet para cada sessão. O link é enviado automaticamente nos lembretes.
                  </div>
                </div>
                <button
                  onClick={handleConnectGoogle}
                  disabled={connectingGoogle}
                  className="btn-primary"
                  style={{ width: '100%', minHeight: '44px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: connectingGoogle ? 0.7 : 1 }}
                >
                  {connectingGoogle ? (
                    <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                      Conectando…
                    </>
                  ) : (
                    <>
                      <GoogleMeetIcon size={16} />
                      Conectar Google Meet
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {/* Como funciona */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Como funciona</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                {
                  n: '1',
                  title: 'Agende a sessão',
                  desc: 'Selecione o paciente, data e horário. A sessão fica registrada no prontuário.',
                  color: 'var(--g500)',
                },
                {
                  n: '2',
                  title: 'Gere o link Meet',
                  desc: 'Com a conta Google conectada, crie o link com um clique. Único por sessão.',
                  color: 'var(--g500)',
                },
                {
                  n: '3',
                  title: 'Lembrete automático',
                  desc: 'O paciente recebe o link por e-mail 24h e 2h antes da sessão.',
                  color: 'var(--g500)',
                },
              ].map(step => (
                <div key={step.n} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--g50)', border: '1px solid var(--g100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: 'var(--g600)', flexShrink: 0,
                  }}>
                    {step.n}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>{step.title}</div>
                    <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.5 }}>{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Modal — agendar sessão */}
    {teleModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', touchAction: 'none', overscrollBehavior: 'none' }}>
        <div style={{ background: 'var(--w)', borderRadius: 'var(--r2)', width: '100%', maxWidth: '480px', maxHeight: 'min(90dvh,90svh,90vh)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--gr1)' }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--d)', fontFamily: "'DM Sans', sans-serif" }}>Agendar Sessão Remota</div>
              <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '2px' }}>via Google Meet</div>
            </div>
            <button onClick={() => setTeleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '44px', minHeight: '44px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
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
              <label style={labelSt}>Notas (opcional)</label>
              <textarea
                value={teleForm.notes}
                onChange={e => setTeleForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observações sobre a sessão…"
                rows={3}
                style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>

            {!googleStatus.connected && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                background: 'var(--warn-l)', border: '1px solid #F0D08A',
                borderRadius: '8px', padding: '10px 12px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div style={{ fontSize: '12px', color: 'var(--gr6)', lineHeight: 1.5 }}>
                  O link Meet será gerado após conectar a conta Google nas configurações ao lado.
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gr1)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              onClick={() => setTeleModal(false)}
              style={{ padding: '10px 18px', minHeight: '44px', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: '1px solid var(--gr2)', background: 'none', color: 'var(--d)' }}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={handleTeleSave}
              disabled={teleSaving || !teleForm.patientId || !teleForm.date || !teleForm.time}
              style={{ padding: '10px 20px', minHeight: '44px', fontSize: '13px', opacity: (teleSaving || !teleForm.patientId || !teleForm.date || !teleForm.time) ? 0.6 : 1 }}
            >
              {teleSaving ? 'Agendando…' : 'Agendar sessão'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
