/**
 * DatePicker + TimePicker — custom, app-native pickers.
 * Replace all <input type="date"> and <input type="time"> with these.
 *
 * DatePicker
 *   value      — string 'YYYY-MM-DD' or ''
 *   onChange   — (v: string) => void   v is 'YYYY-MM-DD' or ''
 *   placeholder — string (default 'dd/mm/aaaa')
 *   style      — extra styles on the trigger button
 *
 * TimePicker
 *   value      — string 'HH:MM' or ''
 *   onChange   — (v: string) => void
 *   placeholder — string (default '--:--')
 *   minuteStep — 1 | 5 | 15 | 30  (default 5)
 *   style      — extra styles on the trigger button
 */

import { useState, useEffect, useRef, useCallback } from 'react'

const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
]
const DAYS_SHORT = ['S','T','Q','Q','S','S','D']

// ── helpers ───────────────────────────────────────────────────────────────────
function parseYMD(val) {
  if (!val) return null
  const [y, m, d] = val.split('-').map(Number)
  if (!y || !m || !d) return null
  return { year: y, month: m - 1, day: d }
}

function fmtDisplay(val) {
  const p = parseYMD(val)
  if (!p) return ''
  return `${String(p.day).padStart(2,'0')}/${String(p.month + 1).padStart(2,'0')}/${p.year}`
}

function toIso(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

function getMondayOffset(year, month) {
  const fd = new Date(year, month, 1).getDay()
  return fd === 0 ? 6 : fd - 1
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

// ── shared trigger styles (matches inputStyle used across the app) ─────────────
const BASE = {
  border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
  padding: '9px 12px', fontSize: '13px',
  fontFamily: "'DM Sans', sans-serif",
  background: 'var(--ow)', transition: 'border-color 0.15s, box-shadow 0.15s',
  width: '100%', boxSizing: 'border-box',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'space-between', gap: 8,
  textAlign: 'left', outline: 'none',
}

// ── DatePicker ─────────────────────────────────────────────────────────────────
export function DatePicker({ value, onChange, placeholder = 'dd/mm/aaaa', style = {} }) {
  const [open, setOpen]           = useState(false)
  const [rect, setRect]           = useState(null)
  const [viewYear, setViewYear]   = useState(() => parseYMD(value)?.year  ?? new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => parseYMD(value)?.month ?? new Date().getMonth())
  const [textValue, setTextValue] = useState(() => fmtDisplay(value))
  const wrapRef  = useRef(null)
  const inputRef = useRef(null)
  const dropRef  = useRef(null)
  // Ref so blur timeout always reads latest value, not stale closure
  const valueRef = useRef(value)
  valueRef.current = value

  // Sync text + calendar view when value changes externally (e.g. parent reset)
  useEffect(() => {
    setTextValue(fmtDisplay(value))
    const p = parseYMD(value)
    if (p) { setViewYear(p.year); setViewMonth(p.month) }
  }, [value])

  const computeRect = () => {
    if (!wrapRef.current) return null
    const r   = wrapRef.current.getBoundingClientRect()
    const vh  = window.innerHeight
    const openUp = (vh - r.bottom) < 310 && r.top > 310
    return {
      left:  r.left,
      width: Math.max(r.width, 272),
      ...(openUp ? { bottom: vh - r.top + 6 } : { top: r.bottom + 6 }),
    }
  }

  const openCalendar = useCallback(() => {
    setRect(computeRect())
    setOpen(true)
  }, []) // eslint-disable-line

  // Outside click — only fires when click is truly outside both trigger and dropdown
  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (
        wrapRef.current && !wrapRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) {
        setOpen(false)
        setTextValue(fmtDisplay(valueRef.current))
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Auto-format dd/mm/aaaa as user types
  const handleTextChange = (e) => {
    const prev = textValue
    const next = e.target.value

    // Deletion: pass through without reformatting
    if (next.length < prev.length) {
      setTextValue(next)
      if (!next) onChange('')
      return
    }

    // Typing: extract digits, auto-insert slashes
    const digits = next.replace(/\D/g, '').slice(0, 8)
    let formatted = digits
    if (digits.length > 2) formatted = digits.slice(0,2) + '/' + digits.slice(2)
    if (digits.length > 4) formatted = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4)
    setTextValue(formatted)

    // Validate and fire onChange when all 8 digits are present
    if (digits.length === 8) {
      const dd = parseInt(digits.slice(0,2)), mm = parseInt(digits.slice(2,4)), yyyy = parseInt(digits.slice(4,8))
      const date = new Date(yyyy, mm - 1, dd)
      if (
        date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd &&
        yyyy >= 1900 && yyyy <= 2100
      ) {
        onChange(toIso(yyyy, mm - 1, dd))
        setViewYear(yyyy); setViewMonth(mm - 1)
      }
    }
  }

  // When input loses focus, reset text to the last valid value
  // (unless focus moved into the calendar dropdown)
  const handleInputBlur = () => {
    setTimeout(() => {
      if (
        (dropRef.current && dropRef.current.contains(document.activeElement)) ||
        (wrapRef.current && wrapRef.current.contains(document.activeElement))
      ) return
      setOpen(false)
      setTextValue(fmtDisplay(valueRef.current))
    }, 200)
  }

  const prevYear  = () => setViewYear(y => y - 1)
  const nextYear  = () => setViewYear(y => y + 1)
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const today  = new Date()
  const parsed = parseYMD(value)
  const offset = getMondayOffset(viewYear, viewMonth)
  const total  = daysInMonth(viewYear, viewMonth)
  const cells  = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
      {/* Trigger wrapper — clicking anywhere focuses the text input */}
      <div
        ref={wrapRef}
        onClick={() => { inputRef.current?.focus(); if (!open) openCalendar() }}
        style={{
          ...BASE, ...style,
          cursor: 'text',
          padding: 0,
          borderColor: open ? 'var(--g300)' : 'var(--gr2)',
          boxShadow:   open ? '0 0 0 3px rgba(74,124,89,0.08)' : 'none',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={textValue}
          onChange={handleTextChange}
          onFocus={() => { if (!open) openCalendar() }}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          maxLength={10}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
            color: 'var(--d)', padding: '9px 0 9px 12px', cursor: 'text', minWidth: 0,
          }}
        />
        {/* Calendar icon — preventDefault keeps focus on input */}
        <span
          onMouseDown={e => { e.preventDefault(); inputRef.current?.focus(); if (!open) openCalendar() }}
          style={{ padding: '0 12px 0 8px', display: 'flex', alignItems: 'center', flexShrink: 0, cursor: 'pointer' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2" style={{ display: 'block' }}>
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8"  y1="2" x2="8"  y2="6"/>
            <line x1="3"  y1="10" x2="21" y2="10"/>
          </svg>
        </span>
      </div>

      {open && rect && (
        // onMouseDown preventDefault on the whole dropdown — prevents input from
        // losing focus when the user clicks calendar buttons or days
        <div
          ref={dropRef}
          onMouseDown={e => e.preventDefault()}
          style={{
            position: 'fixed',
            left:  rect.left,
            width: rect.width,
            ...(rect.top    !== undefined ? { top:    rect.top    } : {}),
            ...(rect.bottom !== undefined ? { bottom: rect.bottom } : {}),
            background: 'var(--w)', border: '1px solid var(--gr2)',
            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            zIndex: 9000, padding: '12px 12px 10px',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {/* Navigation: «prev-year  ‹prev-month  Month Year  next-month›  next-year» */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 2 }}>
              <button type="button" onClick={prevYear} style={navBtn} title="Ano anterior"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="11 18 5 12 11 6"/><polyline points="19 18 13 12 19 6"/>
                </svg>
              </button>
              <button type="button" onClick={prevMonth} style={navBtn} title="Mês anterior"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
            </div>

            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--d)' }}>
              {MONTHS_PT[viewMonth]} {viewYear}
            </span>

            <div style={{ display: 'flex', gap: 2 }}>
              <button type="button" onClick={nextMonth} style={navBtn} title="Próximo mês"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button type="button" onClick={nextYear} style={navBtn} title="Próximo ano"
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="5 18 11 12 5 6"/><polyline points="13 18 19 12 13 6"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 3 }}>
            {DAYS_SHORT.map((d, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--gr4)', padding: '2px 0', letterSpacing: '0.3px' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const isSel   = parsed && parsed.year === viewYear && parsed.month === viewMonth && parsed.day === day
              const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day
              return (
                <button key={i} type="button"
                  onClick={() => { onChange(toIso(viewYear, viewMonth, day)); setOpen(false) }}
                  style={{
                    width: '100%', aspectRatio: '1', border: 'none', borderRadius: 6,
                    fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    background: isSel ? 'var(--g500)' : 'transparent',
                    color:      isSel ? '#fff' : isToday ? 'var(--g600)' : 'var(--d)',
                    fontWeight: isSel || isToday ? 700 : 400,
                    outline:    isToday && !isSel ? '1.5px solid var(--g300)' : 'none',
                    outlineOffset: -1, transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--g50)' }}
                  onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--gr1)' }}>
            <button type="button"
              onClick={() => { onChange(''); setTextValue(''); setOpen(false) }}
              style={footBtn('#8B8B8B')}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--d)'}
              onMouseLeave={e => e.currentTarget.style.color = '#8B8B8B'}
            >Limpar</button>
            <button type="button"
              onClick={() => {
                const t   = new Date()
                const iso = toIso(t.getFullYear(), t.getMonth(), t.getDate())
                onChange(iso)
                setViewYear(t.getFullYear()); setViewMonth(t.getMonth())
                setOpen(false)
              }}
              style={{ ...footBtn('var(--g600)'), fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--g700)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--g600)'}
            >Hoje</button>
          </div>
        </div>
      )}
    </>
  )
}

// ── TimePicker ─────────────────────────────────────────────────────────────────
export function TimePicker({ value, onChange, placeholder = '--:--', minuteStep = 5, style = {} }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const triggerRef = useRef(null)
  const dropRef    = useRef(null)
  const hColRef    = useRef(null)
  const mColRef    = useRef(null)

  const parts = value ? value.split(':').map(Number) : [null, null]
  const selH  = parts[0] ?? null
  const selM  = parts[1] ?? null

  const hours   = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep)

  const openDrop = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const vh = window.innerHeight
    const DROP_H = 240
    const openUp = vh - r.bottom < DROP_H && r.top > DROP_H
    setRect({
      left:  r.left,
      width: Math.max(r.width, 148),
      ...(openUp ? { bottom: vh - r.top + 6 } : { top: r.bottom + 6 }),
    })
    setOpen(p => !p)
  }, [])

  // Scroll selected items into view on open
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      if (selH !== null && hColRef.current) {
        const el = hColRef.current.querySelector(`[data-h="${selH}"]`)
        el?.scrollIntoView({ block: 'center', behavior: 'instant' })
      }
      if (selM !== null && mColRef.current) {
        const el = mColRef.current.querySelector(`[data-m="${selM}"]`)
        el?.scrollIntoView({ block: 'center', behavior: 'instant' })
      }
    }, 30)
    return () => clearTimeout(t)
  }, [open]) // eslint-disable-line

  // Outside click
  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current    && !dropRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const pick = (h, m) => {
    if (h === null || m === null) return
    onChange(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`)
  }

  const timeItem = (active) => ({
    padding: '7px 0', textAlign: 'center', cursor: 'pointer', fontSize: 13,
    fontFamily: "'DM Sans', sans-serif", borderRadius: 6,
    background: active ? 'var(--g500)' : 'transparent',
    color: active ? '#fff' : 'var(--d)',
    fontWeight: active ? 700 : 400,
    userSelect: 'none', transition: 'background 0.1s',
    fontVariantNumeric: 'tabular-nums',
  })

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDrop}
        style={{
          ...BASE, ...style,
          borderColor: open ? 'var(--g300)' : 'var(--gr2)',
          boxShadow:   open ? '0 0 0 3px rgba(74,124,89,0.08)' : 'none',
        }}
      >
        <span style={{ color: value ? 'var(--d)' : 'var(--gr3)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px' }}>
          {value || placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </button>

      {open && rect && (
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            left:  rect.left,
            width: rect.width,
            ...(rect.top    !== undefined ? { top:    rect.top    } : {}),
            ...(rect.bottom !== undefined ? { bottom: rect.bottom } : {}),
            background: 'var(--w)', border: '1px solid var(--gr2)',
            borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
            zIndex: 9000, overflow: 'hidden',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--gr1)' }}>
            {['Hora','Min'].map((lbl, i) => (
              <div key={lbl} style={{
                padding: '8px 0 7px', textAlign: 'center',
                fontSize: 10, fontWeight: 700, color: 'var(--gr4)',
                textTransform: 'uppercase', letterSpacing: '0.4px',
                borderRight: i === 0 ? '1px solid var(--gr1)' : 'none',
              }}>{lbl}</div>
            ))}
          </div>

          {/* Scroll columns */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', height: 168 }}>
            <div ref={hColRef} style={{ overflowY: 'auto', scrollbarWidth: 'none', padding: '4px 6px', borderRight: '1px solid var(--gr1)' }}>
              {hours.map(hr => (
                <div key={hr} data-h={hr}
                  style={timeItem(hr === selH)}
                  onClick={() => pick(hr, selM ?? 0)}
                  onMouseEnter={e => { if (hr !== selH) e.currentTarget.style.background = 'var(--g50)' }}
                  onMouseLeave={e => { if (hr !== selH) e.currentTarget.style.background = 'transparent' }}
                >{String(hr).padStart(2,'0')}</div>
              ))}
            </div>
            <div ref={mColRef} style={{ overflowY: 'auto', scrollbarWidth: 'none', padding: '4px 6px' }}>
              {minutes.map(mn => (
                <div key={mn} data-m={mn}
                  style={timeItem(mn === selM)}
                  onClick={() => { pick(selH ?? new Date().getHours(), mn); setOpen(false) }}
                  onMouseEnter={e => { if (mn !== selM) e.currentTarget.style.background = 'var(--g50)' }}
                  onMouseLeave={e => { if (mn !== selM) e.currentTarget.style.background = 'transparent' }}
                >{String(mn).padStart(2,'0')}</div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', borderTop: '1px solid var(--gr1)' }}>
            <button type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              style={footBtn('#8B8B8B')}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--d)'}
              onMouseLeave={e => e.currentTarget.style.color = '#8B8B8B'}
            >Limpar</button>
            <button type="button"
              onClick={() => setOpen(false)}
              style={{ ...footBtn('var(--g600)'), fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--g700)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--g600)'}
            >OK</button>
          </div>
        </div>
      )}
    </>
  )
}

// ── CustomSelect ───────────────────────────────────────────────────────────────
export function CustomSelect({ value, onChange, options, placeholder = 'Selecionar…', error = false, style = {} }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const triggerRef = useRef(null)
  const dropRef    = useRef(null)

  const openDrop = useCallback(() => {
    if (!triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    const vh = window.innerHeight
    const DROP_H = 260
    const openUp = vh - r.bottom < DROP_H && r.top > DROP_H
    setRect({
      left:  r.left,
      width: Math.max(r.width, 180),
      ...(openUp ? { bottom: vh - r.top + 4 } : { top: r.bottom + 4 }),
    })
    setOpen(p => !p)
  }, [])

  useEffect(() => {
    if (!open) return
    const h = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        dropRef.current    && !dropRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const selected = options.find(o => String(o.value) === String(value))

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDrop}
        style={{
          ...BASE, ...style,
          borderColor: error ? 'var(--danger)' : open ? 'var(--g300)' : 'var(--gr2)',
          boxShadow:   open ? '0 0 0 3px rgba(74,124,89,0.08)' : 'none',
          color: selected ? 'var(--d)' : 'var(--gr3)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selected ? 'var(--d)' : 'var(--gr4)' }}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2" strokeLinecap="round"
          style={{ flexShrink: 0, marginLeft: 8, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && rect && (
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            left:  rect.left,
            width: rect.width,
            ...(rect.top    !== undefined ? { top:    rect.top    } : {}),
            ...(rect.bottom !== undefined ? { bottom: rect.bottom } : {}),
            background: 'var(--w)', border: '1px solid var(--gr2)',
            borderRadius: 'var(--r)', boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
            zIndex: 9000, overflow: 'hidden', maxHeight: 240, overflowY: 'auto',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {options.map(o => {
            const isActive = String(o.value) === String(value)
            return (
              <button
                key={String(o.value)}
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
    </>
  )
}

// ── shared micro-styles ────────────────────────────────────────────────────────
const navBtn = {
  width: 28, height: 28, border: 'none', background: 'none',
  cursor: 'pointer', borderRadius: 6, color: 'var(--gr5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 0.12s',
}

const footBtn = (color) => ({
  fontSize: 12, color, background: 'none', border: 'none',
  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
  padding: '3px 6px', borderRadius: 4, transition: 'color 0.12s',
})
