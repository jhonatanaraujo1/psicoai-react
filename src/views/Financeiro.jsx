import { useState, useEffect } from 'react'
import { api } from '../services'
import { DatePicker } from '../components/DateTimePickers'

function fmtBRL(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_STYLE = {
  received: { bg: 'var(--g50)',      color: 'var(--g600)',   dot: '#27AE60', label: 'Recebido' },
  pending:  { bg: 'var(--warn-l)',   color: 'var(--warn)',   dot: '#F39C12', label: 'Pendente' },
  overdue:  { bg: 'var(--danger-l)', color: 'var(--danger)', dot: '#E74C3C', label: 'Atrasado' },
}

const METHOD_LABELS = {
  pix:       'PIX',
  transfer:  'Transferência',
  insurance: 'Convênio',
  corporate: 'Plano empresarial',
}

const MONTHS_PT_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function buildBarData() {
  const now = new Date()
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = MONTHS_PT_SHORT[d.getMonth()] + (i === 0 ? ' ●' : '')
    months.push({ label, val: 0, h: '0%', current: i === 0, _month: d.getMonth(), _year: d.getFullYear() })
  }
  return months
}

const CURRENT_MONTH_LABEL = MONTHS_PT_SHORT[new Date().getMonth()].charAt(0).toUpperCase() + MONTHS_PT_SHORT[new Date().getMonth()].slice(1) + ' ' + new Date().getFullYear()

function Skeleton({ style }) {
  return <div className="skel-pulse" style={{ borderRadius: '6px', background: 'var(--gr2)', ...style }} />
}

const LANC_FORM_DEFAULT = { patientId: '', patientName: '', description: '', amount: '', direction: 'credit', status: 'pending', dueDate: '', paymentMethod: 'pix' }

export default function Financeiro() {
  const [events, setEvents] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reciboOpen, setReciboOpen] = useState(false)
  const [barData, setBarData] = useState(buildBarData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [lancModal, setLancModal] = useState({ open: false, mode: 'create', data: null })
  const [lancForm, setLancForm] = useState(LANC_FORM_DEFAULT)
  const [allPatients, setAllPatients] = useState([])
  const [lancSaving, setLancSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.getFinancialEvents(),
      api.getFinancialSummary(),
    ]).then(([ev, sum]) => {
      const evList = ev.content || []
      setEvents(evList)
      setSummary(sum)
      // Atualiza barData com dados reais agrupados por mês
      setBarData(prev => {
        const updated = prev.map(b => {
          const monthRevenue = evList
            .filter(e => {
              if (e.direction !== 'credit' || e.status !== 'received') return false
              const d = new Date(e.dueDate || e.paidAt || e.createdAt)
              return d.getMonth() === b._month && d.getFullYear() === b._year
            })
            .reduce((acc, e) => acc + (e.amount || 0), 0)
          return { ...b, val: monthRevenue }
        })
        const maxVal = Math.max(...updated.map(b => b.val), 1)
        return updated.map(b => ({ ...b, h: `${Math.max(4, Math.round((b.val / maxVal) * 100))}%` }))
      })
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!lancModal.open) return
    api.getPatients({ size: 100 }).then(res => setAllPatients(res.content || []))
  }, [lancModal.open])

  function openCreate() {
    setLancForm(LANC_FORM_DEFAULT)
    setLancModal({ open: true, mode: 'create', data: null })
  }

  function openEdit(row) {
    setLancForm({
      patientId: row.patientId || '',
      patientName: row.patientName || '',
      description: row.description || '',
      amount: row.amount != null ? String(row.amount) : '',
      direction: row.direction || 'credit',
      status: row.status || 'pending',
      dueDate: row.dueDate ? row.dueDate.slice(0, 10) : '',
      paymentMethod: row.paymentMethod || 'pix',
    })
    setLancModal({ open: true, mode: 'edit', data: row })
  }

  function closeLanc() {
    setLancModal({ open: false, mode: 'create', data: null })
  }

  function reloadEvents() {
    return api.getFinancialEvents().then(res => setEvents(res.content || []))
  }

  async function saveLanc() {
    setLancSaving(true)
    try {
      const payload = {
        ...lancForm,
        amount: parseFloat(lancForm.amount) || 0,
      }
      if (lancModal.mode === 'create') {
        await api.createFinancialEvent(payload)
      } else {
        await api.updateFinancialEvent(lancModal.data.id, payload)
      }
      await reloadEvents()
      closeLanc()
    } finally {
      setLancSaving(false)
    }
  }

  async function deleteLanc() {
    if (!window.confirm('Excluir este lançamento?')) return
    setLancSaving(true)
    try {
      await api.deleteFinancialEvent(lancModal.data.id)
      await reloadEvents()
      closeLanc()
    } finally {
      setLancSaving(false)
    }
  }

  const filtered = events.filter(e => {
    const matchSearch = !search || (e.patientName || '').toLowerCase().includes(search.toLowerCase()) || (e.description || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || e.status === statusFilter
    return matchSearch && matchStatus
  })

  const received = summary?.receivedThisMonth || 0
  const pending  = summary?.pendingReceivables || 0
  const overdueN = summary?.overdueCount || 0

  return (
    <div className="view">
      {/* Stats — SEC-010: ícones como JSX direto, sem dangerouslySetInnerHTML */}
      <div className="stats-row">
        {[
          { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>, cls: 'green', val: loading ? '…' : fmtBRL(received), label: `Receita — ${CURRENT_MONTH_LABEL}`, delta: '' },
          { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>, cls: 'green', val: loading ? '…' : events.filter(e => e.status === 'received' && e.direction === 'credit').length, label: 'Pagamentos recebidos', delta: `de ${events.filter(e => e.direction === 'credit').length} lançamentos`, deltaColor: 'var(--gr4)' },
          { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/></svg>, cls: overdueN > 0 ? 'warn' : 'green', val: loading ? '…' : fmtBRL(pending), label: `Em aberto (${overdueN} atrasado${overdueN !== 1 ? 's' : ''})`, delta: overdueN > 0 ? 'Enviar cobrança' : 'Sem atrasos', deltaColor: overdueN > 0 ? 'var(--warn)' : 'var(--g600)' },
          { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, cls: 'blue', val: loading ? '…' : (() => { const creditReceived = events.filter(e => e.direction === 'credit' && e.status === 'received' && e.amount > 0); return creditReceived.length > 0 ? fmtBRL(creditReceived.reduce((a, e) => a + e.amount, 0) / creditReceived.length) : '—' })(), label: 'Ticket médio', delta: 'por sessão recebida' },
        ].map(({ icon, cls, val, label, delta, deltaColor }, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-icon ${cls}`}>{icon}</div>
            <div className="stat-val">{val}</div>
            <div className="stat-label">{label}</div>
            <div className="stat-delta" style={deltaColor ? { color: deltaColor } : {}}>{delta}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="fin-top-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Receita mensal</div>
              <div className="card-sub">Últimos 6 meses</div>
            </div>
            <span className="card-badge badge-green">↑ Crescimento</span>
          </div>
          <div className="card-body">
            <div className="chart-bar-manual">
              {barData.map(({ label, val, h, current }) => (
                <div key={label} className="chart-bar-col">
                  <div className="chart-bar-val" style={current ? { color: 'var(--g500)', fontWeight: 600 } : {}}>{fmtBRL(val)}</div>
                  <div className="chart-bar-fill" style={{ height: h, ...(current ? { background: 'linear-gradient(180deg, var(--g400), var(--g600))' } : {}) }} />
                  <div className="chart-bar-label" style={current ? { color: 'var(--g500)', fontWeight: 600 } : {}}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Resumo de {CURRENT_MONTH_LABEL}</div></div>
          <div className="card-body" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 44 }} />)
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--g50)', borderRadius: 'var(--r)', border: '1px solid var(--g100)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--g700)', fontWeight: 500 }}>Receita realizada</span>
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: '20px', color: 'var(--g600)' }}>{fmtBRL(received)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--ow)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--gr5)' }}>Em aberto / pendente</span>
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: '17px', color: 'var(--warn)' }}>{fmtBRL(pending)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--ow)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--gr5)' }}>Atrasados</span>
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: '17px', color: overdueN > 0 ? 'var(--danger)' : 'var(--gr4)' }}>
                      {overdueN > 0 ? `${overdueN} lançamento${overdueN !== 1 ? 's' : ''}` : 'Nenhum'}
                    </span>
                  </div>
                  <div style={{ height: '1px', background: 'var(--gr2)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>Total previsto</span>
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: '20px', color: 'var(--d)' }}>{fmtBRL(received + pending)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Lançamentos</div>
            <div className="card-sub">{CURRENT_MONTH_LABEL} · {filtered.length} registros</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" style={{ fontSize: '12px', padding: '8px 14px' }} onClick={openCreate}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Novo Lançamento
            </button>
            <button className="btn-outline" style={{ fontSize: '12px', padding: '8px 14px' }} onClick={() => setReciboOpen(true)}>
              Emitir recibo
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="fin-filter-bar" style={{ padding: '12px 16px 0' }}>
            <input className="fin-search" placeholder="Buscar paciente ou descrição…" value={search} onChange={e => setSearch(e.target.value)} />
            <select className="fin-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="received">Recebido</option>
              <option value="pending">Pendente</option>
              <option value="overdue">Atrasado</option>
            </select>
            <div className="fin-summary-chip">
              {loading ? '…' : `${events.filter(e => e.status === 'received').length} recebidos · ${fmtBRL(received)}`}
            </div>
          </div>
          <div style={{ overflowX: 'auto', padding: '12px 0 0' }}>
            {loading ? (
              <div style={{ padding: '0 16px 16px' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '12px' }}>
                    <Skeleton style={{ width: 100, height: 13 }} />
                    <Skeleton style={{ width: 80, height: 13 }} />
                    <Skeleton style={{ flex: 1, height: 13 }} />
                    <Skeleton style={{ width: 60, height: 13 }} />
                    <Skeleton style={{ width: 80, height: 22, borderRadius: 20 }} />
                  </div>
                ))}
              </div>
            ) : (
              <table className="fin-table">
                <thead>
                  <tr>
                    <th>Paciente / Descrição</th>
                    <th>Tipo</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Pagamento</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => {
                    const ss = STATUS_STYLE[row.status] || STATUS_STYLE.pending
                    const isExpense = row.direction === 'debit'
                    return (
                      <tr key={row.id} style={{ cursor: 'pointer' }} onClick={() => openEdit(row)}>
                        <td>
                          <div style={{ fontWeight: 500, color: 'var(--d)' }}>{row.patientName || 'Despesa'}</div>
                          {row.description && <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '1px' }}>{row.description}</div>}
                        </td>
                        <td>
                          {isExpense
                            ? <span style={{ fontSize: '11px', background: 'var(--danger-l)', color: 'var(--danger)', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>Despesa</span>
                            : <span style={{ fontSize: '11px', background: 'var(--g50)', color: 'var(--g600)', padding: '2px 7px', borderRadius: '10px', fontWeight: 600 }}>Receita</span>
                          }
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--gr5)' }}>{fmtDate(row.dueDate)}</td>
                        <td style={{ fontFamily: "'Fraunces', serif", fontSize: '14px', color: row.amount === 0 ? 'var(--gr4)' : isExpense ? 'var(--danger)' : 'var(--d)' }}>
                          {row.amount === 0 ? 'Convênio' : (isExpense ? '- ' : '') + fmtBRL(row.amount)}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--gr5)' }}>
                          {row.paymentMethod ? METHOD_LABELS[row.paymentMethod] || row.paymentMethod : '—'}
                        </td>
                        <td>
                          <span className={`pay-badge ${row.status}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px', background: ss.bg, color: ss.color }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: ss.dot }} />
                            {ss.label}
                          </span>
                        </td>
                        <td>
                          <button
                            className="fin-action"
                            style={row.status === 'pending' ? { color: 'var(--warn)', borderColor: '#F0D08A' } : row.status === 'overdue' ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : {}}
                            onClick={async e => {
                              e.stopPropagation()
                              if (row.status !== 'received') {
                                // Optimistic update
                                const updated = events.map(ev => ev.id === row.id ? { ...ev, status: 'received', paidAt: new Date().toISOString() } : ev)
                                setEvents(updated)
                                // Persist to backend
                                try {
                                  await api.updateFinancialEvent(row.id, { status: 'received', paidAt: new Date().toISOString() })
                                } catch {
                                  // Revert on error
                                  setEvents(events)
                                }
                              }
                            }}
                          >
                            {row.status === 'received' ? 'Recibo' : 'Marcar pago'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Lançamento modal */}
      {lancModal.open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', touchAction: 'none', overscrollBehavior: 'none' }}
          onClick={e => e.target === e.currentTarget && closeLanc()}
        >
          <div style={{ background: 'var(--w)', borderRadius: 'var(--r3)', width: '100%', maxWidth: '520px', maxHeight: 'min(90dvh,90svh,90vh)', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', fontFamily: "'DM Sans', sans-serif" }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--gr2)' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 400, color: 'var(--d)' }}>
                {lancModal.mode === 'create' ? 'Novo Lançamento' : 'Editar Lançamento'}
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--gr5)', lineHeight: 1 }} onClick={closeLanc}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(() => {
                const inSt = { border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '8px 10px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", color: 'var(--d)', background: 'var(--ow)', width: '100%', boxSizing: 'border-box', outline: 'none' }
                const lbSt = { fontSize: '11px', fontWeight: 600, color: 'var(--g500)', letterSpacing: '0.06em', marginBottom: '4px', display: 'block' }
                return (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={lbSt}>TIPO</label>
                        <select style={inSt} value={lancForm.direction} onChange={e => setLancForm(f => ({ ...f, direction: e.target.value }))}>
                          <option value="credit">Receita</option>
                          <option value="debit">Despesa</option>
                        </select>
                      </div>
                      <div>
                        <label style={lbSt}>STATUS</label>
                        <select style={inSt} value={lancForm.status} onChange={e => setLancForm(f => ({ ...f, status: e.target.value }))}>
                          <option value="pending">Pendente</option>
                          <option value="received">Recebido</option>
                          <option value="overdue">Atrasado</option>
                        </select>
                      </div>
                    </div>

                    {lancForm.direction === 'credit' && (
                      <div>
                        <label style={lbSt}>PACIENTE</label>
                        <select
                          style={inSt}
                          value={lancForm.patientId}
                          onChange={e => {
                            const pt = allPatients.find(p => String(p.id) === e.target.value)
                            setLancForm(f => ({ ...f, patientId: e.target.value, patientName: pt ? pt.name : '' }))
                          }}
                        >
                          <option value="">Selecionar paciente…</option>
                          {allPatients.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={lbSt}>DESCRIÇÃO</label>
                      <input style={inSt} type="text" placeholder="Ex: Consulta individual, Sessão de terapia…" value={lancForm.description} onChange={e => setLancForm(f => ({ ...f, description: e.target.value }))} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={lbSt}>VALOR R$</label>
                        <input style={inSt} type="number" min="0" step="0.01" placeholder="0,00" value={lancForm.amount} onChange={e => setLancForm(f => ({ ...f, amount: e.target.value }))} />
                      </div>
                      <div>
                        <label style={lbSt}>VENCIMENTO</label>
                        <DatePicker value={lancForm.dueDate} onChange={v => setLancForm(f => ({ ...f, dueDate: v }))} style={inSt} />
                      </div>
                    </div>

                    <div>
                      <label style={lbSt}>FORMA DE PAGAMENTO</label>
                      <select style={inSt} value={lancForm.paymentMethod} onChange={e => setLancForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                        <option value="pix">PIX</option>
                        <option value="transfer">Transferência</option>
                        <option value="insurance">Convênio</option>
                        <option value="corporate">Plano empresarial</option>
                      </select>
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px 20px', borderTop: '1px solid var(--gr2)' }}>
              <div>
                {lancModal.mode === 'edit' && (
                  <button
                    style={{ background: 'var(--danger-l)', color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--r)', padding: '8px 14px', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', fontWeight: 600 }}
                    onClick={deleteLanc}
                    disabled={lancSaving}
                  >
                    Excluir
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-outline" style={{ fontSize: '12px', padding: '8px 14px' }} onClick={closeLanc} disabled={lancSaving}>
                  Cancelar
                </button>
                <button className="btn-primary" style={{ fontSize: '12px', padding: '8px 18px', justifyContent: 'center' }} onClick={saveLanc} disabled={lancSaving}>
                  {lancSaving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recibo modal */}
      <div className={`recibo-modal${reciboOpen ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && setReciboOpen(false)}>
        <div className="recibo-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 400, color: 'var(--d)' }}>Emitir recibo</div>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--gr5)' }} onClick={() => setReciboOpen(false)}>×</button>
          </div>
          <div className="form-field">
            <label>PACIENTE</label>
            <select>{events.filter(e => e.patientName).map(e => <option key={e.id}>{e.patientName} — {e.description}</option>)}</select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-field"><label>DATA DA SESSÃO</label><DatePicker value={new Date().toISOString().slice(0, 10)} onChange={() => {}} /></div>
            <div className="form-field"><label>VALOR</label><input type="text" defaultValue="R$ 200,00" /></div>
          </div>
          <div className="form-field"><label>DESCRIÇÃO</label><input type="text" defaultValue="Consulta de Psicologia — sessão individual" /></div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button className="btn-outline" style={{ flex: 1 }} onClick={() => setReciboOpen(false)}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', opacity: 0.6, cursor: 'not-allowed' }} disabled title="Em breve">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Em breve
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
