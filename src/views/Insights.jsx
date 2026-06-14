import { useState, useEffect, useCallback } from 'react'
import { api } from '../services'
import AiAnalysisPanel from '../components/AiAnalysisPanel'

// ── Helpers ───────────────────────────────────────────────────────────────────

const PATTERN_INFO = {
  avoidance:       { label: 'Evitação',        desc: 'Desvia de temas ou situações difíceis' },
  rumination:      { label: 'Ruminação',       desc: 'Pensamentos repetitivos sem saída' },
  hypervigilance:  { label: 'Hipervigilância', desc: 'Estado de alerta constante' },
  catastrophizing: { label: 'Catastrofização', desc: 'Imagina sempre o pior cenário' },
  isolation:       { label: 'Isolamento',      desc: 'Afastamento social progressivo' },
}

const EVOLUTION_INFO = {
  positive: { label: 'Evolução positiva', color: '#16a34a', bg: '#dcfce7', dot: '#22c55e' },
  negative: { label: 'Atenção necessária', color: '#dc2626', bg: '#fee2e2', dot: '#ef4444' },
  neutral:  { label: 'Estável',           color: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
}

const ALERT_COLOR = {
  critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#6b7280',
}

const SCOPE_LABEL = {
  notebook: 'Caderno completo', note: 'Sessão única', selection: 'Seleção',
}

function Skeleton({ style }) {
  return <div className="skel-pulse" style={{ borderRadius: '6px', background: 'var(--gr2)', ...style }} />
}

function tryParse(raw, fallback = []) {
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw || '[]') } catch { return fallback }
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function daysSince(iso) {
  if (!iso) return 9999
  return Math.floor((Date.now() - new Date(iso)) / 86400000)
}

function daysSinceLabel(d) {
  if (d === 0) return 'hoje'
  if (d === 1) return 'ontem'
  if (d < 7) return `${d} dias atrás`
  if (d < 30) return `${Math.floor(d / 7)} sem. atrás`
  if (d < 365) return `${Math.floor(d / 30)} mes. atrás`
  return `${Math.floor(d / 365)} ano(s) atrás`
}

function getInitials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}

// ── PatientInsightsView — visão longitudinal de um paciente ───────────────────

function PatientInsightsView({ patient, onBack, onGoToPatient, onOpenAnalysisHub }) {
  const [trendData, setTrendData]         = useState(null)
  const [allAnalyses, setAllAnalyses]     = useState([])
  const [shownAnalysis, setShownAnalysis] = useState(null)
  const [loadingSwap, setLoadingSwap]     = useState(false)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)

  const load = useCallback(() => {
    if (!patient?.id) return
    setLoading(true)
    setError(null)
    Promise.all([
      api.getPatientInsights(patient.id),
      api.getPatientAnalyses(patient.id, { size: 20 }),
    ])
      .then(([insights, page]) => {
        setTrendData(insights)
        const list = page?.content || []
        setAllAnalyses(list)
        // AnalysisListResponse não tem hipóteses/padrões/alertas — busca o full response
        if (list.length > 0) {
          return api.getAnalysis(list[0].id)
            .then(full => { if (full) setShownAnalysis(full) })
            .catch(() => {})
        }
      })
      .catch(() => setError('Não foi possível carregar os dados deste paciente.'))
      .finally(() => setLoading(false))
  }, [patient?.id])

  useEffect(() => { load() }, [load])

  function switchToAnalysis(id) {
    if (shownAnalysis?.id === id) return
    setLoadingSwap(true)
    // Sempre busca o full response — AnalysisListResponse (cache) não tem conteúdo clínico
    api.getAnalysis(id)
      .then(full => { if (full) setShownAnalysis(full) })
      .catch(() => {})
      .finally(() => setLoadingSwap(false))
  }

  const analyses   = trendData?.analyses || []
  const hyps       = trendData?.hypothesisTrend || []
  const hasHistory = analyses.length > 1
  const evoInfo    = EVOLUTION_INFO[analyses[0]?.evolution] || EVOLUTION_INFO.neutral

  return (
    <div className="view">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
            color: 'var(--gr5)', fontSize: '13px', padding: '4px 0',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Insights da Carteira
        </button>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        <span style={{ fontSize: '13px', color: 'var(--d)', fontWeight: 600 }}>{patient.name}</span>
      </div>

      {/* Patient header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px',
        marginBottom: '24px', padding: '16px 20px',
        background: 'var(--ow)', borderRadius: '12px',
        border: '1px solid var(--gr2)',
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--g100)', color: 'var(--g700)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 700, flexShrink: 0,
        }}>
          {getInitials(patient.name)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--d)' }}>{patient.name}</div>
          {!loading && trendData && (
            <div style={{ fontSize: '12px', color: 'var(--gr5)', marginTop: '2px' }}>
              {trendData.totalSessions} {trendData.totalSessions !== 1 ? 'anotações' : 'anotação'}
              {analyses.length > 0 && ` · ${analyses.length} análise${analyses.length !== 1 ? 's' : ''} IA`}
              {analyses.length > 0 && ` · última ${fmtDate(analyses[0].createdAt)}`}
            </div>
          )}
        </div>
        {!loading && analyses.length > 0 && (
          <div style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 600,
            background: evoInfo.bg, color: evoInfo.color,
            border: `1px solid ${evoInfo.color}30`, flexShrink: 0,
          }}>
            {evoInfo.label}
          </div>
        )}
        {onOpenAnalysisHub && (
          <button
            onClick={() => onOpenAnalysisHub(patient)}
            style={{
              background: 'var(--g600)', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '8px 14px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            Nova análise
          </button>
        )}
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[320, 120, 80].map((h, i) => <Skeleton key={i} style={{ height: h, width: '100%' }} />)}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          background: 'var(--ow)', borderRadius: '12px', border: '1px solid var(--gr2)',
        }}>
          <div style={{ fontSize: '13px', color: 'var(--danger)', marginBottom: '8px' }}>{error}</div>
          <button
            onClick={load}
            style={{ fontSize: '12px', color: 'var(--g600)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && analyses.length === 0 && (
        <div style={{
          padding: '48px 24px', textAlign: 'center',
          background: 'var(--ow)', borderRadius: '12px', border: '1px dashed var(--gr3)',
        }}>
          <div style={{ fontSize: '28px', marginBottom: '12px', opacity: 0.4 }}>📋</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--d)', marginBottom: '6px' }}>
            Nenhuma análise IA ainda
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.6, marginBottom: '16px' }}>
            Gere a primeira análise para ver a evolução longitudinal deste paciente.
          </div>
          {onOpenAnalysisHub && (
            <button
              onClick={() => onOpenAnalysisHub(patient)}
              style={{
                background: 'var(--g600)', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '10px 20px', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Analisar com IA →
            </button>
          )}
        </div>
      )}

      {!loading && !error && analyses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Bloco principal — análise IA completa */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Análise IA
              </span>
              {shownAnalysis && (
                <span style={{ fontSize: '11px', color: 'var(--gr4)' }}>— {fmtDate(shownAnalysis.createdAt)}</span>
              )}
              {shownAnalysis?.id !== allAnalyses[0]?.id && allAnalyses[0] && (
                <button
                  onClick={() => setShownAnalysis(allAnalyses[0])}
                  style={{ fontSize: '10px', color: 'var(--g600)', background: 'var(--g50)', border: '1px solid var(--g200)', padding: '1px 8px', borderRadius: '20px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  ← mais recente
                </button>
              )}
            </div>
            {loadingSwap
              ? <Skeleton style={{ height: 300, width: '100%' }} />
              : shownAnalysis && <AiAnalysisPanel analysis={shownAnalysis} createdAt={shownAnalysis.createdAt} />
            }
          </div>

          {/* Timeline histórico — clicável para trocar no painel acima */}
          {hasHistory && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Histórico de análises</div>
                  <div className="card-sub">Clique para visualizar qualquer análise completa</div>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--gr4)', background: 'var(--gr1)', padding: '2px 8px', borderRadius: '20px' }}>
                  {analyses.length} análises
                </span>
              </div>
              <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {analyses.map((a, i) => {
                  const evo     = EVOLUTION_INFO[a.evolution] || EVOLUTION_INFO.neutral
                  const isShown = shownAnalysis?.id === a.id
                  return (
                    <div
                      key={a.id}
                      onClick={() => switchToAnalysis(a.id)}
                      style={{
                        display: 'flex', gap: '12px', alignItems: 'flex-start',
                        padding: '10px 14px', borderRadius: '10px',
                        background: isShown ? 'var(--g50)' : 'var(--ow)',
                        border: `1px solid ${isShown ? 'var(--g200)' : 'var(--gr2)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0, paddingTop: '3px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: evo.dot }} />
                        {i < analyses.length - 1 && (
                          <div style={{ width: 1, height: 16, background: 'var(--gr2)', marginTop: '2px' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--d)' }}>{fmtDate(a.createdAt)}</span>
                          {i === 0 && <span style={{ fontSize: '10px', color: 'var(--g600)', background: 'var(--g100)', padding: '1px 7px', borderRadius: '20px', fontWeight: 600 }}>Mais recente</span>}
                          <span style={{ fontSize: '10px', padding: '1px 7px', borderRadius: '20px', background: evo.bg, color: evo.color, fontWeight: 600 }}>{evo.label}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          {a.hypothesisCount > 0 && <span style={{ fontSize: '10px', color: 'var(--gr5)' }}><strong style={{ color: 'var(--d)' }}>{a.hypothesisCount}</strong> hipótese{a.hypothesisCount !== 1 ? 's' : ''}</span>}
                          {a.patternCount > 0    && <span style={{ fontSize: '10px', color: 'var(--gr5)' }}><strong style={{ color: 'var(--d)' }}>{a.patternCount}</strong> padrão{a.patternCount !== 1 ? 'ões' : ''}</span>}
                          {a.alertCount > 0      && <span style={{ fontSize: '10px', color: ALERT_COLOR.high, fontWeight: 600 }}>{a.alertCount} alerta{a.alertCount !== 1 ? 's' : ''}</span>}
                        </div>
                        {/* Alertas inline — só quando este item está selecionado e a análise está carregada */}
                        {isShown && shownAnalysis && (() => {
                          const alerts = tryParse(shownAnalysis.riskAlerts)
                          if (!alerts.length) return null
                          const LEVEL_COLOR = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#6b7280' }
                          const LEVEL_LABEL = { critical: 'CRÍTICO', high: 'ALTO', medium: 'MODERADO', low: 'BAIXO' }
                          return (
                            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {alerts.map((r, ri) => {
                                const color = LEVEL_COLOR[r.level] || LEVEL_COLOR.medium
                                const label = LEVEL_LABEL[r.level] || r.level
                                return (
                                  <div key={ri} style={{
                                    padding: '9px 12px', borderRadius: '8px',
                                    background: `${color}0d`, border: `1px solid ${color}30`,
                                    display: 'flex', gap: '8px', alignItems: 'flex-start',
                                  }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, marginTop: '5px' }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: '9px', fontWeight: 800, color, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '3px' }}>
                                        {label}
                                      </div>
                                      <div style={{ fontSize: '11.5px', color: 'var(--d)', lineHeight: 1.5 }}>
                                        {r.description}
                                      </div>
                                      {r.recommendedAction && (
                                        <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '4px', lineHeight: 1.4, fontStyle: 'italic' }}>
                                          → {r.recommendedAction}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>
                      {isShown && (
                        <div style={{ width: 3, alignSelf: 'stretch', borderRadius: '2px', background: 'var(--g400)', flexShrink: 0 }} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tendência de hipóteses — só quando múltiplas análises */}
          {hasHistory && hyps.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Tendência de hipóteses</div>
                  <div className="card-sub">Como cada hipótese evoluiu entre as análises</div>
                </div>
              </div>
              <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {hyps.map((h) => {
                  const sorted    = [...h.occurrences].sort((a, b) => new Date(a.date) - new Date(b.date))
                  // probability vem como 0-100 do backend
                  const probFirst = sorted[0]?.probability || 0
                  const probLast  = sorted[sorted.length - 1]?.probability || 0
                  const delta     = probLast - probFirst
                  const trend     = delta > 5 ? 'up' : delta < -5 ? 'down' : 'stable'
                  return (
                    <div key={h.code} style={{
                      padding: '12px 14px', borderRadius: '10px',
                      background: 'var(--ow)', border: '1px solid var(--gr2)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--d)' }}>{h.label}</div>
                          <div style={{ fontSize: '10px', color: 'var(--gr4)' }}>{h.code} · {h.occurrences.length} análise{h.occurrences.length !== 1 ? 's' : ''}</div>
                        </div>
                        {trend === 'up'     && <span style={{ fontSize: '10px', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>↑ aumentando</span>}
                        {trend === 'down'   && <span style={{ fontSize: '10px', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>↓ reduzindo</span>}
                        {trend === 'stable' && <span style={{ fontSize: '10px', color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>→ estável</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: 48 }}>
                        {sorted.map((occ, i) => {
                          // probability = 0-100; normaliza para 0-1 para altura da barra
                          const p01      = Math.max(0.05, occ.probability / 100)
                          const barColor = occ.probability >= 70 ? '#dc2626' : occ.probability >= 50 ? '#d97706' : '#9ca3af'
                          return (
                            <div key={occ.analysisId + i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', height: '100%', justifyContent: 'flex-end' }}>
                              <span style={{ fontSize: '9px', color: 'var(--gr4)', fontWeight: 600 }}>{Math.round(occ.probability)}%</span>
                              <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: `${Math.round(p01 * 32)}px`, background: barColor }} />
                            </div>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '3px' }}>
                        {sorted.map((occ, i) => (
                          <div key={i} style={{ flex: 1, fontSize: '9px', color: 'var(--gr4)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fmtDate(occ.date).replace(/\s\d{4}$/, '')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* CTA calibrar IA */}
          {onGoToPatient && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              padding: '12px 16px', borderRadius: '10px',
              background: 'var(--g50)', border: '1px solid var(--g200)',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--g700)', marginBottom: '2px' }}>Calibrar a IA para este paciente</div>
                <div style={{ fontSize: '11px', color: 'var(--g600)', lineHeight: 1.5 }}>
                  Histórico familiar, medicações, objetivos terapêuticos? Adicione no perfil para que as próximas análises sejam mais precisas.
                </div>
              </div>
              <button
                onClick={() => onGoToPatient(patient)}
                style={{ fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '7px', background: 'var(--g600)', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0, fontFamily: "'DM Sans', sans-serif" }}
              >
                Ir ao perfil →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── InsightsPortfolio — carteira action-oriented ──────────────────────────────

function InsightsPortfolio({ onSelectPatient, onOpenAnalysisHub }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getInsights().then(setData).finally(() => setLoading(false))
  }, [])

  const totalCount      = data?.totalPatients    ?? 0
  const analyzedCount   = data?.analyzedPatients ?? 0
  const coveragePct     = data?.coveragePercent  ?? 0
  const unanalyzedCount = totalCount - analyzedCount

  const criticalAlerts = (data?.alertCount?.critical || 0) + (data?.alertCount?.high || 0)
  const totalAlerts    = Object.values(data?.alertCount || {}).reduce((a, b) => a + b, 0)

  // Pacientes analisados — deduplica por paciente, mais recente
  const analyzedPatients = Object.values(
    (data?.recentAnalyses || []).reduce((acc, a) => {
      if (!acc[a.patientId] || new Date(a.createdAt) > new Date(acc[a.patientId].createdAt)) {
        acc[a.patientId] = a
      }
      return acc
    }, {})
  ).map(a => ({
    id: a.patientId, name: a.patientName, analyzed: true,
    lastAnalysis: a.createdAt, evolution: a.evolution, summary: a.summary,
  }))

  // Mais antigos primeiro (mais urgentes para re-análise)
  const analyzedSorted = [...analyzedPatients].sort((a, b) =>
    new Date(a.lastAnalysis) - new Date(b.lastAnalysis)
  )

  const unanalyzedPatients = (data?.unanalyzedPatients || []).map(p => ({
    id: p.id, name: p.name, initials: p.initials,
    avatarBg: p.avatarBg, avatarColor: p.avatarColor,
    analyzed: false, sessionCount: p.sessionCount,
  })).sort((a, b) => (b.sessionCount || 0) - (a.sessionCount || 0))

  const allPatients = [...analyzedSorted, ...unanalyzedPatients]

  const stalePatients    = analyzedSorted.filter(p => daysSince(p.lastAnalysis) > 30)
  const readyToAnalyze   = unanalyzedPatients.filter(p => (p.sessionCount || 0) >= 2)

  const patternSummary = (data?.patternSummary || []).reduce((acc, p) => {
    if (!acc[p.type] || acc[p.type] < p.count) acc[p.type] = p.count
    return acc
  }, {})
  const topPatterns  = Object.entries(patternSummary).sort(([, a], [, b]) => b - a).slice(0, 3)
  const topHypotheses = (data?.topHypotheses || []).slice(0, 3)

  return (
    <div className="view">
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: 'var(--d)' }}>
          Insights da Carteira
        </div>
        <div style={{ fontSize: '13px', color: 'var(--gr5)', marginTop: '4px' }}>
          O que precisa de atenção hoje — baseado nas análises IA geradas
        </div>
      </div>

      {/* Banner — nenhuma análise ainda */}
      {!loading && analyzedCount === 0 && (
        <div style={{
          background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: '12px',
          padding: '20px 24px', marginBottom: '24px',
          display: 'flex', gap: '16px', alignItems: 'flex-start',
        }}>
          <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'var(--g600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--g700)', marginBottom: '4px' }}>
              Os insights aparecem conforme você analisa os pacientes
            </div>
            <div style={{ fontSize: '13px', color: 'var(--g600)', lineHeight: 1.6 }}>
              Abra um paciente, gere uma análise clínica e os padrões, hipóteses e alertas da sua carteira ficam disponíveis aqui.
            </div>
          </div>
        </div>
      )}

      {/* Atenção agora — urgências visíveis */}
      {!loading && (criticalAlerts > 0 || stalePatients.length > 0 || readyToAnalyze.length > 0) && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gr5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
            Atenção agora
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {criticalAlerts > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                background: '#fee2e2', border: '1px solid #dc262630',
                flex: '1 1 200px',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>
                    {criticalAlerts} alerta{criticalAlerts !== 1 ? 's' : ''} crítico{criticalAlerts !== 1 ? 's' : ''}
                  </div>
                  <div style={{ fontSize: '11px', color: '#7f1d1d' }}>Padrões que exigem atenção imediata</div>
                </div>
              </div>
            )}
            {stalePatients.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                background: '#fef3c7', border: '1px solid #d9770630',
                flex: '1 1 200px',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
                    {stalePatients.length} {stalePatients.length !== 1 ? 'análises' : 'análise'} desatualizadas
                  </div>
                  <div style={{ fontSize: '11px', color: '#78350f' }}>Sem re-análise há mais de 30 dias</div>
                </div>
              </div>
            )}
            {readyToAnalyze.length > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 14px', borderRadius: '10px',
                background: 'var(--g50)', border: '1px solid var(--g200)',
                flex: '1 1 200px',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--g500)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--g700)' }}>
                    {readyToAnalyze.length} {readyToAnalyze.length !== 1 ? 'pacientes' : 'paciente'} prontos para analisar
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--g600)' }}>Têm anotações mas nenhuma análise IA</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Números da carteira */}
      {!loading && totalCount > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '8px', marginBottom: '20px',
        }}>
          {[
            { label: 'Pacientes',       value: totalCount,      color: 'var(--d)' },
            { label: 'Analisados',      value: `${analyzedCount} (${coveragePct}%)`, color: 'var(--g600)' },
            { label: 'Sem análise',     value: unanalyzedCount, color: unanalyzedCount > 0 ? 'var(--warn)' : 'var(--gr4)' },
            { label: 'Alertas ativos',  value: totalAlerts,     color: totalAlerts > 0 ? 'var(--danger)' : 'var(--gr4)' },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '12px 14px', borderRadius: '10px',
              background: 'var(--ow)', border: '1px solid var(--gr2)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '18px', fontFamily: "'Fraunces', serif", fontWeight: 400, color: stat.color }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--gr5)', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de pacientes */}
      <div className="card" style={{ marginBottom: analyzedCount > 0 ? '20px' : '0' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Seus pacientes</div>
            <div className="card-sub">
              {loading ? '…' : (
                analyzedCount === 0
                  ? `${totalCount} ${totalCount !== 1 ? 'pacientes' : 'paciente'} · nenhuma análise IA gerada`
                  : `${analyzedCount} analisados · clique para ver evolução individual`
              )}
            </div>
          </div>
          {!loading && totalCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ height: '5px', width: '72px', background: 'var(--gr2)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${coveragePct}%`, background: 'var(--g500)', borderRadius: '4px', transition: 'width 0.6s ease' }} />
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: coveragePct >= 60 ? 'var(--g600)' : 'var(--warn)' }}>{coveragePct}%</span>
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
            : allPatients.map((item, i) => {
                const evo    = EVOLUTION_INFO[item.evolution] || EVOLUTION_INFO.neutral
                const days   = item.analyzed ? daysSince(item.lastAnalysis) : null
                const stale  = days !== null && days > 30
                const urgent = days !== null && days > 90

                return (
                  <div
                    key={`${item.id}-${i}`}
                    onClick={() => item.analyzed
                      ? onSelectPatient(item)
                      : onOpenAnalysisHub && onOpenAnalysisHub(item)
                    }
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 12px', borderRadius: 'var(--r)',
                      background: urgent ? '#fff8f8' : item.analyzed ? 'var(--g50)' : 'var(--ow)',
                      border: `1px solid ${urgent ? '#dc262618' : item.analyzed ? 'var(--g100)' : 'var(--gr2)'}`,
                      marginBottom: '8px', cursor: 'pointer',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--g50)'; e.currentTarget.style.borderColor = 'var(--g200)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = urgent ? '#fff8f8' : item.analyzed ? 'var(--g50)' : 'var(--ow)'; e.currentTarget.style.borderColor = urgent ? '#dc262618' : item.analyzed ? 'var(--g100)' : 'var(--gr2)' }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: item.avatarBg || 'var(--g100)', color: item.avatarColor || 'var(--g700)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 700, flexShrink: 0,
                    }}>
                      {item.initials || getInitials(item.name)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.name}
                        {item.analyzed && <span style={{ width: 6, height: 6, borderRadius: '50%', background: evo.dot, flexShrink: 0 }} />}
                      </div>
                      <div style={{ fontSize: '11px', color: urgent ? '#dc2626' : stale ? '#92400e' : 'var(--gr5)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.analyzed
                          ? (urgent ? `⚠ Sem re-análise há ${daysSinceLabel(days)}` : stale ? `Revisar — ${daysSinceLabel(days)}` : `Última análise ${daysSinceLabel(days)}`)
                          : `${item.sessionCount || 0} anotações · ainda sem análise IA`}
                      </div>
                    </div>

                    {/* CTA */}
                    {item.analyzed ? (
                      <span style={{
                        fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                        background: urgent ? '#fee2e2' : 'var(--g100)',
                        color: urgent ? '#dc2626' : 'var(--g700)',
                        border: `1px solid ${urgent ? '#dc262630' : 'var(--g300)'}`,
                        flexShrink: 0, whiteSpace: 'nowrap',
                      }}>
                        Ver evolução →
                      </span>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); onOpenAnalysisHub && onOpenAnalysisHub(item) }}
                        style={{
                          fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px',
                          background: 'linear-gradient(135deg, #5C8F6A 0%, #4A7C59 100%)', color: '#fff',
                          border: 'none', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                      >
                        Analisar →
                      </button>
                    )}
                  </div>
                )
              })
          }
        </div>
      </div>

      {/* Contexto clínico da carteira — padrões + hipóteses como contexto secundário */}
      {!loading && analyzedCount > 0 && (topPatterns.length > 0 || topHypotheses.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>

          {topPatterns.length > 0 && (
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Padrões da carteira</div>
                  <div className="card-sub">O que mais aparece nos seus pacientes</div>
                </div>
              </div>
              <div style={{ padding: '0 20px 16px' }}>
                {topPatterns.map(([type, count]) => {
                  const info = PATTERN_INFO[type] || { label: type, desc: '' }
                  return (
                    <div key={type} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 12px', borderRadius: '8px',
                      background: 'var(--ow)', border: '1px solid var(--gr2)', marginBottom: '8px',
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '6px', background: 'var(--g100)', color: 'var(--g700)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: "'Fraunces', serif", fontSize: '13px', flexShrink: 0,
                      }}>
                        {count}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--d)' }}>{info.label}</div>
                        <div style={{ fontSize: '10px', color: 'var(--gr5)' }}>{info.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {topHypotheses.length > 0 && (
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-header">
                <div>
                  <div className="card-title">Hipóteses frequentes</div>
                  <div className="card-sub">Temas que mais aparecem nas análises</div>
                </div>
              </div>
              <div style={{ padding: '0 20px 16px' }}>
                {topHypotheses.map(({ code, label, occurrences }) => (
                  <div key={code || label} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 12px', borderRadius: '8px',
                    background: 'var(--ow)', border: '1px solid var(--gr2)', marginBottom: '8px',
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '6px', background: 'var(--g50)', color: 'var(--g600)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'Fraunces', serif", fontSize: '13px', fontWeight: 600, flexShrink: 0,
                    }}>
                      {occurrences}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'var(--d)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
                      <div style={{ fontSize: '10px', color: 'var(--gr4)', marginTop: '1px' }}>{occurrences} análise{occurrences !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                ))}
                <div style={{ padding: '8px 12px', background: 'var(--g50)', borderRadius: '8px', fontSize: '10px', color: 'var(--g600)', lineHeight: 1.5 }}>
                  Hipóteses de suporte ao raciocínio clínico · O diagnóstico é de responsabilidade do profissional
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────

export default function Insights({ onGoToPatient, onOpenAnalysisHub }) {
  const [selectedPatient, setSelectedPatient] = useState(null)

  const handleSelectPatient = useCallback((patient) => {
    setSelectedPatient({ id: patient.id, name: patient.name })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const handleBack = useCallback(() => {
    setSelectedPatient(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (selectedPatient) {
    return (
      <PatientInsightsView
        patient={selectedPatient}
        onBack={handleBack}
        onGoToPatient={onGoToPatient}
        onOpenAnalysisHub={onOpenAnalysisHub}
      />
    )
  }

  return (
    <InsightsPortfolio
      onSelectPatient={handleSelectPatient}
      onOpenAnalysisHub={onOpenAnalysisHub}
    />
  )
}
