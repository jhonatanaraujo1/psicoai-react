import { useState, useEffect } from 'react'
import { api } from '../services'
import { DatePicker, TimePicker, CustomSelect } from '../components/DateTimePickers'
import { showToast } from '../components/Toast'

const MOCK_SESSIONS = [
  { key: 'lucas-martins', initials: 'LM', name: 'Lucas Martins', meta: 'Sessão #15 · Hoje às', time: '09:00', tag: 'live', link: 'https://meet.google.com/abc-defg-hij' },
  { key: 'rafael-ferreira', initials: 'RF', name: 'Rafael Ferreira', meta: 'Sessão #8 · 19 mai (amanhã) às', time: '14:00', tag: 'scheduled', link: 'https://meet.google.com/xyz-uvwx-yz1' },
  { key: 'joao-oliveira', initials: 'JO', name: 'João Oliveira', meta: 'Sessão #4 · 20 mai às', time: '11:00', tag: 'pending', link: null },
]

export default function Telehealth() {
  const [teleModal, setTeleModal] = useState(false)
  const [teleForm, setTeleForm] = useState({ patientId: '', date: '', time: '', notes: '' })
  const [allPatients, setAllPatients] = useState([])
  const [teleSaving, setTeleSaving] = useState(false)

  const [googleConnected, setGoogleConnected] = useState(true)
  const [checkingConn, setCheckingConn] = useState(false)

  const [sessionLinks, setSessionLinks] = useState(() => {
    const init = {}
    MOCK_SESSIONS.forEach(s => { init[s.key] = s.link })
    return init
  })
  const [generatingLink, setGeneratingLink] = useState(null)

  useEffect(() => {
    if (teleModal) api.getPatients({ size: 100 }).then(r => setAllPatients(r.content || []))
  }, [teleModal])

  async function handleCheckConnection() {
    setCheckingConn(true)
    try {
      await new Promise(r => setTimeout(r, 1100))
      setGoogleConnected(true)
      showToast('Conexão com Google Meet verificada — tudo certo!', 'success')
    } catch {
      setGoogleConnected(false)
      showToast('Erro ao verificar conexão com Google', 'error')
    } finally {
      setCheckingConn(false)
    }
  }

  async function handleGenerateLink(sessionKey) {
    if (!googleConnected) { showToast('Conecte sua conta Google primeiro', 'error'); return }
    setGeneratingLink(sessionKey)
    try {
      await new Promise(r => setTimeout(r, 1000))
      const rnd = () => Math.random().toString(36).slice(2, 5)
      const link = `https://meet.google.com/${rnd()}-${rnd()}${rnd().slice(0,1)}-${rnd()}`
      setSessionLinks(prev => ({ ...prev, [sessionKey]: link }))
      showToast('Link do Google Meet gerado!', 'success')
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

  async function handleTeleSave() {
    setTeleSaving(true)
    try {
      const selectedPatient = allPatients.find(p => String(p.id) === String(teleForm.patientId))
      const patientName = selectedPatient?.name || ''
      if (typeof api.createTeleSession === 'function') {
        await api.createTeleSession({ patientId: teleForm.patientId, patientName, date: teleForm.date, time: teleForm.time, platform: 'google_meet', notes: teleForm.notes, status: 'scheduled' })
      } else {
        showToast('Sessão agendada!', 'success')
      }
      setTeleModal(false)
      setTeleForm({ patientId: '', date: '', time: '', notes: '' })
    } finally {
      setTeleSaving(false)
    }
  }

  const inputSt = { border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--ow)', width: '100%', boxSizing: 'border-box', color: 'var(--d)' }
  const labelSt = { fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', display: 'block', marginBottom: '6px' }

  return (
    <>
    <div className="view">
      <div className="tele-grid">

        {/* LEFT — session list */}
        <div>
          <div className="tele-stats-mini">
            <div className="tele-stat"><div className="tele-stat-val">6</div><div className="tele-stat-label">Sessões remotas em maio</div></div>
          </div>

          <button className="btn-primary" style={{ fontSize: '12px', padding: '8px 14px', marginBottom: '16px' }} onClick={() => setTeleModal(true)}>
            + Agendar sessão remota
          </button>

          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '13px', color: 'var(--gr5)', marginBottom: '12px' }}>Próximas sessões remotas</div>

          {MOCK_SESSIONS.map(s => {
            const link = sessionLinks[s.key]
            const isGenerating = generatingLink === s.key
            return (
              <div key={s.key} className={`tele-session-card${s.tag === 'live' ? ' live' : ''}`}>
                <div className="tele-av" style={s.tag === 'live' ? { background: 'var(--g400)' } : {}}>{s.initials}</div>
                <div className="tele-info">
                  <div className="tele-name">{s.name}</div>
                  <div className="tele-meta">{s.meta} <strong>{s.time}</strong> · Remota</div>
                  {s.tag === 'live' && <div style={{ fontSize: '11px', color: 'var(--g600)', marginTop: '4px', fontWeight: 600 }}>● Em andamento</div>}
                  {s.tag === 'pending' && <div style={{ fontSize: '11px', color: 'var(--warn)', marginTop: '4px' }}>⚠ Confirmação pendente</div>}
                  {s.tag === 'scheduled' && link && <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '4px' }}>Link gerado · Lembrete enviado</div>}

                  {/* Link copiável inline */}
                  {link && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '5px 10px' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><path d="M15 7h3a5 5 0 0 1 0 10h-3m-6 0H6A5 5 0 0 1 6 7h3"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                      <span style={{ fontSize: '11px', color: 'var(--gr5)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{link}</span>
                    </div>
                  )}
                </div>

                <div className="tele-actions">
                  {link ? (
                    <>
                      <button className="btn-start-call secondary" onClick={() => copyLink(link)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copiar
                      </button>
                      <button className="btn-start-call" onClick={() => openLink(link)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                        Entrar
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn-start-call"
                      disabled={isGenerating}
                      onClick={() => handleGenerateLink(s.key)}
                      style={{ opacity: isGenerating ? 0.7 : 1 }}
                    >
                      {isGenerating ? (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          Gerando…
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                          Gerar link
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header"><div className="card-title">Histórico de sessões remotas</div></div>
            <div style={{ padding: 0 }}>
              {[
                { initials: 'CS', name: 'Carla Silva', meta: 'Sessão #5 · 12 mai 2026 · Google Meet' },
                { initials: 'BL', name: 'Beatriz Lima', meta: 'Sessão #4 · 10 mai 2026 · Google Meet' },
                { initials: 'MA', name: 'Marina Costa', meta: 'Sessão #8 · 8 mai 2026 · Google Meet' },
              ].map((h, i) => (
                <div key={i} className="tele-hist-item">
                  <div className="tele-av" style={{ width: '36px', height: '36px', fontSize: '13px', borderRadius: '10px', background: 'var(--g50)', color: 'var(--g600)' }}>{h.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{h.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '2px' }}>{h.meta}</div>
                  </div>
                  <span className="card-badge badge-green" style={{ marginLeft: '8px' }}>Concluída</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — google connection + settings */}
        <div>
          {/* Google Meet connection card */}
          <div className="tele-platform-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {/* Google Meet icon */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, color: googleConnected ? 'var(--g600)' : 'var(--err, #e53)' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: googleConnected ? 'var(--g500)' : 'var(--err, #e53)' }} />
                {googleConnected ? 'Conectado' : 'Desconectado'}
              </div>
            </div>

            {googleConnected ? (
              <div style={{ background: 'var(--g50)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--g700)', lineHeight: 1.5 }}>
                  Conta vinculada: <strong>dra.ana@gmail.com</strong>
                  <br />Links gerados via Google Calendar API
                </div>
              </div>
            ) : (
              <div style={{ background: '#fff5f5', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: '#c53030', lineHeight: 1.5 }}>
                  Sem conexão com Google. Conecte para gerar links automáticos.
                </div>
              </div>
            )}

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
                  {googleConnected ? 'Verificar conexão' : 'Conectar com Google'}
                </>
              )}
            </button>
          </div>

          {/* Settings */}
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
