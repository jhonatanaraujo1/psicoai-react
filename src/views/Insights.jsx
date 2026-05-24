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

// Tradução dos padrões para linguagem acessível
const PATTERN_INFO = {
  avoidance:       { label: 'Evitação',     desc: 'Paciente desvia de temas ou situações difíceis', bg: '#2D4A38', color: '#fff' },
  rumination:      { label: 'Ruminação',    desc: 'Pensamentos repetitivos que o paciente não consegue largar', bg: '#3D6B4A', color: '#fff' },
  hypervigilance:  { label: 'Hipervigilância', desc: 'Estado de alerta constante, dificuldade de relaxar', bg: '#4A7C59', color: '#fff' },
  catastrophizing: { label: 'Catastrofização', desc: 'Tendência a imaginar sempre o pior cenário', bg: '#5C8F6A', color: '#fff' },
  isolation:       { label: 'Isolamento',   desc: 'Afastamento de pessoas e situações sociais', bg: '#8BB89A', color: '#fff' },
}

const ALERT_INFO = {
  critical: { label: 'Atenção imediata', color: 'var(--danger)', bg: 'var(--danger-l)', desc: 'Requer avaliação urgente' },
  high:     { label: 'Alta prioridade',  color: '#E67E22',        bg: '#FEF3E8',        desc: 'Acompanhar de perto' },
  medium:   { label: 'Monitorar',        color: 'var(--warn)',    bg: 'var(--warn-l)',  desc: 'Observar na próxima sessão' },
  low:      { label: 'Atenção leve',     color: 'var(--g600)',    bg: 'var(--g50)',     desc: 'Dentro do esperado' },
}

function Skeleton({ style }) {
  return <div className="skel-pulse" style={{ borderRadius: '6px', background: 'var(--gr2)', ...style }} />
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
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
      >
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      {show && (
        <div style={{
          position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
          background: '#1C1C1C', color: '#fff', fontSize: '11px', lineHeight: 1.5,
          padding: '7px 10px', borderRadius: '7px', whiteSpace: 'nowrap', maxWidth: '220px',
          whiteSpace: 'normal', zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  )
}

export default function Insights({ onGoToPatient }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
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
      const res = await api.getPatientAnalyses(item.id)
      const list = res?.content ?? (Array.isArray(res) ? res : [])
      setDrawerResult(list[0] || { error: 'Nenhuma análise encontrada para este paciente.' })
    } catch {
      setDrawerResult({ error: 'Não foi possível carregar a análise.' })
    } finally {
      setDrawerLoading(false)
    }
  }

  const handleDrawerSave = (result) => {
    if (!result || result.error) return
    setDrawerOpen(false)
    if (drawerPatient && onGoToPatient) {
      onGoToPatient({ id: drawerPatient.id, name: drawerPatient.name })
    }
  }

  const coveragePct = data?.coveragePercent ?? 0
  const analyzedCount = data?.analyzedPatients ?? 0
  const totalCount = data?.totalPatients ?? 0
  const unanalyzedCount = totalCount - analyzedCount

  const totalAlerts = Object.values(data?.alertCount || {}).reduce((a, b) => a + b, 0)

  // Tendência do gráfico em linguagem simples
  const firstVal = evolutionData[0]?.value || 0
  const lastVal = evolutionData[evolutionData.length - 1]?.value || 0
  const trend = lastVal > firstVal + 3 ? 'subindo' : lastVal < firstVal - 3 ? 'caindo' : 'estável'
  const trendText = { subindo: '↑ Tendência de melhora', caindo: '↓ Tendência de queda', estável: '→ Situação estável' }[trend]
  const trendColor = { subindo: 'var(--g600)', caindo: 'var(--danger)', estável: 'var(--warn)' }[trend]

  return (
    <div className="view">

      {/* Header simplificado */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: 'var(--d)' }}>
          Resumo da Carteira
        </div>
        <div style={{ fontSize: '13px', color: 'var(--gr5)', marginTop: '4px' }}>
          Uma visão geral de como seus pacientes estão — baseada nas análises IA que você gerou
        </div>
      </div>

      {/* Banner orientador para quem não tem análises ainda */}
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
              Vá até um paciente, anote uma sessão e clique em <strong>"Analisar com IA"</strong>. Os padrões, alertas e hipóteses vão aparecer aqui automaticamente.
            </div>
          </div>
        </div>
      )}

      {/* Seus pacientes — lista principal */}
      <div className="card" style={{ marginBottom: '0' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Seus Pacientes</div>
            <div className="card-sub">
              {loading ? '…' : (
                analyzedCount === 0
                  ? `${totalCount} pacientes · nenhuma análise IA gerada ainda`
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
                      : `${item.sessionCount} sessões · ainda sem análise IA`}
                  </div>
                </div>
                {item.analyzed ? (
                  <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: 'var(--g100)', color: 'var(--g700)', border: '1px solid var(--g300)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    Ver análise →
                  </span>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--gr4)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Sem análise ainda
                  </span>
                )}
              </div>
            ))
          }
        </div>
      </div>

      {/* Só mostra os cards de insights se houver dados */}
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

            {/* Alertas — linguagem de ação */}
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

            {/* Padrões — com descrição acessível */}
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

            {/* Hipóteses — com contexto claro */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    Hipóteses da IA
                    <Tip text="O que a IA levantou como hipótese nos pacientes analisados. Use como referência de estudo — o diagnóstico é sempre seu." />
                  </div>
                  <div className="card-sub">O que apareceu mais nas análises geradas</div>
                </div>
              </div>
              <div className="card-body">
                {(data?.topHypotheses || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px 0', fontSize: '12px', color: 'var(--gr4)' }}>Nenhuma hipótese disponível ainda</div>
                ) : (
                  <>
                    {(data?.topHypotheses || []).map(({ code, label, occurrences, avgProbability }) => (
                      <div key={code} style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px', gap: '8px' }}>
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--d)', fontWeight: 600 }}>{label}</div>
                            <div style={{ fontSize: '10px', color: 'var(--gr4)', marginTop: '1px' }}>{code} · apareceu em {occurrences} análise{occurrences > 1 ? 's' : ''}</div>
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--g600)', flexShrink: 0 }}>{avgProbability}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--gr2)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${avgProbability}%`, height: '100%', background: 'var(--g500)', borderRadius: '4px' }} />
                        </div>
                      </div>
                    ))}
                    <div style={{ padding: '10px 12px', background: 'var(--warn-l)', borderRadius: '8px', fontSize: '11px', color: 'var(--warn)', lineHeight: 1.5 }}>
                      ⚠ São hipóteses de apoio — o diagnóstico é sempre responsabilidade do psicólogo.
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Evolução — com interpretação em palavras */}
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Como a carteira evoluiu</div>
                  <div className="card-sub">Últimos 6 meses · pacientes analisados</div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: trendColor, background: `${trendColor}18`, padding: '3px 10px', borderRadius: '20px', border: `1px solid ${trendColor}33`, whiteSpace: 'nowrap' }}>
                  {trendText}
                </span>
              </div>
              <div className="card-body">
                <div style={{ height: '140px' }}>
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
                <div style={{ marginTop: '10px', padding: '8px 12px', background: 'var(--ow)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--d)' }}>Como ler:</strong> 100% = evolução máxima registrada. O gráfico mostra a média dos pacientes analisados. Quedas pontuais são normais — o que importa é a tendência geral.
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}

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
