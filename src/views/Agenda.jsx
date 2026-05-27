import { useState, useEffect, useRef, useCallback } from 'react'
import { api } from '../services'

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

// ── CustomSelect — dropdown estilizado, substitui <select> nativo ────────────
function CustomSelect({ value, onChange, options, placeholder = 'Selecionar…' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find(o => String(o.value) === String(value))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...inSt,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', textAlign: 'left',
          borderColor: open ? 'var(--g300)' : 'var(--gr2)',
          boxShadow: open ? '0 0 0 3px rgba(74,124,89,0.10)' : 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          userSelect: 'none',
        }}
      >
        <span style={{ color: selected ? 'var(--d)' : 'var(--gr4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2" strokeLinecap="round"
          style={{ flexShrink: 0, marginLeft: 8, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 270,
          background: 'var(--w)', border: '1px solid var(--gr2)',
          borderRadius: 'var(--r)', boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
          overflow: 'hidden', maxHeight: 240, overflowY: 'auto',
        }}>
          {options.map(o => {
            const isActive = String(o.value) === String(value)
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '10px 14px', border: 'none', cursor: 'pointer',
                  background: isActive ? 'var(--g50)' : 'var(--w)',
                  color: isActive ? 'var(--g700)' : 'var(--d)',
                  fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
                  fontWeight: isActive ? 600 : 400, textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--ow)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'var(--w)' }}
              >
                {o.label}
                {isActive && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Agenda({ currentUser }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const [miniCalOffset, setMiniCalOffset] = useState(0)
  const [events, setEvents] = useState([])
  const [googleEvents, setGoogleEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [eventModal, setEventModal] = useState(EMPTY_MODAL)
  const [allPatients, setAllPatients] = useState([])
  const [saving, setSaving] = useState(false)
  const [agendaView, setAgendaView] = useState(() => window.innerWidth <= 640 ? 'list' : 'week')
  const [form, setForm] = useState({
    title: '', type: 'session', patientId: '', date: '', startTime: '', endTime: '', meetLink: '', notes: ''
  })

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
      meetLink: '', notes: '',
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
      notes: evt.notes || '',
    })
    setEventModal({ open: true, mode: 'edit', data: evt })
  }

  function closeModal() {
    setEventModal(EMPTY_MODAL)
  }

  function buildPayload() {
    const [h1, m1] = form.startTime.split(':').map(Number)
    const [h2, m2] = form.endTime.split(':').map(Number)
    const startAt = new Date(form.date)
    startAt.setHours(h1, m1, 0, 0)
    const endAt = new Date(form.date)
    endAt.setHours(h2, m2, 0, 0)
    const patient = allPatients.find(p => String(p.id) === String(form.patientId))
    return {
      title: form.title,
      type: form.type,
      patientId: form.type === 'session' ? form.patientId || null : null,
      patientName: form.type === 'session' && patient ? (patient.name || patient.fullName) : null,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      meetLink: form.meetLink || null,
      notes: form.notes || null,
    }
  }

  async function handleSave() {
    if (!form.title.trim() && form.type !== 'session') return
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
      console.error(e)
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
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // Merge PsicoAI + Google events into unified list
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

  // Mini cal
  const miniBase = new Date(today.getFullYear(), today.getMonth() + miniCalOffset, 1)
  const miniYear = miniBase.getFullYear()
  const miniMonth = miniBase.getMonth()
  const firstDay = new Date(miniYear, miniMonth, 1).getDay()
  const daysInMonth = new Date(miniYear, miniMonth + 1, 0).getDate()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1
  const miniDays = []
  for (let i = 0; i < startOffset; i++) miniDays.push(null)
  for (let i = 1; i <= daysInMonth; i++) miniDays.push(i)

  // Days with events for mini cal
  const daysWithEvents = new Set(
    events.map(e => {
      const d = new Date(e.startAt)
      if (d.getMonth() === miniMonth && d.getFullYear() === miniYear) return d.getDate()
      return null
    }).filter(Boolean)
  )

  const weekRange = `${weekDates[0].getDate()} a ${weekDates[4].getDate()} de ${MONTHS_PT[weekDates[0].getMonth()]}`
  const sessionsThisWeek = events.filter(e => {
    const d = new Date(e.startAt)
    return d >= weekDates[0] && d <= weekDates[4] && e.type === 'session'
  }).length

  // List view: all upcoming events, sorted, grouped by date
  const listEvents = allEvents
    .filter(e => new Date(e.startAt) >= new Date(today.getTime() - 86400000 * 7))
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
          <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => openCreate()}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo Evento
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ──────────────────────────────────────────── */}
      {agendaView === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--gr1)', alignItems: 'center' }}>
                  <div className="skel-pulse" style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skel-pulse" style={{ height: 13, width: '60%', borderRadius: 4, marginBottom: 6 }} />
                    <div className="skel-pulse" style={{ height: 10, width: '35%', borderRadius: 4 }} />
                  </div>
                </div>
              ))
            : Object.keys(listGrouped).length === 0
              ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--gr4)', fontSize: 13 }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.5" style={{ marginBottom: 14, display: 'block', margin: '0 auto 14px' }}>
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Nenhum evento agendado nos próximos dias
                </div>
              )
              : Object.entries(listGrouped).map(([dateLabel, evts]) => (
                  <div key={dateLabel}>
                    {/* Date heading */}
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: 'var(--gr4)',
                      letterSpacing: '0.6px', textTransform: 'uppercase',
                      padding: '14px 0 8px',
                      borderBottom: '1px solid var(--gr2)',
                    }}>
                      {dateLabel}
                    </div>
                    {evts.map(evt => {
                      const ts = TYPE_STYLES[evt.type] || TYPE_STYLES.session
                      return (
                        <div
                          key={evt.id}
                          onClick={() => openEdit(evt)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '12px 4px',
                            borderBottom: '1px solid var(--gr1)',
                            cursor: 'pointer',
                            transition: 'background 0.13s',
                            borderRadius: 8,
                            margin: '2px 0',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--gr1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          {/* Time box */}
                          <div style={{
                            width: 48, textAlign: 'center', flexShrink: 0,
                          }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--d)', fontVariantNumeric: 'tabular-nums' }}>{fmtHour(evt.startAt)}</div>
                            <div style={{ fontSize: 9, color: 'var(--gr4)', marginTop: 1 }}>{fmtHour(evt.endAt)}</div>
                          </div>
                          {/* Color bar */}
                          <div style={{ width: 3, height: 36, borderRadius: 2, background: ts.border, flexShrink: 0 }} />
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--d)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {evt.patientName || evt.title}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--gr5)', marginTop: 2 }}>
                              {TYPE_LABELS[evt.type] || evt.type}
                              {evt.meetLink && ' · 📹 Remota'}
                            </div>
                          </div>
                          {/* Arrow */}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>
                      )
                    })}
                  </div>
                ))
          }
        </div>
      )}

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
          {/* Mini cal */}
          <div className="agenda-mini-cal">
            <div className="mini-cal-header">
              <span className="mini-cal-title">{MONTHS_PT[miniMonth]} {miniYear}</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button className="mini-cal-nav" onClick={() => setMiniCalOffset(o => o - 1)}>‹</button>
                <button className="mini-cal-nav" onClick={() => setMiniCalOffset(o => o + 1)}>›</button>
              </div>
            </div>
            <div className="mini-cal-grid">
              {['S','T','Q','Q','S','S','D'].map((d, i) => (
                <div key={i} className="mini-cal-dow">{d}</div>
              ))}
              {miniDays.map((day, i) => {
                const isToday = day && day === today.getDate() && miniMonth === today.getMonth() && miniYear === today.getFullYear()
                const isInWeek = day && weekDates.some(wd => wd.getDate() === day && wd.getMonth() === miniMonth && wd.getFullYear() === miniYear)
                return (
                <div
                  key={i}
                  className={`mini-cal-day${isToday ? ' today' : ''}${!day ? ' other-month' : ''}${isInWeek && !isToday ? ' in-week' : ''}`}
                  style={{
                    ...(day && daysWithEvents.has(day) ? { position: 'relative' } : {}),
                    ...(day ? { cursor: 'pointer' } : {}),
                  }}
                  onClick={() => {
                    if (!day) return
                    const clicked = new Date(miniYear, miniMonth, day)
                    const clickedMonday = getMondayOf(clicked)
                    const todayMonday = getMondayOf(today)
                    const diffMs = clickedMonday - todayMonday
                    const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
                    setWeekOffset(diffWeeks)
                  }}
                >
                  {day || ''}
                  {day && daysWithEvents.has(day) && (
                    <span style={{ position: 'absolute', bottom: '1px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--g500)', display: 'block' }} />
                  )}
                </div>
                )
              })}
            </div>
          </div>

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
                <div style={{ position: 'relative' }}>
                  <input
                    style={{
                      ...inSt,
                      paddingRight: 40,
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      appearance: 'none',
                    }}
                    type="date"
                    value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  />
                  <svg
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                    width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="1.8"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
              </div>

              {/* Horários */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>HORA INÍCIO</label>
                  <input
                    style={inSt}
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>HORA FIM</label>
                  <input
                    style={inSt}
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>

              {/* Link */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>LINK DE VIDEOCHAMADA</label>
                <input
                  style={inSt}
                  type="text"
                  placeholder="https://meet.google.com/…"
                  value={form.meetLink}
                  onChange={e => setForm(f => ({ ...f, meetLink: e.target.value }))}
                />
              </div>

              {/* Notas */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>NOTAS</label>
                <textarea
                  style={{ ...inSt, resize: 'vertical', minHeight: '72px' }}
                  placeholder="Observações opcionais…"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
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
