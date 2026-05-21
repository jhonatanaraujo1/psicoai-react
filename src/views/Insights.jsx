import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../services'
import AiDrawer from '../components/AiDrawer'
import { showToast } from '../components/Toast'

const evolutionData = [
  { month: 'Dez', value: 58 },
  { month: 'Jan', value: 62 },
  { month: 'Fev', value: 59 },
  { month: 'Mar', value: 65 },
  { month: 'Abr', value: 63 },
  { month: 'Mai', value: 68 },
]

const PATTERN_LABELS = {
  avoidance:       { label: 'Evitação',      bg: '#2D4A38', color: '#fff' },
  rumination:      { label: 'Ruminação',     bg: '#3D6B4A', color: '#fff' },
  hypervigilance:  { label: 'Hipervig.',     bg: '#4A7C59', color: '#fff' },
  catastrophizing: { label: 'Catastrofiz.',  bg: '#5C8F6A', color: '#fff' },
  isolation:       { label: 'Isolamento',    bg: '#8BB89A', color: '#fff' },
}

const SEVERITY_COLOR = {
  high: 'var(--danger)',
  medium: 'var(--warn)',
  low: 'var(--g500)',
}

function Skeleton({ style }) {
  return <div className="skel-pulse" style={{ borderRadius: '6px', background: 'var(--gr2)', ...style }} />
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export default function Insights() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // AI Drawer for patient report
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerResult, setDrawerResult] = useState(null)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerPatient, setDrawerPatient] = useState(null)

  useEffect(() => {
    api.getInsights().then(setData).finally(() => setLoading(false))
  }, [])

  const handlePatientClick = async (item) => {
    if (!item.analyzed) return
    setDrawerPatient({ name: item.name, id: item.id })
    setDrawerOpen(true)
    setDrawerResult(null)
    setDrawerLoading(true)
    try {
      const analyses = await api.getPatientAnalyses(item.id)
      setDrawerResult(analyses[0] || { error: 'Nenhuma análise encontrada para este paciente.' })
    } catch {
      setDrawerResult({ error: 'Não foi possível carregar a análise.' })
    } finally {
      setDrawerLoading(false)
    }
  }

  const handleDrawerSave = (result) => {
    if (!result || result.error) return
    showToast(`Análise salva no prontuário de ${drawerPatient?.name || 'paciente'}`, 'success')
  }

  const coveragePct = data?.coveragePercent ?? 0
  const analyzedCount = data?.analyzedPatients ?? 0
  const totalCount = data?.totalPatients ?? 0

  return (
    <div className="view">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: 'var(--d)' }}>Inteligência Clínica</div>
        <div style={{ fontSize: '13px', color: 'var(--gr5)', marginTop: '4px' }}>
          Baseada em análises IA geradas por demanda · apenas pacientes com análise ativa são incluídos
        </div>
      </div>

      {/* Cobertura */}
      <div className="card" style={{ marginBottom: '0' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Cobertura de Análise IA</div>
            <div className="card-sub">
              {loading ? '…' : `${analyzedCount} de ${totalCount} pacientes · ${(data?.recentAnalyses || []).length} análises recentes`}
            </div>
          </div>
          {loading
            ? <Skeleton style={{ width: 60, height: 32 }} />
            : (
              <span style={{ fontFamily: "'Fraunces', serif", fontSize: '28px', fontWeight: 400, color: coveragePct >= 60 ? 'var(--g600)' : 'var(--warn)' }}>
                {coveragePct}%
              </span>
            )
          }
        </div>

        <div style={{ padding: '0 20px 16px' }}>
          {/* Barra segmentada */}
          {loading ? (
            <Skeleton style={{ height: 8, marginBottom: 16 }} />
          ) : (
            <div style={{ display: 'flex', gap: '3px', height: '8px', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
              {Array.from({ length: totalCount }).map((_, i) => (
                <div key={i} style={{ flex: 1, background: i < analyzedCount ? 'var(--g500)' : 'var(--gr2)', borderRadius: '2px' }} />
              ))}
            </div>
          )}

          {/* Lista de pacientes */}
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
                key={i}
                onClick={() => handlePatientClick(item)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: 'var(--r)', background: item.analyzed ? 'var(--g50)' : 'var(--ow)', border: `1px solid ${item.analyzed ? 'var(--g100)' : 'var(--gr2)'}`, marginBottom: '8px', cursor: item.analyzed ? 'pointer' : 'default', transition: 'background 0.15s, border-color 0.15s' }}
                onMouseEnter={item.analyzed ? e => { e.currentTarget.style.background = 'var(--g100)'; e.currentTarget.style.borderColor = 'var(--g300)' } : undefined}
                onMouseLeave={item.analyzed ? e => { e.currentTarget.style.background = 'var(--g50)'; e.currentTarget.style.borderColor = 'var(--g100)' } : undefined}
              >
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: item.avatarBg || 'var(--g100)', color: item.avatarColor || 'var(--g600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                  {item.initials || item.name?.split(' ').slice(0, 2).map(w => w[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>{item.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.analyzed
                      ? item.summary || `Última análise: ${item.lastAnalysis}`
                      : `${item.sessionCount} sessões · nenhuma análise IA gerada`}
                  </div>
                </div>
                {item.analyzed ? (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: 'var(--g100)', color: 'var(--g700)', border: '1px solid var(--g300)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    Ver relatório →
                  </span>
                ) : (
                  <button style={{ fontSize: '11px', fontWeight: 600, padding: '5px 11px', borderRadius: 'var(--r)', border: '1px solid var(--gr2)', background: 'var(--w)', color: 'var(--gr5)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', flexShrink: 0, transition: 'all 0.12s' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g300)'; e.currentTarget.style.color = 'var(--g600)'; e.currentTarget.style.background = 'var(--g50)' }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.color = 'var(--gr5)'; e.currentTarget.style.background = 'var(--w)' }}
                  >
                    Gerar análise
                  </button>
                )}
              </div>
            ))
          }
        </div>
      </div>

      {/* Info bar */}
      {!loading && analyzedCount > 0 && (
        <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 'var(--r)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span style={{ fontSize: '12px', color: 'var(--g700)' }}>
            Os dados abaixo são gerados exclusivamente a partir dos{' '}
            <strong>{analyzedCount} pacientes com análise IA ativa</strong>.
            Quanto mais pacientes forem analisados, mais precisos serão os insights.
          </span>
        </div>
      )}

      <div className="insights-grid">

        {/* Alertas */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Alertas Ativos</div>
            <span className={`card-badge ${(data?.alertCount?.high || 0) > 0 ? 'badge-danger' : 'badge-gray'}`}>
              {(data?.alertCount?.high || 0) + (data?.alertCount?.critical || 0)} críticos
            </span>
          </div>
          <div className="card-body">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} style={{ height: 14, marginBottom: 10 }} />)
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {['critical', 'high', 'medium', 'low'].map(level => {
                  const count = data?.alertCount?.[level] || 0
                  if (count === 0) return null
                  const labels = { critical: 'Crítico', high: 'Alto', medium: 'Médio', low: 'Baixo' }
                  return (
                    <div key={level} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 'var(--r)', background: 'var(--ow)', border: '1px solid var(--gr2)' }}>
                      <span style={{ fontSize: '12px', color: 'var(--d)', fontWeight: 500 }}>{labels[level]}</span>
                      <span style={{ fontSize: '16px', fontFamily: "'Fraunces', serif", color: SEVERITY_COLOR[level] || 'var(--gr5)', fontWeight: 400 }}>{count}</span>
                    </div>
                  )
                })}
                {Object.values(data?.alertCount || {}).every(v => v === 0) && (
                  <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '13px', color: 'var(--gr4)' }}>Nenhum alerta ativo</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Padrões */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Mapa de Padrões</div>
            {!loading && <span className="card-badge badge-green">{analyzedCount} pacientes</span>}
          </div>
          <div className="card-body">
            {loading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} style={{ height: 52 }} />)}
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '10px' }}>
                  {(data?.patternSummary || []).map((p, i) => {
                    const info = PATTERN_LABELS[p.type] || { label: p.type, bg: 'var(--gr2)', color: 'var(--d)' }
                    const intensity = { high: 85, medium: 60, low: 35 }[p.severity] || 50
                    return (
                      <div key={i} style={{ background: info.bg, color: info.color, borderRadius: '6px', padding: '8px 6px', textAlign: 'center', fontSize: '10px', fontWeight: 600, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700 }}>{p.count}</div>
                        <div style={{ opacity: 0.9 }}>{info.label}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--gr4)' }}>
                  Frequência de padrão detectado nas análises geradas
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hipóteses */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Hipóteses Diagnósticas</div>
            <span className="card-badge badge-gray">CID-11 · DSM-5</span>
          </div>
          <div className="card-body">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ marginBottom: '12px' }}>
                  <Skeleton style={{ height: 12, width: '70%', marginBottom: 6 }} />
                  <Skeleton style={{ height: 7 }} />
                </div>
              ))
            ) : (
              <>
                {(data?.topHypotheses || []).map(({ code, label, occurrences, avgProbability }) => (
                  <div key={code} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--d)', fontWeight: 500 }}>{code} — {label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--gr5)' }}>{occurrences}x</span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--d)', minWidth: '36px', textAlign: 'right' }}>{avgProbability}%</span>
                      </div>
                    </div>
                    <div style={{ height: '7px', background: 'var(--gr2)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${avgProbability}%`, height: '100%', background: 'var(--g500)', borderRadius: '4px' }} />
                    </div>
                  </div>
                ))}
                <div style={{ padding: '10px 12px', background: 'var(--warn-l)', borderRadius: '8px', fontSize: '11px', color: 'var(--warn)', lineHeight: 1.5, marginTop: '4px' }}>
                  ⚠ Hipóteses de suporte clínico. Diagnóstico é responsabilidade exclusiva do psicólogo.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Evolução geral */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Evolução Geral</div>
            <span className="card-badge badge-green">Últimos 6 meses</span>
          </div>
          <div className="card-body">
            <div style={{ height: '160px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolutionData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8B8B8B' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#8B8B8B' }} axisLine={false} tickLine={false} domain={[50, 75]} />
                  <Tooltip
                    contentStyle={{ background: '#1C1C1C', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                    formatter={(v) => [`${v}%`, 'Índice de evolução']}
                  />
                  <Line type="monotone" dataKey="value" stroke="var(--g500)" strokeWidth={2.5} dot={{ fill: 'var(--g500)', r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '8px' }}>
              Baseado em {analyzedCount} pacientes analisados · escala 0–100%
            </div>
          </div>
        </div>

      </div>

      <AiDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={handleDrawerSave}
        patient={drawerPatient}
        result={drawerResult}
        loading={drawerLoading}
      />
    </div>
  )
}
