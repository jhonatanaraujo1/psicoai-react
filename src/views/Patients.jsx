import { useState, useEffect, useRef } from 'react'
import { api } from '../services'
import { CustomSelect } from '../components/DateTimePickers'

const STATUS_COLORS = {
  red:    { bg: 'var(--danger-l)', color: 'var(--danger)',  dot: '#E74C3C' },
  yellow: { bg: 'var(--warn-l)',   color: 'var(--warn)',    dot: '#F39C12' },
  green:  { bg: 'var(--g50)',      color: 'var(--g600)',    dot: '#27AE60' },
  gray:   { bg: 'var(--gr1)',      color: 'var(--gr5)',     dot: '#C0C0C0' },
}

function PatientCard({ p, onClick }) {
  const sc = STATUS_COLORS[p.status] || STATUS_COLORS.gray
  return (
    <div
      className="card pac-card"
      onClick={onClick}
      style={{ cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--sh2)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
    >
      <div className="card-body" style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '16px' }}>
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div className="sess-av" style={{ width: '46px', height: '46px', fontSize: '15px', fontWeight: 600, background: p.avatarBg, color: p.avatarColor }}>
            {p.initials}
          </div>
          <div style={{ position: 'absolute', bottom: 0, right: -1, width: '10px', height: '10px', borderRadius: '50%', background: sc.dot, border: '2px solid var(--w)', boxSizing: 'content-box' }} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--d)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.name}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--gr5)', marginBottom: '8px', lineHeight: 1.4 }}>
            {p.age ? `${p.age} anos · ` : ''}{p.approach || 'Abordagem não definida'}
            {p.cid ? ` · ${p.cid}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px', background: sc.bg, color: sc.color }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: sc.dot, display: 'inline-block', flexShrink: 0 }} />
              {p.statusLabel}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--gr4)' }}>
              {p.sessions ?? 0} {(p.sessions ?? 0) !== 1 ? 'anotações' : 'anotação'}{p.months != null ? ` · ${p.months}m` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'var(--gr2)', flexShrink: 0 }} className="skel-pulse" />
        <div style={{ flex: 1 }}>
          <div style={{ height: '15px', width: '60%', borderRadius: '4px', background: 'var(--gr2)', marginBottom: '8px' }} className="skel-pulse" />
          <div style={{ height: '12px', width: '80%', borderRadius: '4px', background: 'var(--gr2)', marginBottom: '12px' }} className="skel-pulse" />
          <div style={{ height: '22px', width: '40%', borderRadius: '20px', background: 'var(--gr2)' }} className="skel-pulse" />
        </div>
      </div>
    </div>
  )
}

// Calcula % de crescimento: mês atual vs média dos 2 meses anteriores
function calcGrowth(all) {
  const now   = new Date()
  const thisM = now.getMonth(); const thisY = now.getFullYear()
  const prev1 = thisM === 0  ? { m: 11, y: thisY - 1 } : { m: thisM - 1, y: thisY }
  const prev2 = prev1.m === 0 ? { m: 11, y: prev1.y - 1 } : { m: prev1.m - 1, y: prev1.y }

  const countMonth = (m, y) => all.filter(p => {
    if (!p.createdAt) return false
    const d = new Date(p.createdAt)
    return d.getMonth() === m && d.getFullYear() === y
  }).length

  const current   = countMonth(thisM, thisY)
  const avgPrev   = (countMonth(prev1.m, prev1.y) + countMonth(prev2.m, prev2.y)) / 2
  if (avgPrev === 0) return current > 0 ? 100 : 0
  return Math.round(((current - avgPrev) / avgPrev) * 100)
}

export default function Patients({ setCurrentView, onNovoCadastro }) {
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  // 'active' | 'inactive' | 'all' — padrão: só ativos
  const [activeTab, setActiveTab] = useState('active')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const csvInputRef = useRef(null)

  // Stats dashboard — calculado a partir de TODOS os pacientes (sem filtro)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.getPatients({ size: 1000 }).then(res => {
      const all = res.content || []
      const activeCount    = all.filter(p => p.active !== false).length
      const inactiveCount  = all.filter(p => p.active === false).length
      const recurringCount = all.filter(p => p.recurringDayOfWeek).length
      const growth         = calcGrowth(all)
      setStats({ total: all.length, activeCount, inactiveCount, recurringCount, growth })
    }).catch(() => {})
  }, [])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 280)
    return () => clearTimeout(t)
  }, [search])

  const activeParam = activeTab === 'active' ? true : activeTab === 'inactive' ? false : undefined

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getPatients({ search: debouncedSearch, status: statusFilter, active: activeParam })
      .then(res => {
        setPatients(res.content)
        setTotal(res.totalElements)
      })
      .catch(e => setError(e.message || 'Erro ao carregar pacientes'))
      .finally(() => setLoading(false))
  }, [debouncedSearch, statusFilter, activeTab])

  async function handleCsvImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.importPatients(file)
      setImportResult(result)
      const res = await api.getPatients({ search: debouncedSearch, status: statusFilter, active: activeParam })
      setPatients(res.content)
      setTotal(res.totalElements)
    } catch (err) {
      setImportResult({ imported: 0, skipped: 0, errors: [err.message || 'Erro ao importar'] })
    } finally {
      setImporting(false)
    }
  }

  const statusOptions = [
    { value: '', label: 'Todos os status' },
    { value: 'red', label: 'Alerta' },
    { value: 'yellow', label: 'Monitorar' },
    { value: 'green', label: 'Evolução positiva' },
    { value: 'gray', label: 'Início' },
  ]

  if (error) return (
    <div className="view" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16, textAlign: 'center' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.4" style={{ opacity: 0.7 }}>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div style={{ fontSize: 14, color: 'var(--d)', fontWeight: 500 }}>Não foi possível carregar os pacientes</div>
      <div style={{ fontSize: 12, color: 'var(--gr5)' }}>{error}</div>
      <button className="btn-primary" onClick={() => { setError(null); setLoading(true) }}>Tentar novamente</button>
    </div>
  )

  return (
    <div className="view">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 400, color: 'var(--d)' }}>Pacientes</div>
          <div style={{ fontSize: '13px', color: 'var(--gr5)', marginTop: '4px' }}>
            {loading ? '…' : `${total} paciente${total !== 1 ? 's' : ''} em acompanhamento`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input ref={csvInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCsvImport} />
          <button
            className="btn-outline"
            onClick={() => csvInputRef.current?.click()}
            disabled={importing}
            title="Importar pacientes via planilha CSV"
          >
            {importing
              ? <span style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid var(--gr4)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            }
            {importing ? 'Importando…' : 'Importar CSV'}
          </button>
          <button className="btn-primary" onClick={onNovoCadastro}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Paciente
          </button>
        </div>
      </div>

      {/* ── Dashboard de métricas ──────────────────────────────────────────── */}
      {stats && (
        <div className="pac-stats-grid">

          {/* Ativos */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gr4)', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 2 }}>Ativos</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--g700)', fontFamily: "'Fraunces', serif", lineHeight: 1 }}>{stats.activeCount}</div>
            <div style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>
              {stats.total > 0 ? Math.round((stats.activeCount / stats.total) * 100) : 0}% do total
            </div>
            {/* Barra ativa/inativa */}
            <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--gr1)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stats.total > 0 ? (stats.activeCount / stats.total) * 100 : 0}%`, background: 'var(--g500)', borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* Inativos */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gr4)', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 2 }}>Inativos</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stats.inactiveCount > 0 ? 'var(--warn)' : 'var(--gr3)', fontFamily: "'Fraunces', serif", lineHeight: 1 }}>{stats.inactiveCount}</div>
            <div style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>
              {stats.total > 0 ? Math.round((stats.inactiveCount / stats.total) * 100) : 0}% do total
            </div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--gr1)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stats.total > 0 ? (stats.inactiveCount / stats.total) * 100 : 0}%`, background: 'var(--warn)', borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* Recorrentes */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gr4)', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 2 }}>Recorrentes</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--d)', fontFamily: "'Fraunces', serif", lineHeight: 1 }}>{stats.recurringCount}</span>
              <span style={{ fontSize: 13, color: 'var(--gr4)' }}>/ {stats.activeCount} ativos</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>
              {stats.activeCount > 0 ? Math.round((stats.recurringCount / stats.activeCount) * 100) : 0}% com horário fixo
            </div>
            {/* Barra recorrente/não-recorrente */}
            <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--gr1)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stats.activeCount > 0 ? (stats.recurringCount / stats.activeCount) * 100 : 0}%`, background: '#7D3C98', borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* Captação — novos pacientes este mês vs média dos 2 anteriores */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gr4)', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 2 }}>Captação</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Fraunces', serif", lineHeight: 1, color: stats.growth > 0 ? 'var(--g600)' : stats.growth < 0 ? 'var(--danger)' : 'var(--gr4)' }}>
                {stats.growth > 0 ? '+' : ''}{stats.growth}%
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={stats.growth > 0 ? 'var(--g500)' : stats.growth < 0 ? 'var(--danger)' : 'var(--gr3)'} strokeWidth="2.5">
                {stats.growth >= 0
                  ? <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>
                  : <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>}
              </svg>
            </div>
            <div style={{ fontSize: 11, color: 'var(--gr4)', marginTop: 4 }}>novos pacientes vs. média dos 2 meses anteriores</div>
            <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: 'var(--gr1)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(Math.abs(stats.growth), 100)}%`, background: stats.growth >= 0 ? 'var(--g500)' : 'var(--danger)', borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
          </div>

        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div style={{ background: importResult.errors?.length ? 'var(--warn-l)' : 'var(--g50)', border: `1px solid ${importResult.errors?.length ? 'var(--warn)' : 'var(--g200)'}`, borderRadius: 'var(--r)', padding: '10px 16px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={importResult.errors?.length ? 'var(--warn)' : 'var(--g600)'} strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
            {importResult.errors?.length
              ? <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>
              : <><polyline points="20 6 9 17 4 12"/></>}
          </svg>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>
              {importResult.imported} paciente{importResult.imported !== 1 ? 's' : ''} importado{importResult.imported !== 1 ? 's' : ''}
              {importResult.skipped > 0 && ` · ${importResult.skipped} ignorado${importResult.skipped !== 1 ? 's' : ''}`}
            </div>
            {importResult.errors?.length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--warn)', marginTop: 4 }}>
                {importResult.errors.slice(0, 3).map((e, i) => <div key={i}>{e}</div>)}
                {importResult.errors.length > 3 && <div>+{importResult.errors.length - 3} outros erros</div>}
              </div>
            )}
          </div>
          <button onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>
      )}

      {/* Tabs Ativos / Inativos / Todos */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: 'var(--gr1)', borderRadius: 'var(--r)', padding: '4px', width: 'fit-content' }}>
        {[
          { id: 'active',   label: 'Ativos' },
          { id: 'inactive', label: 'Inativos' },
          { id: 'all',      label: 'Todos' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
              background: activeTab === tab.id ? 'var(--w)' : 'transparent',
              color: activeTab === tab.id ? 'var(--g700)' : 'var(--gr4)',
              boxShadow: activeTab === tab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="pac-filter-bar" style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            style={{ width: '100%', paddingLeft: '36px', paddingRight: '12px', height: '38px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '13px', background: 'var(--w)', color: 'var(--d)', outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }}
            placeholder="Buscar por nome ou CID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={{ flexShrink: 0, minWidth: 160 }}>
          <CustomSelect
            value={statusFilter}
            onChange={v => setStatusFilter(v)}
            options={statusOptions}
            placeholder="Todos"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="pac-grid">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : patients.map(p => (
              <PatientCard
                key={p.id}
                p={p}
                onClick={() => setCurrentView('paciente', p)}
              />
            ))
        }

        {/* Add card */}
        {!loading && (
          <div
            className="card"
            onClick={onNovoCadastro}
            style={{ border: '2px dashed var(--gr2)', boxShadow: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'transparent', transition: 'border-color 0.15s', minHeight: '100px' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--g300)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--gr2)'}
          >
            <div style={{ textAlign: 'center', color: 'var(--gr4)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ margin: '0 auto 8px', display: 'block' }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <div style={{ fontSize: '13px' }}>Adicionar paciente</div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && patients.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="1.2" style={{ margin: '0 auto 12px', display: 'block' }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <div style={{ fontSize: '14px', color: 'var(--gr5)', marginBottom: '4px' }}>Nenhum paciente encontrado</div>
            <div style={{ fontSize: '12px', color: 'var(--gr3)' }}>Tente ajustar os filtros ou cadastre um novo paciente</div>
          </div>
        )}
      </div>
    </div>
  )
}
