import { useState, useEffect, useRef } from 'react'
import { api } from '../services'

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
              {p.sessions} sessões · {p.months}m
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

export default function Pacientes({ setCurrentView, onNovoCadastro }) {
  const [patients, setPatients] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const csvInputRef = useRef(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 280)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getPatients({ search: debouncedSearch, status: statusFilter })
      .then(res => {
        setPatients(res.content)
        setTotal(res.totalElements)
      })
      .catch(e => setError(e.message || 'Erro ao carregar pacientes'))
      .finally(() => setLoading(false))
  }, [debouncedSearch, statusFilter])

  async function handleCsvImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportResult(null)
    try {
      const result = await api.importPatients(file)
      setImportResult(result)
      // Refresh patient list
      const res = await api.getPatients({ search: debouncedSearch, status: statusFilter })
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

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            style={{ width: '100%', paddingLeft: '36px', paddingRight: '12px', height: '38px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '13px', background: 'var(--w)', color: 'var(--d)', outline: 'none', fontFamily: "'DM Sans', sans-serif", boxSizing: 'border-box' }}
            placeholder="Buscar por nome ou CID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          style={{ height: '38px', padding: '0 12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '13px', background: 'var(--w)', color: 'var(--d)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
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
