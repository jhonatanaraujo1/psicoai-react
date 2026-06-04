import { useState, useEffect } from 'react'
import { api } from '../services'
import AiAnalysisPanel from '../components/AiAnalysisPanel'

// Tradução dos padrões para linguagem acessível
const PATTERN_INFO = {
  avoidance:       { label: 'Evitação',     desc: 'Paciente desvia de temas ou situações difíceis', bg: '#2D4A38', color: '#fff' },
  rumination:      { label: 'Ruminação',    desc: 'Pensamentos repetitivos que o paciente não consegue largar', bg: '#3D6B4A', color: '#fff' },
  hypervigilance:  { label: 'Hipervigilância', desc: 'Estado de alerta constante, dificuldade de relaxar', bg: '#4A7C59', color: '#fff' },
  catastrophizing: { label: 'Catastrofização', desc: 'Tendência a imaginar sempre o pior cenário', bg: '#5C8F6A', color: '#fff' },
  isolation:       { label: 'Isolamento',   desc: 'Afastamento de pessoas e situações sociais', bg: '#8BB89A', color: '#fff' },
}

const ALERT_INFO = {
  critical: { label: 'Atenção',        color: 'var(--danger)', bg: 'var(--danger-l)', desc: 'Padrão recorrente identificado' },
  high:     { label: 'Observar',       color: '#E67E22',        bg: '#FEF3E8',        desc: 'Acompanhar de perto' },
  medium:   { label: 'Monitorar',      color: 'var(--warn)',    bg: 'var(--warn-l)',  desc: 'Observar na próxima sessão' },
  low:      { label: 'Registrado',     color: 'var(--g600)',    bg: 'var(--g50)',     desc: 'Dentro do esperado' },
}

function Skeleton({ style }) {
  return <div className="skel-pulse" style={{ borderRadius: '6px', background: 'var(--gr2)', ...style }} />
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Tooltip explicativo simples
function Tip({ text }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <svg
        width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"
        style={{ cursor: 'help', flexShrink: 0 }}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(v => !v)}
      >
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {show && (
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#1C1C1C', color: '#fff', fontSize: '11px', lineHeight: 1.5,
          padding: '7px 10px', borderRadius: '7px', maxWidth: '220px',
          whiteSpace: 'normal', zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  )
}

// ── Modal de Análise Completa ─────────────────────────────────────────────────
// "O ouro do produto" — hipóteses detalhadas com base clínica, padrões, alertas
function AnalysisDetailModal({ patient, onClose, onGoToProfile }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [analysisDate, setAnalysisDate] = useState(null)

  useEffect(() => {
    if (!patient?.id) return
    setLoading(true)
    api.getPatientAnalyses(patient.id)
      .then(async (res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : [])
        if (list.length === 0) { setLoading(false); return }
        const latest = list[0]
        setAnalysisDate(latest.createdAt)
        const full = await api.getAnalysis(latest.id)
        setAnalysis(full)
      })
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false))
  }, [patient?.id])

  // ESC fecha
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 800,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        width: '100%', maxWidth: '680px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        borderRadius: '16px', overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        background: 'linear-gradient(160deg, #0d1f15 0%, #0f1a14 60%, #111820 100%)',
        border: '1px solid rgba(74,222,128,0.15)',
        animation: 'slideUp 0.22s cubic-bezier(0.22,1,0.36,1)',
      }}>
        {/* Header do modal */}
        <div style={{
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: '12px',
          background: 'rgba(74,222,128,0.05)',
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>
                {patient?.name?.split(' ').slice(0, 2).map(w => w[0]).join('')}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{patient?.name}</div>
                {analysisDate && (
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                    Última análise: {fmtDate(analysisDate)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {onGoToProfile && (
              <button
                onClick={onGoToProfile}
                style={{
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.6)', padding: '6px 12px',
                  borderRadius: '8px', fontSize: '12px', cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                  display: 'flex', alignItems: 'center', gap: '5px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                Ver paciente
              </button>
            )}
            <button
              onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.5)', width: 32, height: 32, borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}
            >✕</button>
          </div>
        </div>

        {/* Conteúdo — AiAnalysisPanel ocupa tudo */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(74,222,128,0.2) transparent' }}>
          {loading ? (
            <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <span style={{ width: 24, height: 24, border: '2.5px solid rgba(74,222,128,0.25)', borderTopColor: '#4ade80', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>Carregando análise clínica…</span>
            </div>
          ) : !analysis ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.3)" strokeWidth="1.2" style={{ margin: '0 auto 14px', display: 'block' }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>
                Nenhuma análise disponível para este paciente.
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>
                Vá ao perfil do paciente, anote uma sessão e clique em "Analisar com IA".
              </div>
            </div>
          ) : (
            /* AiAnalysisPanel já existe e é o painel premium — renderiza direto */
            <AiAnalysisPanel
              sessionId={null}
              analysis={analysis}
              createdAt={analysisDate}
            />
          )}
        </div>

        {/* Rodapé */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(0,0,0,0.2)', flexShrink: 0,
        }}>
          <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
            Hipóteses de suporte ao raciocínio clínico · O diagnóstico é de responsabilidade exclusiva do profissional
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Insights({ onGoToPatient }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Estado do modal de análise detalhada
  const [analysisModal, setAnalysisModal] = useState(null) // { id, name } | null

  useEffect(() => {
    api.getInsights().then(setData).finally(() => setLoading(false))
  }, [])

  const handlePatientClick = (item) => {
    if (!item.analyzed) {
      // Sem análise → vai para o perfil para poder analisar
      onGoToPatient && onGoToPatient({ id: item.id, name: item.name })
      return
    }
    // Com análise → abre modal de análise detalhada
    setAnalysisModal({ id: item.id, name: item.name })
  }

  const coveragePct = data?.coveragePercent ?? 0
  const analyzedCount = data?.analyzedPatients ?? 0
  const totalCount = data?.totalPatients ?? 0
  const unanalyzedCount = totalCount - analyzedCount

  const totalAlerts = Object.values(data?.alertCount || {}).reduce((a, b) => a + b, 0)

  const analyses = data?.recentAnalyses || []
  const evCounts = analyses.reduce((acc, a) => {
    const k = a.evolution || 'neutral'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, { positive: 0, neutral: 0, negative: 0 })
  const evTotal = analyses.length || 1

  return (
    <div className="view">

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: 'var(--d)' }}>
          Resumo da Carteira
        </div>
        <div style={{ fontSize: '13px', color: 'var(--gr5)', marginTop: '4px' }}>
          Uma visão geral de como seus pacientes estão — baseada nas análises IA geradas
        </div>
      </div>

      {/* Banner orientador — só aparece sem análises */}
      {!loading && analyzedCount === 0 && (
        <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--g700)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--g700)', marginBottom: '4px' }}>
              Esta tela fica mais rica à medida que você usa a IA
            </div>
            <div style={{ fontSize: '13px', color: 'var(--g600)', lineHeight: 1.6 }}>
              Vá até um paciente, anote uma sessão e clique em <strong>"Analisar com IA"</strong>. As hipóteses diagnósticas, padrões e alertas aparecem aqui automaticamente.
            </div>
          </div>
        </div>
      )}

      {/* Lista de pacientes */}
      <div className="card" style={{ marginBottom: '0' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Seus Pacientes</div>
            <div className="card-sub">
              {loading ? '…' : (
                analyzedCount === 0
                  ? `${totalCount} ${totalCount !== 1 ? 'pacientes' : 'paciente'} · nenhuma análise IA gerada ainda`
                  : `${analyzedCount} com análise IA · ${unanalyzedCount > 0 ? `${unanalyzedCount} ainda sem análise` : 'todos analisados'}`
              )}
            </div>
          </div>
          {!loading && totalCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ height: '6px', width: '80px', background: 'var(--gr2)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${coveragePct}%`, background: 'var(--g500)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: coveragePct >= 60 ? 'var(--g600)' : 'var(--warn)' }}>{coveragePct}% analisados</span>
            </div>
          )}
        </div>

        <div style={{ padding: '0 20px 16px' }}>
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: 'var(--r)', border: '1px solid var(--gr2)', marginBottom: '8px' }}>
                  <Skeleton style={{ width: 32, height: 32, borderRadius: '50%' }} />
                  <div style={{ flex: 1 }}>
                    <Skeleton style={{ height: 13, width: '45%', marginBottom: 6 }} />
                    <Skeleton style={{ height: 11, width: '65%' }} />
                  </div>
                </div>
              ))
            : [...(data?.recentAnalyses || []).map(a => ({
                id: a.patientId,
                name: a.patientName,
                initials: a.patientName?.split(' ').slice(0, 2).map(w => w[0]).join(''),
                analyzed: true,
                lastAnalysis: fmtDate(a.createdAt),
                evolution: a.evolution,
                summary: a.summary,
              })),
              ...(data?.unanalyzedPatients || []).map(p => ({
                id: p.id,
                name: p.name,
                initials: p.initials,
                avatarBg: p.avatarBg,
                avatarColor: p.avatarColor,
                analyzed: false,
                sessionCount: p.sessionCount,
              }))
            ].map((item, i) => (
              <div
                key={`${item.id}-${i}`}
                onClick={() => handlePatientClick(item)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '10px 12px', borderRadius: 'var(--r)',
                  background: item.analyzed ? 'var(--g50)' : 'var(--ow)',
                  border: `1px solid ${item.analyzed ? 'var(--g100)' : 'var(--gr2)'}`,
                  marginBottom: '8px', cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = item.analyzed ? 'var(--g100)' : 'var(--g50)'; e.currentTarget.style.borderColor = item.analyzed ? 'var(--g300)' : 'var(--g200)' }}
                onMouseLeave={e => { e.currentTarget.style.background = item.analyzed ? 'var(--g50)' : 'var(--ow)'; e.currentTarget.style.borderColor = item.analyzed ? 'var(--g100)' : 'var(--gr2)' }}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: item.avatarBg || 'var(--g100)', color: item.avatarColor || 'var(--g600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                  {item.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.analyzed
                      ? item.summary?.slice(0, 100) || `Última análise: ${item.lastAnalysis}`
                      : `${item.sessionCount || 0} anotações · ainda sem análise IA`}
                  </div>
                </div>
                {item.analyzed ? (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: 'var(--g100)', color: 'var(--g700)', border: '1px solid var(--g300)', flexShrink: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Ver análise
                  </span>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); onGoToPatient && onGoToPatient({ id: item.id, name: item.name }) }}
                    style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: 'linear-gradient(135deg, #5C8F6A 0%, #4A7C59 100%)', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Analisar com IA →
                  </button>
                )}
              </div>
            ))
          }
        </div>
      </div>

      {/* Cards de insight — só se houver análises */}
      {!loading && analyzedCount > 0 && (
        <>
          <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 'var(--r)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: '12px', color: 'var(--g700)' }}>
              Os dados abaixo vêm dos <strong>{analyzedCount} pacientes que você já analisou com IA</strong>.
              {unanalyzedCount > 0 && ` Os outros ${unanalyzedCount} ainda não entram nesta visão.`}
            </span>
          </div>

          <div className="insights-grid">

            {/* Alertas */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Quem precisa de atenção</div>
                  <div className="card-sub">Baseado nos padrões detectados pela IA</div>
                </div>
                {totalAlerts > 0 && (
                  <span className={`card-badge ${(data?.alertCount?.critical || 0) + (data?.alertCount?.high || 0) > 0 ? 'badge-danger' : 'badge-warn'}`}>
                    {totalAlerts} {totalAlerts === 1 ? 'alerta' : 'alertas'}
                  </span>
                )}
              </div>
              <div className="card-body">
                {['critical', 'high', 'medium', 'low'].map(level => {
                  const count = data?.alertCount?.[level] || 0
                  if (count === 0) return null
                  const info = ALERT_INFO[level]
                  return (
                    <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: 'var(--r)', background: info.bg, border: `1px solid ${info.color}33`, marginBottom: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: info.color, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: info.color }}>{info.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '1px' }}>{info.desc}</div>
                      </div>
                      <span style={{ fontSize: '18px', fontFamily: "'Fraunces', serif", color: info.color, fontWeight: 400 }}>{count}</span>
                    </div>
                  )
                })}
                {totalAlerts === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <div style={{ fontSize: '24px', marginBottom: '6px' }}>✓</div>
                    <div style={{ fontSize: '13px', color: 'var(--g600)', fontWeight: 500 }}>Nenhum alerta ativo</div>
                    <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '3px' }}>Seus pacientes analisados estão dentro do esperado</div>
                  </div>
                )}
              </div>
            </div>

            {/* Padrões */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Padrões mais frequentes
                    <Tip text="Comportamentos que a IA detectou repetidamente nas sessões analisadas. Útil para perceber o que aparece mais na sua carteira." />
                  </div>
                  <div className="card-sub">O que aparece mais nos seus pacientes</div>
                </div>
              </div>
              <div className="card-body">
                {(data?.patternSummary || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '12px', color: 'var(--gr4)' }}>Nenhum padrão detectado ainda</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(data?.patternSummary || []).map((p, i) => {
                      const info = PATTERN_INFO[p.type] || { label: p.type, desc: '', bg: 'var(--gr2)', color: 'var(--d)' }
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--ow)', border: '1px solid var(--gr2)' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: info.bg, color: info.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: '14px', fontWeight: 400, flexShrink: 0 }}>
                            {p.count}
                          </div>
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--d)' }}>{info.label}</div>
                            <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '2px', lineHeight: 1.4 }}>{info.desc}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Temas frequentes */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Temas frequentes nos seus registros
                    <Tip text="Temas que a IA identificou repetidamente nas suas anotações. Baseado no que você mesmo registrou em sessão." />
                  </div>
                  <div className="card-sub">O que aparece mais nas suas anotações</div>
                </div>
              </div>
              <div className="card-body">
                {(data?.topHypotheses || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '12px', color: 'var(--gr4)' }}>Nenhum tema registrado ainda</div>
                ) : (
                  <>
                    {(data?.topHypotheses || []).map(({ code, label, occurrences }) => (
                      <div key={code || label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--ow)', border: '1px solid var(--gr2)', marginBottom: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--g50)', color: 'var(--g600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: '13px', fontWeight: 600, flexShrink: 0 }}>
                          {occurrences}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', color: 'var(--d)', fontWeight: 600 }}>{label}</div>
                          <div style={{ fontSize: '10px', color: 'var(--gr4)', marginTop: '1px' }}>
                            {occurrences} análise{occurrences !== 1 ? 's' : ''} com este tema
                          </div>
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: '10px 12px', background: 'var(--g50)', borderRadius: '8px', fontSize: '11px', color: 'var(--g600)', lineHeight: 1.5 }}>
                      Baseado nas suas anotações — a interpretação clínica é sempre sua.
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Evolução */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Distribuição de evolução</div>
                  <div className="card-sub">{analyses.length} análise{analyses.length !== 1 ? 's' : ''} · classificadas pela IA</div>
                </div>
              </div>
              <div className="card-body">
                {[
                  { key: 'positive', label: 'Evolução positiva', color: 'var(--g500)', desc: 'Melhora, novo insight ou maior engajamento registrado' },
                  { key: 'neutral',  label: 'Sessão descritiva',  color: 'var(--warn)',   desc: 'Sem indicação clara de direção ou dados insuficientes' },
                  { key: 'negative', label: 'Requer atenção',    color: 'var(--danger)', desc: 'Piora, recaída ou desengajamento registrado' },
                ].map(({ key, label, color, desc }) => {
                  const count = evCounts[key] || 0
                  const pct = Math.round((count / evTotal) * 100)
                  return (
                    <div key={key} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--d)' }}>{label}</span>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 700, color, fontFamily: "'Fraunces', serif" }}>{count}</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--gr2)', borderRadius: '3px', overflow: 'hidden', marginBottom: '3px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)' }} />
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--gr4)', lineHeight: 1.4 }}>{pct}% · {desc}</div>
                    </div>
                  )
                })}
                <div style={{ marginTop: '14px', padding: '8px 12px', background: 'var(--ow)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5 }}>
                    Classificação feita pela IA com base nas suas anotações. A interpretação clínica é sempre sua.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

      {/* Modal de análise detalhada — o "ouro" do produto */}
      {analysisModal && (
        <AnalysisDetailModal
          patient={analysisModal}
          onClose={() => setAnalysisModal(null)}
          onGoToProfile={() => {
            setAnalysisModal(null)
            onGoToPatient && onGoToPatient(analysisModal)
          }}
        />
      )}
    </div>
  )
}
