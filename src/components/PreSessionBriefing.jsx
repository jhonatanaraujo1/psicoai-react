import { useState, useEffect } from 'react'
import { api } from '../services'

const CHECKLIST = [
  'Ambiente silencioso e iluminado',
  'Prontuário da sessão anterior revisado',
  'Dispositivo com bateria suficiente',
  'Notificações silenciadas',
]

export default function PreSessionBriefing({ patient, onStart, onCancel, isOpen }) {
  const [meetLink, setMeetLink] = useState('')
  const [checked, setChecked] = useState(Array(CHECKLIST.length).fill(false))
  const [linkCopied, setLinkCopied] = useState(false)
  const [step, setStep] = useState(1) // 1 = briefing, 2 = tipo de anotação
  const [sessions, setSessions] = useState([])
  const [summary, setSummary] = useState(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [creatingMeet, setCreatingMeet] = useState(false)

  useEffect(() => {
    if (isOpen && patient?.id) {
      api.getPatientSessions(patient.id).then(res => setSessions(res.content || []))
      api.getPatientSummary(patient.id).then(setSummary).catch(() => {})
      api.getGoogleStatus().then(s => setGoogleConnected(s.connected)).catch(() => {})
    }
  }, [isOpen, patient?.id])

  const handleCreateMeet = async () => {
    setCreatingMeet(true)
    try {
      const res = await api.createGoogleMeet(patient.name)
      setMeetLink(res.meetLink)
    } catch (e) {
      alert('Não foi possível criar a sala Google Meet. Verifique a conexão com o Google em Configurações → Integrações e tente novamente.')
    } finally {
      setCreatingMeet(false)
    }
  }

  if (!isOpen || !patient) return null

  const sessionNum = (patient.sessions || 0) + 1

  const doneSessions = sessions.filter(s => s.status === 'finished')
  const lastSession = doneSessions[0] || null
  const lastAiSession = doneSessions.find(s => s.hasAnalysis) || null
  const sessionsSinceAi = summary?.analysesSinceLastAi ?? doneSessions.length

  const toggle = (i) => setChecked(c => c.map((v, j) => j === i ? !v : v))

  const copyLink = () => {
    if (!meetLink) return
    navigator.clipboard.writeText(meetLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 250,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--w)', borderRadius: 'var(--r3)',
        width: '100%', maxWidth: '680px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{ background: 'var(--g700)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', color: '#fff', fontWeight: 400 }}>
              Preparação para a sessão
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>
              {patient.name} · Sessão {sessionNum}
              {patient.cid && <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.12)', padding: '2px 8px', borderRadius: '20px' }}>{patient.cid}</span>}
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Body scrollável */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', scrollbarWidth: 'thin', scrollbarColor: 'var(--gr2) transparent' }}>

          {/* Alerta status */}
          {patient.status === 'danger' && (
            <div style={{ background: 'var(--danger-l)', border: '1px solid #E8B4B0', borderRadius: 'var(--r)', padding: '12px 14px', display: 'flex', gap: '10px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--danger)', marginBottom: '3px' }}>Alerta clínico ativo</div>
                <div style={{ fontSize: '12px', color: 'var(--danger)', lineHeight: 1.5, opacity: 0.85 }}>
                  Padrão de atenção identificado na última análise. Atualize a análise após esta sessão para manter o registro atualizado.
                </div>
              </div>
            </div>
          )}

          {/* Última sessão */}
          {lastSession ? (
            <div style={{ background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Última Sessão ({lastSession.num}) · {lastSession.finishedAt ? new Date(lastSession.finishedAt).toLocaleDateString('pt-BR') : '—'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--d)', lineHeight: 1.6 }}>
                {lastSession.summary}
              </div>
              {/* Nudge de análise IA */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--gr2)' }}>
                {lastAiSession ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 600, color: 'var(--d)' }}>Última análise IA:</span> {lastAiSession.num} · {lastAiSession.finishedAt ? new Date(lastAiSession.finishedAt).toLocaleDateString('pt-BR') : '—'}
                      </div>
                      {sessionsSinceAi > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--warn)', fontWeight: 500, marginTop: '2px' }}>
                          {sessionsSinceAi} {sessionsSinceAi === 1 ? 'sessão' : 'sessões'} sem análise — seus registros podem ter evoluído desde então
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      style={{
                        padding: '7px 13px', border: '1px solid var(--g300)',
                        borderRadius: 'var(--r)', background: 'var(--g50)',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        color: 'var(--g700)', fontFamily: "'DM Sans', sans-serif",
                        display: 'flex', alignItems: 'center', gap: '5px',
                        whiteSpace: 'nowrap', transition: 'all 0.15s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--g100)'; e.currentTarget.style.borderColor = 'var(--g400)' }}
                      onMouseOut={e => { e.currentTarget.style.background = 'var(--g50)'; e.currentTarget.style.borderColor = 'var(--g300)' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      Gerar novo relatório
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--d)' }}>Sem análise IA gerada</span> para este paciente ainda.
                      <br />Gere o primeiro relatório após a sessão.
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      style={{
                        padding: '7px 13px', border: '1px solid var(--g300)',
                        borderRadius: 'var(--r)', background: 'var(--g50)',
                        fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        color: 'var(--g700)', fontFamily: "'DM Sans', sans-serif",
                        display: 'flex', alignItems: 'center', gap: '5px',
                        whiteSpace: 'nowrap', transition: 'all 0.15s',
                      }}
                      onMouseOver={e => { e.currentTarget.style.background = 'var(--g100)'; e.currentTarget.style.borderColor = 'var(--g400)' }}
                      onMouseOut={e => { e.currentTarget.style.background = 'var(--g50)'; e.currentTarget.style.borderColor = 'var(--g300)' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      Gerar primeiro relatório
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Primeira sessão
              </div>
              <div style={{ fontSize: '13px', color: 'var(--gr4)', lineHeight: 1.6 }}>
                Sem histórico anterior — esta é a primeira sessão registrada para este paciente.
              </div>
            </div>
          )}

          {/* Google Meet */}
          <div style={{ border: '1px solid var(--gr2)', borderRadius: 'var(--r)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gr1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Google Meet icon */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect width="24" height="24" rx="4" fill="#00897B"/>
                  <path d="M14.5 12L19 8.5V15.5L14.5 12Z" fill="white"/>
                  <rect x="5" y="8" width="9" height="8" rx="1.5" fill="white"/>
                </svg>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>Google Meet</span>
              </div>
              {googleConnected ? (
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: '#E8F5E9', color: '#2E7D32', letterSpacing: '0.3px' }}>
                  ✓ Conectado
                </span>
              ) : (
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: 'var(--gr1)', color: 'var(--gr4)', letterSpacing: '0.3px' }}>
                  Opcional
                </span>
              )}
            </div>
            <div style={{ padding: '14px 16px' }}>
              {googleConnected && !meetLink && (
                <button
                  onClick={handleCreateMeet}
                  disabled={creatingMeet}
                  style={{ width: '100%', padding: '9px 14px', marginBottom: '10px', border: 'none', borderRadius: 'var(--r)', background: '#00897B', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: creatingMeet ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', opacity: creatingMeet ? 0.7 : 1 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                  {creatingMeet ? 'Criando sala…' : 'Criar sala Google Meet'}
                </button>
              )}
              <div style={{ fontSize: '12px', color: 'var(--gr5)', marginBottom: '10px', lineHeight: 1.5 }}>
                {googleConnected
                  ? 'Clique acima para criar uma sala vinculada à sua conta Google, ou cole um link existente.'
                  : 'Cole o link da videoconferência abaixo, ou conecte o Google em Configurações → Integrações para gerar salas automaticamente.'}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={meetLink}
                  onChange={e => setMeetLink(e.target.value)}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx"
                  style={{
                    flex: 1, border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
                    padding: '9px 12px', fontSize: '13px', color: 'var(--d)',
                    fontFamily: "'DM Sans', sans-serif", outline: 'none',
                    background: 'var(--ow)', transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--g300)'}
                  onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
                />
                <button
                  onClick={copyLink}
                  disabled={!meetLink}
                  style={{
                    padding: '9px 14px', border: '1px solid var(--gr2)',
                    borderRadius: 'var(--r)', background: 'var(--w)',
                    fontSize: '12px', fontWeight: 500, cursor: meetLink ? 'pointer' : 'not-allowed',
                    color: linkCopied ? 'var(--g600)' : 'var(--gr5)',
                    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                    opacity: meetLink ? 1 : 0.5, whiteSpace: 'nowrap',
                    display: 'flex', alignItems: 'center', gap: '5px',
                  }}
                >
                  {linkCopied ? (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copiado</>
                  ) : (
                    <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar</>
                  )}
                </button>
                {meetLink && (
                  <a
                    href={meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '9px 14px', border: '1px solid var(--g300)',
                      borderRadius: 'var(--r)', background: 'var(--g50)',
                      fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                      color: 'var(--g600)', fontFamily: "'DM Sans', sans-serif",
                      textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    Abrir
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div style={{ border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '14px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Checklist Pré-Sessão
            </div>
            {CHECKLIST.map((item, i) => (
              <label
                key={i}
                onClick={() => toggle(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px', borderRadius: '8px', cursor: 'pointer',
                  marginBottom: i < CHECKLIST.length - 1 ? '4px' : 0,
                  background: checked[i] ? 'var(--g50)' : 'transparent',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                  border: `2px solid ${checked[i] ? 'var(--g500)' : 'var(--gr2)'}`,
                  background: checked[i] ? 'var(--g500)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  {checked[i] && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                <span style={{ fontSize: '13px', color: checked[i] ? 'var(--g700)' : 'var(--d)', textDecoration: checked[i] ? 'line-through' : 'none', transition: 'all 0.15s' }}>{item}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer — step 1: botão iniciar */}
        {step === 1 && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gr2)', display: 'flex', gap: '10px', flexShrink: 0, background: 'var(--w)' }}>
            <button
              onClick={onCancel}
              style={{ flex: 1, padding: '11px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: 'var(--gr5)' }}
            >
              Cancelar
            </button>
            <button
              onClick={() => setStep(2)}
              style={{
                flex: 3, padding: '11px', border: 'none', borderRadius: 'var(--r)',
                background: 'var(--g500)', color: '#fff', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'background 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--g600)'}
              onMouseOut={e => e.currentTarget.style.background = 'var(--g500)'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Iniciar sessão agora
            </button>
          </div>
        )}

        {/* Footer — step 2: escolha do tipo de anotação */}
        {step === 2 && (
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--gr2)', flexShrink: 0, background: 'var(--w)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '14px', textAlign: 'center' }}>
              Como deseja registrar esta sessão?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              {/* Opção texto */}
              <button
                onClick={() => onStart({ meetLink, type: 'text' })}
                style={{
                  padding: '18px 14px', border: '2px solid var(--gr2)', borderRadius: 'var(--r2)',
                  background: 'var(--ow)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g400)'; e.currentTarget.style.background = 'var(--g50)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.background = 'var(--ow)' }}
              >
                <div style={{ marginBottom: '10px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="1.6">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--d)', marginBottom: '4px' }}>Anotação em texto</div>
                <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.4 }}>
                  Escreva e organize as anotações com formatação — ideal para quem digita durante a sessão
                </div>
              </button>

              {/* Opção canvas */}
              <button
                onClick={() => onStart({ meetLink, type: 'canvas' })}
                style={{
                  padding: '18px 14px', border: '2px solid var(--gr2)', borderRadius: 'var(--r2)',
                  background: 'var(--ow)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  textAlign: 'left', transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g400)'; e.currentTarget.style.background = 'var(--g50)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.background = 'var(--ow)' }}
              >
                <div style={{ marginBottom: '10px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="1.6">
                    <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                    <path d="M2 2l7.586 7.586"/>
                    <circle cx="11" cy="11" r="2"/>
                  </svg>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--d)', marginBottom: '4px' }}>Canvas livre</div>
                <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.4 }}>
                  Desenhe, rabisque e escreva à mão — otimizado para tablet e Apple Pencil
                </div>
              </button>
            </div>
            <button
              onClick={() => setStep(1)}
              style={{ width: '100%', padding: '9px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'transparent', fontSize: '12px', color: 'var(--gr5)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              Voltar ao resumo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
