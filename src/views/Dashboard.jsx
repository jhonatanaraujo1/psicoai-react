import { useState, useEffect } from 'react'
import { api } from '../services'

const fmt = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const fmtCurrency = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)

const EvolutionDot = ({ level }) => {
  const colors = { high: '#E74C3C', medium: '#F39C12', low: '#27AE60', critical: '#8E44AD' }
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[level] || '#ccc', display: 'inline-block', flexShrink: 0 }} />
}

export default function Dashboard({ setCurrentView, currentUser }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const hoje = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })

  const load = () => {
    setLoading(true)
    setError(null)
    api.getDashboard()
      .then(setData)
      .catch(e => setError(e.message || 'Erro ao carregar dashboard'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  if (error) return (
    <div className="view" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16, textAlign: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.4" style={{ opacity: 0.7 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div style={{ fontSize: 14, color: 'var(--d)', fontWeight: 500 }}>Não foi possível carregar o dashboard</div>
      <div style={{ fontSize: 12, color: 'var(--gr5)' }}>{error}</div>
      <button className="btn-primary" onClick={load} style={{ marginTop: 4 }}>Tentar novamente</button>
    </div>
  )

  if (loading) return (
    <div className="view">
      <div className="stats-row">
        {[0,1,2,3].map(i => (
          <div key={i} className="stat-card">
            <div className="sk sk-circle" style={{ width: 38, height: 38, marginBottom: 14 }} />
            <div className="sk sk-h" style={{ width: '50%', height: 30 }} />
            <div className="sk sk-h" style={{ width: '70%', height: 12, marginTop: 8 }} />
          </div>
        ))}
      </div>
    </div>
  )

  const { stats, todaySessions = [], recentAlerts = [], financialSnapshot, account } = data || {}

  const typeColors = { session: 'green', supervision: 'blue', personal: 'gray', other: 'gray' }

  // Computa cor do avatar a partir do ID (não depende de IDs fixos)
  const AVATAR_COLORS = [
    { bg: 'var(--g50)',      color: 'var(--g600)'  },
    { bg: '#E3F2FD',         color: '#1565C0'       },
    { bg: '#F3E5F5',         color: '#6A1B9A'       },
    { bg: 'var(--warn-l)',   color: 'var(--warn)'   },
    { bg: '#FCE4EC',         color: '#880E4F'       },
    { bg: 'var(--g100)',     color: 'var(--g700)'   },
    { bg: '#FFF8E1',         color: '#F57F17'       },
  ]
  function getAvatarStyle(id = '') {
    const idx = Math.abs(String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % AVATAR_COLORS.length
    return AVATAR_COLORS[idx]
  }
  function getInitials(name = '') {
    return name ? name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '??'
  }

  return (
    <div className="view">

      {/* Trial banner */}
      {account?.subscriptionStatus === 'trialing' && (
        <div style={{ background: 'var(--warn-l)', border: '1px solid rgba(200,134,10,0.25)', borderRadius: 'var(--r)', padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: 13, color: 'var(--warn)' }}>
              Período de teste — <strong>{account.trialDaysRemaining} dias restantes</strong>. Escolha um plano para continuar após o trial.
            </span>
          </div>
          <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => setCurrentView('configuracoes')}>Ver planos</button>
        </div>
      )}

      {/* Banner análises restantes — só para plano consultorio */}
      {account?.plan === 'consultorio' && account?.subscriptionStatus === 'active' && (
        <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 'var(--r)', padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            <span style={{ fontSize: 13, color: 'var(--g700)' }}>
              Plano Consultório — <strong>{account.analysesRemaining} análise{account.analysesRemaining !== 1 ? 's' : ''} IA restante{account.analysesRemaining !== 1 ? 's' : ''}</strong> este mês.
              {account.analysesRemaining <= 1 && ' Faça upgrade para análises ilimitadas.'}
            </span>
          </div>
          {account.analysesRemaining <= 2 && (
            <button className="btn-primary" style={{ padding: '6px 14px', fontSize: 12, whiteSpace: 'nowrap' }} onClick={() => setCurrentView('configuracoes')}>
              Upgrade → Especialista
            </button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card" onClick={() => setCurrentView('pacientes')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div className="stat-val">{stats?.activePatients ?? '—'}</div>
          <div className="stat-label">Pacientes ativos</div>
          <div className="stat-delta">{stats?.activePatients > 0 ? 'Em acompanhamento' : 'Nenhum cadastrado'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </div>
          <div className="stat-val">{stats?.sessionsThisMonth ?? '—'}</div>
          <div className="stat-label">Sessões este mês</div>
          <div className="stat-delta">{stats?.sessionsThisMonth > 0 ? 'Registradas' : 'Nenhuma ainda'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon warn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div className="stat-val">{recentAlerts.filter(a => ['high','critical'].includes(a.level)).length}</div>
          <div className="stat-label">Alertas IA ativos</div>
          <div className="stat-delta" style={{ color: 'var(--warn)' }}>Observar</div>
        </div>
        <div className="stat-card" onClick={() => setCurrentView('insights')} style={{ cursor: 'pointer' }}>
          <div className="stat-icon green">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div className="stat-val">{stats ? Math.round(stats.analyzedPatients / Math.max(1, stats.activePatients) * 100) : '—'}%</div>
          <div className="stat-label">Cobertura IA</div>
          <div className="stat-delta">{stats?.analyzedPatients ?? 0} de {stats?.activePatients ?? 0} pacientes</div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Agenda hoje */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Agenda de Hoje</div>
              <div className="card-sub">{hoje}</div>
            </div>
            <span className="card-badge badge-green">{todaySessions.length} sessões</span>
          </div>
          <div className="card-body">
            {todaySessions.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gr4)', fontSize: 13 }}>Nenhuma sessão agendada para hoje</div>
            )}
            {todaySessions.map((s, i) => {
              const pc = s.patientId ? getAvatarStyle(s.patientId) : null
              const initials = s.patientInitials || getInitials(s.patientName) || (s.title || '').slice(0, 2)
              const isSoon = (() => {
                const d = new Date(s.startAt)
                const diff = (d - Date.now()) / 60000
                return diff > 0 && diff < 30
              })()
              return (
                <div
                  key={i}
                  className="session-item"
                  style={{ cursor: s.patientId ? 'pointer' : 'default' }}
                  onClick={s.patientId ? () => setCurrentView('paciente', { id: s.patientId, name: s.patientName, initials }) : undefined}
                >
                  <span className={`urgency ${isSoon ? 'red' : s.type === 'session' ? 'green' : 'yellow'}`} />
                  <div className="sess-av" style={pc ? { background: pc.bg, color: pc.color } : { background: 'var(--g50)', color: 'var(--g600)' }}>
                    {initials}
                  </div>
                  <div className="sess-info">
                    <div className="sess-name">{s.patientName || s.title}</div>
                    <div className="sess-meta">
                      {s.type === 'session' ? 'Sessão clínica' : s.title}
                      {s.meetLink && <> · <span style={{ color: 'var(--g500)' }}>📹 Video</span></>}
                      {isSoon && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--warn)', fontWeight: 600 }}>EM BREVE</span>}
                    </div>
                  </div>
                  <div className="sess-right">
                    <div className="sess-time">{fmt(s.startAt)}</div>
                    {s.endAt && <div style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 2 }}>até {fmt(s.endAt)}</div>}
                  </div>
                </div>
              )
            })}
            <button
              className="btn-outline"
              style={{ width: '100%', marginTop: 12, justifyContent: 'center', display: 'flex' }}
              onClick={() => setCurrentView('agenda')}
            >
              Ver agenda completa →
            </button>
          </div>
        </div>

        {/* Alertas IA */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Alertas da IA</div>
              <div className="card-sub">Apenas pacientes com análise IA gerada</div>
            </div>
            <span className="card-badge badge-warn">{recentAlerts.length} ativos</span>
          </div>
          <div className="card-body">
            {recentAlerts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gr4)', fontSize: 13 }}>Nenhum alerta ativo</div>
            )}
            {recentAlerts.map((alert, i) => {
              const isHigh = ['high', 'critical'].includes(alert.level)
              return (
                <div key={i} className="alert-item" onClick={() => setCurrentView('paciente', { id: alert.patientId, name: alert.patientName })}>
                  <div className="alert-icon" style={{ background: isHigh ? 'var(--danger-l)' : 'var(--warn-l)' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={isHigh ? '#B03A2E' : 'var(--warn)'} strokeWidth="2">
                      {isHigh
                        ? <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>
                        : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
                      }
                    </svg>
                  </div>
                  <div className="alert-body">
                    <div className="alert-title">{alert.patientName}</div>
                    <div className="alert-desc">{alert.description}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <span className={`card-badge ${isHigh ? 'badge-danger' : 'badge-warn'}`}>
                        {alert.level === 'critical' ? 'Atenção' : isHigh ? 'Observar' : 'Monitorar'}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--gr4)' }}>{fmtDate(alert.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <button className="btn-outline" style={{ width: '100%', marginTop: 12, justifyContent: 'center', display: 'flex' }} onClick={() => setCurrentView('insights')}>
              Ver insights completos →
            </button>
          </div>
        </div>
      </div>

      {/* Financial + AI coverage row */}
      <div className="dash-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Financeiro — Este mês</div>
              <div className="card-sub">Resumo de recebimentos e pendências</div>
            </div>
            <button className="btn-outline" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setCurrentView('financeiro')}>
              Ver tudo
            </button>
          </div>
          <div className="card-body">
            <div className="dash-fin-snap" style={{ marginBottom: 0 }}>
              {[
                { label: 'Recebido', value: fmtCurrency(financialSnapshot?.receivedThisMonth), color: 'var(--g600)', bg: 'var(--g50)' },
                { label: 'Pendente', value: fmtCurrency(financialSnapshot?.pendingReceivables), color: 'var(--warn)', bg: 'var(--warn-l)' },
                { label: 'Inadimplentes', value: financialSnapshot?.overdueCount ?? 0, color: 'var(--danger)', bg: 'var(--danger-l)' },
              ].map((item, i) => (
                <div key={i} style={{ background: item.bg, borderRadius: 'var(--r)', padding: '14px 16px', textAlign: 'center' }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: item.color, lineHeight: 1 }}>{item.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--gr5)', marginTop: 5 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Cobertura IA</div>
              <div className="card-sub">Pacientes com raciocínio clínico gerado</div>
            </div>
            <button className="btn-outline" style={{ padding: '5px 12px', fontSize: 12 }} onClick={() => setCurrentView('insights')}>
              Insights
            </button>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {/* Circle */}
              <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--gr2)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--g500)" strokeWidth="3"
                    strokeDasharray={`${((stats?.analyzedPatients ?? 0) / (stats?.activePatients || 1)) * 97.4} 97.4`}
                    strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Fraunces', serif", fontSize: 14, color: 'var(--d)' }}>
                  {stats ? Math.round(stats.analyzedPatients / (stats.activePatients || 1) * 100) : 0}%
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--d)' }}>
                  {stats?.analyzedPatients ?? 0} de {stats?.activePatients ?? 0}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gr5)', marginTop: 3 }}>pacientes analisados pela IA</div>
                <div style={{ fontSize: 11, color: 'var(--warn)', marginTop: 5 }}>
                  {stats ? stats.activePatients - stats.analyzedPatients : 0} ainda sem análise
                </div>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', display: 'flex' }}
              onClick={() => setCurrentView('cadernos')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Anotar e gerar análise
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
