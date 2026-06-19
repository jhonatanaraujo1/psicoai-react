import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../services'
import { DatePicker, TimePicker, CustomSelect } from '../components/DateTimePickers'
import { showToast } from '../components/Toast'

const DAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX']
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTHS_PT_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function getMondayOf(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const TYPE_STYLES = {
  session:    { bg: 'var(--g50)',      border: 'var(--g300)', color: 'var(--g700)', cls: 'green' },
  supervision:{ bg: '#EBF3FD',         border: '#7FB3D3',     color: '#2471A3',     cls: 'blue' },
  personal:   { bg: 'var(--gr1)',      border: 'var(--gr3)',  color: 'var(--gr5)',  cls: 'gray' },
  other:      { bg: 'var(--warn-l)',   border: '#F0D08A',     color: 'var(--warn)', cls: 'warn' },
  google:     { bg: '#E8F0FE',         border: '#4285F4',     color: '#1A56C4',     cls: 'google' },
}

const TYPE_LABELS = {
  session: 'Sessão',
  supervision: 'Supervisão',
  personal: 'Pessoal',
  other: 'Outro',
  google: 'Google',
}

function fmtHour(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function fmtShortDate(d) {
  return `${d.getDate()} ${MONTHS_PT_SHORT[d.getMonth()]}`
}

const inSt = {
  border: '1px solid var(--gr2)',
  borderRadius: 'var(--r)',
  padding: '9px 12px',
  fontSize: '13px',
  color: 'var(--d)',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  background: 'var(--ow)',
  width: '100%',
  boxSizing: 'border-box',
}

const EMPTY_MODAL = { open: false, mode: 'create', data: null }


export default function Agenda({ currentUser }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [events, setEvents] = useState([])
  const [googleEvents, setGoogleEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [eventModal, setEventModal] = useState(EMPTY_MODAL)
  const [allPatients, setAllPatients] = useState([])
  const [saving, setSaving] = useState(false)
  const [agendaView, setAgendaView] = useState(() => window.innerWidth <= 640 ? 'list' : 'week')
  const [listSelectedDate, setListSelectedDate] = useState('')   // YYYY-MM-DD ou '' = todos futuros
  const [form, setForm] = useState({
    title: '', type: 'session', patientId: '', date: '', startTime: '', endTime: '', meetLink: '', description: ''
  })
  const [googleConnected, setGoogleConnected] = useState(false)
  const [generatingMeet, setGeneratingMeet] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const monday = getMondayOf(today)
  monday.setDate(monday.getDate() + weekOffset * 7)

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  const isToday = d => d.getTime() === today.getTime()

  function loadEvents() {
    const from = new Date(monday)
    from.setDate(from.getDate() - 60)
    const to = new Date(monday)
    to.setDate(to.getDate() + 90)
    return api.getAgendaEvents({ from: from.toISOString(), to: to.toISOString() })
      .then(setEvents)
  }

  useEffect(() => {
    loadEvents().finally(() => setLoading(false))
    // Load Google Calendar events if connected
    api.getGoogleStatus().then(s => {
      setGoogleConnected(s.connected)
      if (s.connected && s.calendarSync) {
        const from = new Date(); from.setDate(from.getDate() - 7)
        const to   = new Date(); to.setDate(to.getDate() + 60)
        api.getGoogleCalendarEvents(from.toISOString(), to.toISOString())
          .then(evs => setGoogleEvents(evs || []))
          .catch(() => {})
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load patients when modal opens
  useEffect(() => {
    if (eventModal.open) {
      api.getPatients({ size: 100 }).then(res => setAllPatients(res.content || []))
    }
  }, [eventModal.open])

  function openCreate(prefill = {}) {
    const d = new Date()
    const dateStr = d.toISOString().slice(0, 10)
    setForm({
      title: '', type: 'session', patientId: '',
      date: dateStr, startTime: '09:00', endTime: '10:00',
      meetLink: '', description: '',
      ...prefill,
    })
    setEventModal({ open: true, mode: 'create', data: null })
  }

  function openSlot(dayIdx, hour) {
    const slotDate = weekDates[dayIdx]
    const dateStr = slotDate.toISOString().slice(0, 10)
    const startTime = `${String(hour).padStart(2, '0')}:00`
    const endTime   = `${String(hour + 1).padStart(2, '0')}:00`
    openCreate({ date: dateStr, startTime, endTime })
  }

  function openEdit(evt) {
    const start = new Date(evt.startAt)
    const end = evt.endAt ? new Date(evt.endAt) : new Date(start.getTime() + 3600000)
    const dateStr = start.toISOString().slice(0, 10)
    const startTime = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`
    const endTime = `${end.getHours().toString().padStart(2, '0')}:${end.getMinutes().toString().padStart(2, '0')}`
    setForm({
      title: evt.title || '',
      type: evt.type || 'session',
      patientId: evt.patientId || '',
      date: dateStr,
      startTime,
      endTime,
      meetLink: evt.meetLink || '',
      description: evt.description || '',
    })
    setEventModal({ open: true, mode: 'edit', data: evt })
  }

  function closeModal() {
    setEventModal(EMPTY_MODAL)
  }

  function buildPayload() {
    const [h1, m1] = form.startTime.split(':').map(Number)
    const [h2, m2] = form.endTime.split(':').map(Number)
    const startAt = new Date(form.date); startAt.setHours(h1, m1, 0, 0)
    const endAt   = new Date(form.date); endAt.setHours(h2, m2, 0, 0)
    return {
      title: form.title,
      type: form.type,
      patientId: form.type === 'session' ? form.patientId || null : null,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      meetLink: form.meetLink || null,
      description: form.description || null,
    }
  }

  async function handleSave() {
    if (!form.title.trim() && form.type !== 'session') return
    // Validar que o horário de fim é após o de início
    const [h1, m1] = form.startTime.split(':').map(Number)
    const [h2, m2] = form.endTime.split(':').map(Number)
    if (h2 * 60 + m2 <= h1 * 60 + m1) {
      showToast('Horário de fim deve ser após o horário de início.', 'error')
      return
    }
    setSaving(true)
    try {
      const payload = buildPayload()
      if (eventModal.mode === 'create') {
        await api.createAgendaEvent(payload)
      } else {
        await api.updateAgendaEvent(eventModal.data.id, payload)
      }
      await loadEvents()
      closeModal()
    } catch (e) {
      showToast(e?.message || 'Erro ao salvar evento. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!eventModal.data) return
    setSaving(true)
    try {
      await api.deleteAgendaEvent(eventModal.data.id)
      await loadEvents()
      closeModal()
    } catch (e) {
      showToast(e?.message || 'Erro ao excluir evento. Tente novamente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Merge Psic Notes + Google events into unified list
  const allEvents = [
    ...events,
    ...googleEvents.map(g => ({
      id: g.id,
      title: g.summary,
      type: 'google',
      startAt: g.start,
      endAt: g.end,
      meetLink: g.meetLink,
      _google: true,
    })),
  ]

  // Match event to day+hour slot
  function getEventsForSlot(dayIdx, hour) {
    const slotDate = weekDates[dayIdx]
    return allEvents.filter(e => {
      const d = new Date(e.startAt)
      return (
        d.getFullYear() === slotDate.getFullYear() &&
        d.getMonth() === slotDate.getMonth() &&
        d.getDate() === slotDate.getDate() &&
        d.getHours() === hour
      )
    })
  }

  // Upcoming sessions — next 7 days sorted
  const upcoming = allEvents
    .filter(e => new Date(e.startAt) >= today)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
    .slice(0, 6)

  const weekRange = `${weekDates[0].getDate()} a ${weekDates[4].getDate()} de ${MONTHS_PT[weekDates[0].getMonth()]}`
  const weekEnd = new Date(weekDates[4]); weekEnd.setHours(23, 59, 59, 999)
  const sessionsThisWeek = events.filter(e => {
    const d = new Date(e.startAt)
    return d >= weekDates[0] && d <= weekEnd && e.type === 'session'
  }).length

  // List view: filtrado por data selecionada (ou últimos 7 dias + futuros)
  const listEvents = allEvents
    .filter(e => {
      const d = new Date(e.startAt)
      if (listSelectedDate) {
        // Data específica selecionada — mostra APENAS eventos desse dia
        return d.toISOString().slice(0, 10) === listSelectedDate
      }
      return d >= new Date(today.getTime() - 86400000 * 7)
    })
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))

  // Group by date string
  const listGrouped = listEvents.reduce((acc, evt) => {
    const d = new Date(evt.startAt)
    const key = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
    if (!acc[key]) acc[key] = []
    acc[key].push(evt)
    return acc
  }, {})

  return (
    <div className="view">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 300, color: 'var(--d)' }}>
            {agendaView === 'week' ? `Semana de ${weekRange}` : 'Agenda'}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--gr5)', marginTop: '3px' }}>
            {loading ? '…' : `${sessionsThisWeek} ${sessionsThisWeek !== 1 ? 'sessões' : 'sessão'} agendada${sessionsThisWeek !== 1 ? 's' : ''} esta semana`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{
            display: 'flex', borderRadius: 10,
            border: '1px solid var(--gr2)',
            overflow: 'hidden',
            background: 'var(--w)',
          }}>
            {[
              { key: 'week', label: 'Grade', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg> },
              { key: 'list', label: 'Lista', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg> },
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setAgendaView(v.key)}
                title={v.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px',
                  border: 'none',
                  background: agendaView === v.key ? 'var(--g50)' : 'transparent',
                  color: agendaView === v.key ? 'var(--g600)' : 'var(--gr4)',
                  fontSize: 12, fontWeight: agendaView === v.key ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.15s',
                }}
              >
                {v.icon}
                <span className="agenda-view-label">{v.label}</span>
              </button>
            ))}
          </div>

          {agendaView === 'week' && <>
            <button className="btn-outline" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => setWeekOffset(w => w - 1)}>‹ Anterior</button>
            <button className="btn-outline" style={{ padding: '8px 14px', fontSize: '12px', borderColor: 'var(--g300)', color: 'var(--g600)' }} onClick={() => setWeekOffset(0)}>Hoje</button>
            <button className="btn-outline" style={{ padding: '8px 14px', fontSize: '12px' }} onClick={() => setWeekOffset(w => w + 1)}>Próxima ›</button>
          </>}
          {agendaView === 'list' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={listSelectedDate}
                onChange={e => setListSelectedDate(e.target.value)}
                title="Filtrar por data"
                style={{
                  border: `1px solid ${listSelectedDate ? 'var(--g300)' : 'var(--gr2)'}`,
                  borderRadius: 'var(--r)', padding: '7px 10px',
                  fontSize: '12px', color: listSelectedDate ? 'var(--g700)' : 'var(--d)',
                  fontFamily: "'DM Sans', sans-serif",
                  background: listSelectedDate ? 'var(--g50)' : 'var(--w)',
                  outline: 'none', cursor: 'pointer',
                }}
              />
              {listSelectedDate ? (
                <button
                  className="btn-outline"
                  style={{ padding: '7px 12px', fontSize: '12px', borderColor: 'var(--g300)', color: 'var(--g600)' }}
                  onClick={() => setListSelectedDate('')}
                  title="Ver todos os eventos futuros"
                >
                  Todos
                </button>
              ) : (
                <button
                  className="btn-outline"
                  style={{ padding: '7px 12px', fontSize: '12px', borderColor: 'var(--g300)', color: 'var(--g600)' }}
                  onClick={() => setListSelectedDate(today.toISOString().slice(0, 10))}
                  title="Ver apenas eventos de hoje"
                >
                  Hoje
                </button>
              )}
            </div>
          )}
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => openCreate()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Evento
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ──────────────────────────────────────────── */}
      {agendaView === 'list' && (() => {
        const todayStr = today.toDateString()
        const dateFilterLabel = listSelectedDate
          ? new Date(listSelectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
          : null
        const upcomingSessions = listEvents.filter(e => e.type === 'session').length
        const upcomingMinutes = listEvents
          .filter(e => e.startAt && e.endAt)
          .reduce((sum, e) => sum + Math.round((new Date(e.endAt) - new Date(e.startAt)) / 60000), 0)
        const upcomingHours = (upcomingMinutes / 60).toFixed(1).replace('.0', '')

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* ── Summary bar ─────────────────────────────────── */}
            {!loading && Object.keys(listGrouped).length > 0 && (
              <div style={{
                display: 'flex', gap: 20, marginBottom: 20,
                padding: '14px 18px', background: 'var(--g50)',
                border: '1px solid var(--g100)', borderRadius: 'var(--r2)',
                flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--g600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                    {dateFilterLabel ? dateFilterLabel : 'Próximos eventos'}
                  </div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: 'var(--g700)', fontWeight: 400, lineHeight: 1 }}>{listEvents.length}</div>
                </div>
                {upcomingSessions > 0 && (
                  <div style={{ borderLeft: '1px solid var(--g200)', paddingLeft: 20 }}>
                    <div style={{ fontSize: 11, color: 'var(--g600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Sessões clínicas</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: 'var(--g700)', fontWeight: 400, lineHeight: 1 }}>{upcomingSessions}</div>
                  </div>
                )}
                {upcomingMinutes > 0 && (
                  <div style={{ borderLeft: '1px solid var(--g200)', paddingLeft: 20 }}>
                    <div style={{ fontSize: 11, color: 'var(--g600)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Horas agendadas</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: 'var(--g700)', fontWeight: 400, lineHeight: 1 }}>{upcomingHours}h</div>
                  </div>
                )}
              </div>
            )}

            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--gr1)', alignItems: 'center' }}>
                    <div className="skel-pulse" style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skel-pulse" style={{ height: 13, width: '60%', borderRadius: 4, marginBottom: 6 }} />
                      <div className="skel-pulse" style={{ height: 10, width: '40%', borderRadius: 4 }} />
                    </div>
                    <div className="skel-pulse" style={{ width: 80, height: 30, borderRadius: 8 }} />
                  </div>
                ))
              : Object.keys(listGrouped).length === 0
                ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.3" style={{ display: 'block', margin: '0 auto 16px' }}>
                      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--d)', marginBottom: 6 }}>
                      {listSelectedDate ? 'Nenhum evento neste dia' : 'Nenhum evento agendado'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--gr4)', marginBottom: 18 }}>
                      {listSelectedDate
                        ? `Sem eventos em ${new Date(listSelectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}.`
                        : 'Crie seu primeiro evento para começar a organizar a semana clínica.'}
                    </div>
                    {listSelectedDate
                      ? <button className="btn-outline" style={{ fontSize: '13px', marginBottom: '8px' }} onClick={() => setListSelectedDate('')}>Ver todos os eventos</button>
                      : null}
                    <button className="btn-primary" style={{ fontSize: '13px' }} onClick={() => openCreate({ date: listSelectedDate || undefined })}>
                      + Novo evento
                    </button>
                  </div>
                )
                : Object.entries(listGrouped).map(([dateLabel, evts]) => {
                    const isToday_ = evts.some(e => new Date(e.startAt).toDateString() === todayStr)
                    return (
                      <div key={dateLabel}>
                        {/* Date heading */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '16px 0 8px',
                          borderBottom: '1px solid var(--gr2)',
                        }}>
                          <div style={{
                            fontSize: 11, fontWeight: 700, color: isToday_ ? 'var(--g600)' : 'var(--gr4)',
                            letterSpacing: '0.6px', textTransform: 'uppercase', flex: 1,
                          }}>
                            {dateLabel}
                          </div>
                          {isToday_ && (
                            <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--g600)', color: '#fff', padding: '2px 8px', borderRadius: 20, letterSpacing: '0.4px' }}>
                              HOJE
                            </span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--gr4)' }}>{evts.length} evento{evts.length !== 1 ? 's' : ''}</span>
                        </div>

                        {evts.map(evt => {
                          const ts = TYPE_STYLES[evt.type] || TYPE_STYLES.session
                          const isEvtToday = new Date(evt.startAt).toDateString() === todayStr
                          const isSession = evt.type === 'session'

                          // Duration in minutes
                          const durationMin = evt.startAt && evt.endAt
                            ? Math.round((new Date(evt.endAt) - new Date(evt.startAt)) / 60000)
                            : null

                          return (
                            <div
                              key={evt.id}
                              onClick={() => openEdit(evt)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 14,
                                padding: '14px 6px',
                                borderBottom: '1px solid var(--gr1)',
                                cursor: 'pointer',
                                transition: 'background 0.13s',
                                borderRadius: 8,
                                margin: '2px 0',
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--gr1)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                              {/* Time block */}
                              <div style={{ width: 52, textAlign: 'center', flexShrink: 0 }}>
                                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--d)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                                  {fmtHour(evt.startAt)}
                                </div>
                                {evt.endAt && (
                                  <div style={{ fontSize: 10, color: 'var(--gr4)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
                                    até {fmtHour(evt.endAt)}
                                  </div>
                                )}
                              </div>

                              {/* Color bar */}
                              <div style={{ width: 3, height: 42, borderRadius: 2, background: ts.border, flexShrink: 0 }} />

                              {/* Main info */}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--d)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                                  {evt.patientName || evt.title}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                                    background: ts.bg, color: ts.color,
                                  }}>
                                    {TYPE_LABELS[evt.type] || evt.type}
                                  </span>
                                  {durationMin && (
                                    <span style={{ fontSize: 11, color: 'var(--gr4)' }}>
                                      {durationMin} min
                                    </span>
                                  )}
                                  {evt.meetLink && (
                                    <span style={{ fontSize: 11, color: '#2980B9', display: 'flex', alignItems: 'center', gap: 3 }}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                                      Remota
                                    </span>
                                  )}
                                  {evt.description && (
                                    <span style={{ fontSize: 11, color: 'var(--gr4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                      {evt.description}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Right: action or arrow */}
                              {isEvtToday && isSession ? (
                                <button
                                  onClick={e => { e.stopPropagation(); openEdit(evt) }}
                                  style={{
                                    flexShrink: 0, padding: '7px 13px',
                                    background: 'var(--g600)', color: '#fff',
                                    border: 'none', borderRadius: 'var(--r)',
                                    fontSize: 12, fontWeight: 600,
                                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Ver sessão
                                </button>
                              ) : (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="2" style={{ flexShrink: 0 }}>
                                  <polyline points="9 18 15 12 9 6"/>
                                </svg>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })
            }
          </div>
        )
      })()}

      {agendaView === 'week' && (

      <div className="agenda-layout">
        {/* Week grid */}
        <div className="agenda-week">
          <div className="agenda-week-header">
            <div className="agenda-time-col" style={{ padding: '12px 0' }} />
            {weekDates.map((d, i) => (
              <div key={i} className={`agenda-day-label${isToday(d) ? ' today' : ''}`}>
                <span className={`agenda-day-date${isToday(d) ? ' today-num' : ''}`}>{d.getDate()}</span>
                {DAYS[i]}
              </div>
            ))}
          </div>

          <div className="agenda-grid">
            {HOURS.map(hour => (
              <>
                <div key={`time-${hour}`} className="agenda-time-slot">
                  <div className="agenda-time-label">{hour}:00</div>
                </div>
                {weekDates.map((_, dayIdx) => {
                  const slotEvts = loading ? [] : getEventsForSlot(dayIdx, hour)
                  const ts = slotEvts[0] ? TYPE_STYLES[slotEvts[0].type] || TYPE_STYLES.session : null
                  const isEmpty = slotEvts.length === 0
                  return (
                    <div
                      key={`slot-${hour}-${dayIdx}`}
                      className={`agenda-slot${isEmpty ? ' agenda-slot-empty' : ''}`}
                      onClick={() => isEmpty && openSlot(dayIdx, hour)}
                      title={isEmpty ? `Novo evento ${String(hour).padStart(2,'0')}:00` : undefined}
                    >
                      {isEmpty && (
                        <div className="agenda-slot-plus">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                          </svg>
                        </div>
                      )}
                      {slotEvts.map(evt => (
                        <div
                          key={evt.id}
                          className={`agenda-event ${ts?.cls || 'green'}`}
                          style={{ background: ts?.bg, borderColor: ts?.border, color: ts?.color, cursor: 'pointer' }}
                          title={`${evt.title} · ${fmtHour(evt.startAt)} – ${fmtHour(evt.endAt)}`}
                          onClick={e => { e.stopPropagation(); openEdit(evt) }}
                        >
                          <div className="agenda-event-name">{evt.patientName || evt.title}</div>
                          <div className="agenda-event-meta">
                            {fmtHour(evt.startAt)}
                            {evt.meetLink && (
                              <span style={{ marginLeft: '4px', fontSize: '10px' }}>
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle' }}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div>
          {/* Upcoming */}
          <div className="agenda-upcoming">
            <div className="card-header" style={{ padding: '16px 16px 14px' }}>
              <div className="card-title">Próximas sessões</div>
            </div>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="upcoming-item" style={{ opacity: 0.5 }}>
                    <div className="upcoming-date-box" style={{ background: 'var(--gr2)' }}>
                      <div className="upcoming-day" style={{ color: 'var(--gr4)' }}>—</div>
                      <div className="upcoming-mon" style={{ color: 'var(--gr3)' }}>…</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: '13px', width: '70%', background: 'var(--gr2)', borderRadius: '4px', marginBottom: '6px' }} className="skel-pulse" />
                      <div style={{ height: '11px', width: '50%', background: 'var(--gr2)', borderRadius: '4px' }} className="skel-pulse" />
                    </div>
                  </div>
                ))
              : upcoming.length === 0
                ? <div style={{ fontSize: '13px', color: 'var(--gr4)', textAlign: 'center', padding: '20px 0' }}>Nenhuma sessão agendada</div>
                : upcoming.map((evt, i) => {
                    const d = new Date(evt.startAt)
                    const ts = TYPE_STYLES[evt.type] || TYPE_STYLES.session
                    const isSession = evt.type === 'session'
                    return (
                      <div key={i} className="upcoming-item" style={{ cursor: 'pointer' }} onClick={() => openEdit(evt)}>
                        <div className="upcoming-date-box">
                          <div className="upcoming-day">{d.getDate()}</div>
                          <div className="upcoming-mon">{MONTHS_PT_SHORT[d.getMonth()].toUpperCase()}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--d)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {evt.patientName || evt.title}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--gr5)', marginTop: '2px' }}>
                            {fmtHour(evt.startAt)}
                            {evt.meetLink && ' · 📹 Video'}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px', background: ts.bg, color: ts.color, flexShrink: 0, whiteSpace: 'nowrap', border: `1px solid ${ts.border}` }}>
                          {isSession ? 'Sessão' : evt.type === 'supervision' ? 'Supervisão' : 'Outro'}
                        </span>
                      </div>
                    )
                  })
            }
          </div>
        </div>
      </div>
      )} {/* end agendaView === 'week' */}

      {/* Event modal */}
      {eventModal.open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 250, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', touchAction: 'none', overscrollBehavior: 'none' }}
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div style={{ background: 'var(--w)', borderRadius: 'var(--r3)', width: '100%', maxWidth: '520px', maxHeight: 'min(90dvh,90svh,90vh)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid var(--gr2)' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 400, color: 'var(--d)' }}>
                {eventModal.mode === 'create' ? 'Novo Evento' : 'Editar Evento'}
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--gr5)', lineHeight: 1 }} onClick={closeModal}>×</button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Título */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>TÍTULO *</label>
                <input
                  style={inSt}
                  placeholder="Título do evento"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              {/* Tipo */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>TIPO</label>
                <CustomSelect
                  value={form.type}
                  onChange={v => setForm(f => ({ ...f, type: v, patientId: '' }))}
                  options={[
                    { value: 'session',    label: 'Sessão' },
                    { value: 'supervision',label: 'Supervisão' },
                    { value: 'personal',   label: 'Pessoal' },
                    { value: 'other',      label: 'Outro' },
                  ]}
                />
              </div>

              {/* Paciente — só se tipo === session */}
              {form.type === 'session' && (
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>PACIENTE</label>
                  <CustomSelect
                    value={form.patientId}
                    onChange={v => setForm(f => ({ ...f, patientId: v }))}
                    placeholder="Selecionar paciente…"
                    options={allPatients.map(p => ({ value: String(p.id), label: p.name || p.fullName }))}
                  />
                </div>
              )}

              {/* Data */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>DATA</label>
                <DatePicker
                  value={form.date}
                  onChange={v => setForm(f => ({ ...f, date: v }))}
                  style={inSt}
                />
              </div>

              {/* Horários */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>HORA INÍCIO</label>
                  <TimePicker
                    value={form.startTime}
                    onChange={v => setForm(f => ({ ...f, startTime: v }))}
                    style={inSt}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>HORA FIM</label>
                  <TimePicker
                    value={form.endTime}
                    onChange={v => setForm(f => ({ ...f, endTime: v }))}
                    style={inSt}
                  />
                </div>
              </div>

              {/* Link — campo inteligente com geração de Meet */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>LINK DE VIDEOCHAMADA</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    style={{ ...inSt, flex: 1 }}
                    type="text"
                    placeholder="Cole um link ou gere um Google Meet →"
                    value={form.meetLink}
                    onChange={e => setForm(f => ({ ...f, meetLink: e.target.value }))}
                  />
                  {googleConnected && (
                    <button
                      type="button"
                      disabled={generatingMeet}
                      onClick={async () => {
                        setGeneratingMeet(true)
                        try {
                          const patientName = allPatients.find(p => String(p.id) === form.patientId)?.name || 'Paciente'
                          const { meetLink } = await api.createGoogleMeet(patientName)
                          setForm(f => ({ ...f, meetLink }))
                          showToast('Link do Google Meet gerado!', 'success')
                        } catch (e) {
                          showToast(e.message || 'Erro ao gerar link', 'error')
                        } finally {
                          setGeneratingMeet(false)
                        }
                      }}
                      style={{
                        padding: '9px 12px', border: '1px solid #4285F4', borderRadius: 'var(--r)',
                        background: generatingMeet ? 'var(--gr1)' : '#E8F0FE', color: '#1A56C4',
                        fontSize: '12px', fontWeight: 600, cursor: generatingMeet ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap', fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: '5px',
                      }}
                    >
                      {generatingMeet ? (
                        <>
                          <div style={{ width: 12, height: 12, border: '2px solid #4285F4', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                          Gerando…
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="#1A56C4"><path d="M22 8l-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2" fill="#1A56C4"/></svg>
                          Google Meet
                        </>
                      )}
                    </button>
                  )}
                </div>
                {form.meetLink && (
                  <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <a href={form.meetLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--g600)', textDecoration: 'underline', wordBreak: 'break-all' }}>{form.meetLink}</a>
                    <button type="button" onClick={() => setForm(f => ({ ...f, meetLink: '' }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: '14px', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>NOTAS</label>
                <textarea
                  style={{ ...inSt, resize: 'vertical', minHeight: '72px' }}
                  placeholder="Observações opcionais…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gr2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              {eventModal.mode === 'edit' && (
                <button
                  style={{ fontSize: '12px', padding: '8px 14px', border: '1px solid var(--danger)', borderRadius: 'var(--r)', background: 'none', color: 'var(--danger)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginRight: 'auto' }}
                  onClick={handleDelete}
                  disabled={saving}
                >
                  Excluir evento
                </button>
              )}
              <button
                className="btn-outline"
                style={{ padding: '8px 16px', fontSize: '13px', marginLeft: eventModal.mode === 'edit' ? '0' : 'auto' }}
                onClick={closeModal}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className="btn-primary"
                style={{ padding: '8px 20px', fontSize: '13px', justifyContent: 'center' }}
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
              >
                {saving ? 'Salvando…' : eventModal.mode === 'create' ? 'Criar evento' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
