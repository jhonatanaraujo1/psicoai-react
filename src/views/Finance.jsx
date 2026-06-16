import { useState, useEffect } from 'react'
import { api } from '../services'
import { DatePicker, CustomSelect } from '../components/DateTimePickers'
import { showToast } from '../components/Toast'

function fmtBRL(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0)
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_STYLE = {
  received:  { bg: 'var(--g50)',      color: 'var(--g600)',   dot: '#27AE60', label: 'Recebido' },
  pending:   { bg: 'var(--warn-l)',   color: 'var(--warn)',   dot: '#F39C12', label: 'Pendente' },
  overdue:   { bg: 'var(--danger-l)', color: 'var(--danger)', dot: '#E74C3C', label: 'Atrasado' },
  cancelled: { bg: 'var(--gr1)',      color: 'var(--gr4)',    dot: '#aaa',    label: 'Cancelado' },
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

const LANC_FORM_DEFAULT = { patientId: '', patientName: '', description: '', amount: '', direction: 'credit', status: 'pending', dueDate: '', paymentMethod: 'pix', rescheduledDueDate: '' }

// ── ReciboModal ──────────────────────────────────────────────────────────────
function ReciboModal({ events, form, setForm, onClose }) {
  const receivedEvents = events.filter(e => e.status === 'received' && e.direction === 'credit' && e.patientName)

  const selectedEvent = receivedEvents.find(e => String(e.id) === form.eventId)

  const reciboNum = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2,'0')}${String(Math.floor(Math.random() * 900) + 100)}`

  function handlePrint() {
    if (!selectedEvent && !form.eventId) {
      alert('Selecione um lançamento para emitir o recibo.')
      return
    }
    const evt = selectedEvent
    const patientName = evt?.patientName || '—'
    const amount = form.customAmount
      ? parseFloat(form.customAmount.replace(',', '.'))
      : evt?.amount || 0
    const amountFmt = fmtBRL(amount)
    const sessionDate = form.sessionDate
      ? new Date(form.sessionDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : '—'
    const desc = form.serviceDesc || 'Consulta de Psicologia'
    const method = evt?.paymentMethod ? METHOD_LABELS[evt.paymentMethod] || evt.paymentMethod : 'PIX'
    const psicoName = form.psicoName || 'Psicólogo(a)'
    const crp = form.crp ? `CRP: ${form.crp}` : ''

    const w = window.open('', '_blank', 'width=700,height=900')
    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Recibo — ${patientName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Georgia', serif; background: #fff; color: #1a1a1a; padding: 60px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 48px; padding-bottom: 24px; border-bottom: 2px solid #2D4A38; }
  .brand { font-size: 22px; color: #2D4A38; letter-spacing: -0.5px; }
  .brand-sub { font-size: 12px; color: #666; font-family: 'Arial', sans-serif; margin-top: 4px; }
  .recibo-num { text-align: right; font-family: 'Arial', sans-serif; }
  .recibo-num .label { font-size: 10px; color: #999; letter-spacing: 1px; text-transform: uppercase; }
  .recibo-num .num { font-size: 20px; color: #2D4A38; font-weight: 700; }
  h1 { font-size: 32px; font-weight: 400; color: #1a1a1a; margin-bottom: 6px; }
  .amount-block { background: #F4F7F5; border-left: 4px solid #2D4A38; padding: 20px 28px; margin: 32px 0; border-radius: 0 8px 8px 0; }
  .amount-label { font-size: 11px; font-family: 'Arial', sans-serif; letter-spacing: 1px; text-transform: uppercase; color: #666; margin-bottom: 6px; }
  .amount-val { font-size: 36px; color: #2D4A38; }
  .details { margin: 32px 0; }
  .row { display: flex; padding: 12px 0; border-bottom: 1px solid #f0f0f0; font-family: 'Arial', sans-serif; }
  .row .key { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; width: 160px; flex-shrink: 0; }
  .row .val { font-size: 13px; color: #1a1a1a; font-weight: 500; }
  .sig-block { margin-top: 64px; display: flex; justify-content: center; }
  .sig-inner { text-align: center; border-top: 1px solid #1a1a1a; padding-top: 12px; min-width: 240px; }
  .sig-name { font-size: 14px; font-weight: 600; }
  .sig-sub { font-size: 12px; color: #666; font-family: 'Arial', sans-serif; margin-top: 3px; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #aaa; font-family: 'Arial', sans-serif; text-align: center; }
  @media print { body { padding: 40px; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="brand">Ψ PsicoNotes</div>
    <div class="brand-sub">Gestão clínica inteligente</div>
  </div>
  <div class="recibo-num">
    <div class="label">Recibo nº</div>
    <div class="num">${reciboNum}</div>
  </div>
</div>
<h1>Recibo de Pagamento</h1>
<div class="amount-block">
  <div class="amount-label">Valor recebido</div>
  <div class="amount-val">${amountFmt}</div>
</div>
<div class="details">
  <div class="row"><span class="key">Paciente</span><span class="val">${patientName}</span></div>
  <div class="row"><span class="key">Serviço</span><span class="val">${desc}</span></div>
  <div class="row"><span class="key">Data da sessão</span><span class="val">${sessionDate}</span></div>
  <div class="row"><span class="key">Forma de pagamento</span><span class="val">${method}</span></div>
  <div class="row"><span class="key">Profissional</span><span class="val">${psicoName}${crp ? ' · ' + crp : ''}</span></div>
  <div class="row"><span class="key">Data de emissão</span><span class="val">${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
</div>
<div class="sig-block">
  <div class="sig-inner">
    <div class="sig-name">${psicoName}</div>
    <div class="sig-sub">${crp || 'Psicólogo(a)'}</div>
  </div>
</div>
<div class="footer">
  Este recibo foi gerado pelo sistema PsicoNotes e comprova o pagamento descrito acima.<br>
  Documento válido sem assinatura eletrônica — sujeito a declaração do profissional.
</div>
<script>window.onload = () => { window.print(); }<\/script>
</body></html>`)
    w.document.close()
  }

  const inputSt = { border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--ow)', width: '100%', boxSizing: 'border-box', color: 'var(--d)' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--ow)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 400, color: 'var(--d)' }}>Emitir recibo</div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--gr4)', lineHeight: 1 }} onClick={onClose}>×</button>
        </div>

        {/* Lançamento */}
        <div className="form-field" style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', display: 'block', marginBottom: '6px' }}>LANÇAMENTO (pagamento recebido)</label>
          <select value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} style={inputSt}>
            <option value="">Selecione um lançamento…</option>
            {receivedEvents.map(e => (
              <option key={e.id} value={String(e.id)}>
                {e.patientName} — {e.description} ({fmtBRL(e.amount)})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', display: 'block', marginBottom: '6px' }}>DATA DA SESSÃO</label>
            <input type="date" value={form.sessionDate} onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))} style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', display: 'block', marginBottom: '6px' }}>VALOR (deixe em branco para usar o lançamento)</label>
            <input type="text" placeholder={selectedEvent ? fmtBRL(selectedEvent.amount) : 'R$ 0,00'} value={form.customAmount} onChange={e => setForm(f => ({ ...f, customAmount: e.target.value }))} style={inputSt} />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', display: 'block', marginBottom: '6px' }}>DESCRIÇÃO DO SERVIÇO</label>
          <input type="text" value={form.serviceDesc} onChange={e => setForm(f => ({ ...f, serviceDesc: e.target.value }))} style={inputSt} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', display: 'block', marginBottom: '6px' }}>SEU NOME</label>
            <input type="text" placeholder="Dra. Exemplo" value={form.psicoName} onChange={e => setForm(f => ({ ...f, psicoName: e.target.value }))} style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', display: 'block', marginBottom: '6px' }}>CRP</label>
            <input type="text" placeholder="06/123456" value={form.crp} onChange={e => setForm(f => ({ ...f, crp: e.target.value }))} style={inputSt} />
          </div>
        </div>

        {/* Preview */}
        {selectedEvent && (
          <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', fontSize: '13px', color: 'var(--g700)' }}>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>Pré-visualização do recibo</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '12px', color: 'var(--gr5)' }}>
              <span>Paciente: <strong style={{ color: 'var(--d)' }}>{selectedEvent.patientName}</strong></span>
              <span>Valor: <strong style={{ color: 'var(--g600)' }}>{form.customAmount ? fmtBRL(parseFloat(form.customAmount.replace(',','.')) || 0) : fmtBRL(selectedEvent.amount)}</strong></span>
              <span>Método: <strong style={{ color: 'var(--d)' }}>{METHOD_LABELS[selectedEvent.paymentMethod] || 'PIX'}</strong></span>
              <span>Nº: <strong style={{ color: 'var(--d)' }}>{reciboNum}</strong></span>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-outline" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={handlePrint}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Imprimir / Salvar PDF
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Finance() {
  const [events, setEvents] = useState([])
  const [summary, setSummary] = useState(null)
  const [recurring, setRecurring] = useState([])
  const [loading, setLoading] = useState(true)
  const [reciboOpen, setReciboOpen] = useState(false)
  const [reciboForm, setReciboForm] = useState({ eventId: '', psicoName: '', crp: '', sessionDate: new Date().toISOString().slice(0, 10), serviceDesc: 'Consulta de Psicologia — sessão individual', customAmount: '' })
  const [barData, setBarData] = useState(buildBarData)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [lancModal, setLancModal] = useState({ open: false, mode: 'create', data: null })
  const [lancForm, setLancForm] = useState(LANC_FORM_DEFAULT)
  const [allPatients, setAllPatients] = useState([])
  const [lancSaving, setLancSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [markingPaid, setMarkingPaid] = useState(new Set())

  useEffect(() => {
    setLoading(true)
    Promise.allSettled([
      api.getFinancialEvents(),
      api.getFinancialSummary(),
      api.getRecurringSummary(),
    ]).then(([evResult, sumResult, recResult]) => {
      const evList = evResult.status === 'fulfilled' ? (evResult.value.content || []) : []
      const sum    = sumResult.status === 'fulfilled' ? sumResult.value : null
      setEvents(evList)
      setSummary(sum)
      setRecurring(recResult.status === 'fulfilled' ? (recResult.value || []) : [])
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
      rescheduledDueDate: row.rescheduledDueDate ? row.rescheduledDueDate.slice(0, 10) : '',
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
        delete payload.rescheduledDueDate // não aplica em criação
        await api.createFinancialEvent(payload)
      } else {
        // Envia rescheduledDueDate se preenchido, ou clearRescheduledDueDate se foi apagado
        const original = lancModal.data
        const newReschedule = lancForm.rescheduledDueDate || ''
        const oldReschedule = original?.rescheduledDueDate ? original.rescheduledDueDate.slice(0, 10) : ''
        const updatePayload = {
          status: payload.status,
          paymentMethod: payload.paymentMethod,
        }
        if (newReschedule && newReschedule !== oldReschedule) {
          updatePayload.rescheduledDueDate = newReschedule
        } else if (!newReschedule && oldReschedule) {
          updatePayload.clearRescheduledDueDate = true
        }
        await api.updateFinancialEvent(original.id, updatePayload)
      }
      await reloadEvents()
      closeLanc()
    } catch (e) {
      showToast('Erro ao salvar lançamento. Tente novamente.', 'error')
    } finally {
      setLancSaving(false)
    }
  }

  function deleteLanc() {
    setDeleteConfirm(lancModal.data)
  }

  async function executarDelete(lancamento) {
    setLancSaving(true)
    const removedId = lancamento.id
    closeLanc()
    setEvents(prev => prev.filter(e => e.id !== removedId))
    try {
      await api.deleteFinancialEvent(removedId)
    } catch (e) {
      showToast('Erro ao excluir lançamento. Tente novamente.', 'error')
      await reloadEvents()
    } finally {
      setLancSaving(false)
    }
  }

  const filtered = events.filter(e => {
    if (e.status === 'cancelled') return false
    const matchSearch = !search || (e.patientName || '').toLowerCase().includes(search.toLowerCase()) || (e.description || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || e.status === statusFilter
    return matchSearch && matchStatus
  })

  // Receita: para eventos recebidos, usa paidAt (data real do pagamento).
  // Fallback para dueDate/createdAt só se paidAt ausente (lançamentos legados pré-paidAt).
  const now = new Date()
  const received = events
    .filter(e => {
      if (e.direction !== 'credit' || e.status !== 'received') return false
      // Prioriza paidAt — data real em que o dinheiro entrou
      const ref = new Date(e.paidAt || e.dueDate || e.createdAt)
      return ref.getMonth() === now.getMonth() && ref.getFullYear() === now.getFullYear()
    })
    .reduce((acc, e) => acc + (e.amount || 0), 0)

  // Pendente e atrasado calculados localmente tb — não depende do summary backend
  const pending = events
    .filter(e => e.direction === 'credit' && (e.status === 'pending' || e.status === 'overdue'))
    .reduce((acc, e) => acc + (e.amount || 0), 0)
  const overdueN = events.filter(e => e.direction === 'credit' && e.status === 'overdue').length

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

      {/* Recorrentes */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recorrentes — {CURRENT_MONTH_LABEL}</div>
            <div className="card-sub">
              {loading ? '…' : (() => {
                const paid = recurring.filter(r => r.status === 'received').length
                const total = recurring.length
                const totalVal = recurring.reduce((s, r) => s + (r.billingValue || 0), 0)
                return total > 0 ? `${paid}/${total} pagos · ${fmtBRL(totalVal)} esperados` : 'Nenhum paciente recorrente configurado'
              })()}
            </div>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1,2,3].map(i => <Skeleton key={i} style={{ height: 52 }} />)}
            </div>
          ) : recurring.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '32px 24px',
              color: 'var(--gr5, #888)',
              fontSize: 14,
              border: '1px dashed var(--gr2, #e5e7eb)',
              borderRadius: 10,
              margin: '12px 16px 16px',
            }}>
              <p style={{ margin: '0 0 6px', fontWeight: 500 }}>Nenhuma cobrança recorrente configurada</p>
              <p style={{ margin: 0, fontSize: 13 }}>Adicione pacientes com frequência fixa (mensal, semanal etc.) para acompanhar quem pagou e quem está pendente.</p>
            </div>
          ) : (
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Ciclo</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {recurring.map(r => {
                    const CYCLE_LABEL = { weekly: 'Semanal', biweekly: 'Quinzenal', monthly: 'Mensal', quarterly: 'Trimestral', annual: 'Anual' }
                    const ss = r.status === 'received'
                      ? STATUS_STYLE.received
                      : r.status === 'overdue'
                      ? STATUS_STYLE.overdue
                      : STATUS_STYLE.pending
                    const statusLabel = r.status === 'no_event' ? 'Pendente' : ss.label
                    const statusBg    = r.status === 'no_event' ? STATUS_STYLE.pending.bg    : ss.bg
                    const statusColor = r.status === 'no_event' ? STATUS_STYLE.pending.color : ss.color
                    const statusDot   = r.status === 'no_event' ? STATUS_STYLE.pending.dot   : ss.dot

                    return (
                      <tr key={r.patientId}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: '50%', background: r.avatarBg || 'var(--g50)', color: r.avatarColor || 'var(--g600)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {r.initials || r.patientName?.slice(0,2).toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 500, color: 'var(--d)', fontSize: 13 }}>{r.patientName}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--gr5)' }}>{CYCLE_LABEL[r.billingType] || r.billingType}</td>
                        <td style={{ fontSize: 12, color: 'var(--gr5)' }}>{r.dueDate ? fmtDate(r.dueDate) : '—'}</td>
                        <td style={{ fontFamily: "'Fraunces', serif", fontSize: 14, color: 'var(--d)' }}>{fmtBRL(r.billingValue)}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: statusBg, color: statusColor }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: statusDot }} />
                            {statusLabel}
                          </span>
                        </td>
                        <td>
                          {r.status !== 'received' && (
                            <button
                              className="fin-action"
                              style={{
                                color: markingPaid.has(r.patientId) ? 'var(--gr4)' : 'var(--warn)',
                                borderColor: markingPaid.has(r.patientId) ? 'var(--gr2)' : '#F0D08A',
                                opacity: markingPaid.has(r.patientId) ? 0.6 : 1,
                                cursor: markingPaid.has(r.patientId) ? 'not-allowed' : 'pointer',
                              }}
                              disabled={markingPaid.has(r.patientId)}
                              onClick={async () => {
                                if (markingPaid.has(r.patientId)) return
                                setMarkingPaid(prev => new Set(prev).add(r.patientId))
                                const now = new Date().toISOString()
                                try {
                                  if (r.eventId) {
                                    await api.updateFinancialEvent(r.eventId, { status: 'received', paidAt: now })
                                  } else {
                                    await api.createFinancialEvent({
                                      patientId: r.patientId,
                                      type: 'session_payment',
                                      description: `${CYCLE_LABEL[r.billingType] || 'Cobrança'} — ${r.patientName}`,
                                      amount: r.billingValue,
                                      direction: 'credit',
                                      status: 'received',
                                      dueDate: r.dueDate,
                                      paidAt: now,
                                    })
                                  }
                                  const [evRes, recRes, sumRes] = await Promise.all([
                                    api.getFinancialEvents(),
                                    api.getRecurringSummary(),
                                    api.getFinancialSummary(),
                                  ])
                                  setEvents(evRes.content || [])
                                  setRecurring(recRes || [])
                                  setSummary(sumRes)
                                } catch {
                                  showToast('Erro ao registrar pagamento.', 'error')
                                } finally {
                                  setMarkingPaid(prev => { const s = new Set(prev); s.delete(r.patientId); return s })
                                }
                              }}
                            >
                              {markingPaid.has(r.patientId) ? 'Salvando…' : 'Marcar pago'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
          )}
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
            <CustomSelect
              value={statusFilter}
              onChange={v => setStatusFilter(v)}
              options={[
                { label: 'Todos os status', value: '' },
                { label: 'Recebido', value: 'received' },
                { label: 'Pendente', value: 'pending' },
                { label: 'Atrasado', value: 'overdue' },
              ]}
              style={{ minWidth: 160 }}
            />
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
                        <td style={{ fontSize: '12px', color: 'var(--gr5)' }}>
                          {row.rescheduledDueDate ? (
                            <div>
                              <div style={{ color: 'var(--g600)', fontWeight: 600 }}>{fmtDate(row.rescheduledDueDate)}</div>
                              <div style={{ textDecoration: 'line-through', fontSize: '10px', color: 'var(--gr4)', marginTop: '1px' }}>{fmtDate(row.dueDate)}</div>
                              {row.rescheduledCount > 0 && (
                                <div style={{ fontSize: '9px', color: 'var(--warn)', fontWeight: 700, marginTop: '1px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                                  {row.rescheduledCount}× renegociado
                                </div>
                              )}
                            </div>
                          ) : fmtDate(row.dueDate)}
                        </td>
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
                                setEvents(prev => prev.map(ev => ev.id === row.id ? { ...ev, status: 'received', paidAt: new Date().toISOString() } : ev))
                                try {
                                  await api.updateFinancialEvent(row.id, { status: 'received', paidAt: new Date().toISOString() })
                                } catch {
                                  showToast('Erro ao marcar pagamento. Recarregando…', 'error')
                                  await reloadEvents()
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
                        <CustomSelect value={lancForm.direction} onChange={v => setLancForm(f => ({ ...f, direction: v }))} options={[{ label: 'Receita', value: 'credit' }, { label: 'Despesa', value: 'debit' }]} />
                      </div>
                      <div>
                        <label style={lbSt}>STATUS</label>
                        <CustomSelect value={lancForm.status} onChange={v => setLancForm(f => ({ ...f, status: v }))} options={[{ label: 'Pendente', value: 'pending' }, { label: 'Recebido', value: 'received' }, { label: 'Atrasado', value: 'overdue' }]} />
                      </div>
                    </div>

                    {lancForm.direction === 'credit' && (
                      <div>
                        <label style={lbSt}>PACIENTE</label>
                        <CustomSelect
                          value={lancForm.patientId}
                          onChange={v => {
                            const pt = allPatients.find(p => String(p.id) === v)
                            setLancForm(f => ({ ...f, patientId: v, patientName: pt ? pt.name : '' }))
                          }}
                          options={[{ label: 'Selecionar paciente…', value: '' }, ...allPatients.map(p => ({ label: p.name, value: String(p.id) }))]}
                          placeholder="Selecionar paciente…"
                        />
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
                      <CustomSelect value={lancForm.paymentMethod} onChange={v => setLancForm(f => ({ ...f, paymentMethod: v }))} options={[{ label: 'PIX', value: 'pix' }, { label: 'Transferência', value: 'transfer' }, { label: 'Convênio', value: 'insurance' }, { label: 'Plano empresarial', value: 'corporate' }]} />
                    </div>

                    {lancModal.mode === 'edit' && (
                      <div>
                        <label style={lbSt}>DATA RENEGOCIADA (opcional)</label>
                        <DatePicker
                          value={lancForm.rescheduledDueDate}
                          onChange={v => setLancForm(f => ({ ...f, rescheduledDueDate: v }))}
                          style={inSt}
                        />
                        {lancModal.data?.rescheduledCount > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--warn)', marginTop: '4px' }}>
                            Renegociado {lancModal.data.rescheduledCount}× — vencimento atual: {fmtDate(lancModal.data.rescheduledDueDate)}
                          </div>
                        )}
                      </div>
                    )}
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

      {/* Modal de confirmação de exclusão — React state, sem innerHTML */}
      {deleteConfirm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}}
             onClick={() => setDeleteConfirm(null)}>
          <div style={{background:'var(--w,#fff)',borderRadius:12,padding:'28px 32px',maxWidth:400,width:'90%',boxShadow:'0 8px 40px rgba(0,0,0,0.18)',fontFamily:"'DM Sans',sans-serif"}}
               onClick={e => e.stopPropagation()}>
            <p style={{fontWeight:600,fontSize:16,color:'var(--d,#1a1a1a)',marginBottom:8}}>Excluir lançamento?</p>
            <p style={{color:'var(--gr5,#666)',fontSize:13,marginBottom:24}}>{deleteConfirm.description || 'Esta ação não pode ser desfeita.'}</p>
            <div style={{display:'flex',gap:12,justifyContent:'flex-end'}}>
              <button onClick={() => setDeleteConfirm(null)}
                      style={{padding:'8px 16px',borderRadius:8,border:'1px solid var(--gr2,#ddd)',background:'transparent',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif",color:'var(--d,#1a1a1a)'}}>
                Cancelar
              </button>
              <button onClick={() => { executarDelete(deleteConfirm); setDeleteConfirm(null); }}
                      style={{padding:'8px 16px',borderRadius:8,border:'none',background:'var(--danger,#B03A2E)',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:"'DM Sans',sans-serif"}}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recibo modal */}
      {reciboOpen && <ReciboModal
        events={events}
        form={reciboForm}
        setForm={setReciboForm}
        onClose={() => setReciboOpen(false)}
      />}
    </div>
  )
}
