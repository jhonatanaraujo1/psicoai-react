/**
 * AnnotationSession — editor unificado de anotações clínicas.
 *
 * Um único componente que serve tanto para anotações de TEXTO quanto de CANVAS.
 * O layout externo (escuro, folha A4 centralizada, sidebar, toolbar) é idêntico
 * para os dois modos. O que muda é o interior da folha A4 e a toolbar.
 *
 * type="text"   → contentEditable dentro da folha, toolbar de formatação
 * type="canvas" → HTML5 canvas com PointerEvents, toolbar de desenho, multi-página
 *
 * Props:
 *   patient          — { id, name }
 *   isOpen           — boolean
 *   type             — 'text' | 'canvas'
 *   onClose(data)    — chamado ao salvar sem IA
 *   onMinimize()     — minimiza sem encerrar
 *   onAnalyze(data)  — salvar + analisar com IA
 *   onAutosave       — callback para autosave no backend
 *   sessionId        — id da sessão aberta
 *   initialHtml      — HTML inicial para modo texto (reabrir anotação)
 *   initialCanvasData — JSON de páginas salvas para modo canvas
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { AES, enc as CryptoEnc } from 'crypto-js'
import DOMPurify from 'dompurify'

// FE-002: sanitização para editor de anotação clínica — permite formatação, bloqueia scripts
const ANNOT_SANITIZE = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h3', 'h4', 'span', 'div'],
  ALLOWED_ATTR: [],
}
const sanitizeAnnotHtml = (html) => DOMPurify.sanitize(html || '', ANNOT_SANITIZE)

// ── A4 dimensions ─────────────────────────────────────────────────────────────
const PAGE_W = 794
const PAGE_H = 1123
const SCALE  = 2       // retina/HiDPI

// ── Canvas colors ─────────────────────────────────────────────────────────────
const COLORS = ['#1C1C1C', '#2D6A4F', '#7B5E3A', '#C0392B', '#2471A3', '#7D3C98']

// ── Text guide items ──────────────────────────────────────────────────────────
const GUIDE = [
  { icon: '💬', label: 'O que o paciente trouxe',     hint: 'Queixa do dia, como chegou, humor' },
  { icon: '👁',  label: 'O que você observou',         hint: 'Postura, tom de voz, pausas, emoções' },
  { icon: '🔁', label: 'Padrões que apareceram',       hint: 'Evitação, ruminação, contradições' },
  { icon: '💡', label: 'O que emergiu ou surpreendeu', hint: 'Insights, associações, temas novos' },
  { icon: '📌', label: 'O que ficou para a próxima',   hint: 'Temas em aberto, tarefas' },
]

// ── Canvas localStorage ───────────────────────────────────────────────────────
// Chave por sessionId (preferencial) ou patientId (fallback para sessões antigas)
const canvasKey    = (sessionId) => `psicoai_canvas2_s${sessionId}`
const canvasKeyPat = (patientId) => `psicoai_canvas2_p${patientId}` // legado

let _pid = 0
const newPageId = () => `pg-${Date.now()}-${_pid++}`

// SEC-003: chave de encriptação ESTÁVEL (não muda com refresh do token)
// Derivada do userId do usuário logado — persiste enquanto a conta estiver logada.
// Bug anterior: usava JWT que rota a cada 15min → chave mudava → dados perdidos.
const getEncKey = () => {
  try {
    // Prioridade 1: userId do psicoai_user (estável entre token refreshes)
    const user = JSON.parse(localStorage.getItem('psicoai_user') || '{}')
    const uid = user?.id || user?.email || ''
    if (uid.length > 4) return `psicoai-clinical-v2:${uid.slice(0, 40)}`
    // Prioridade 2: chave aleatória gerada uma vez por dispositivo
    let devKey = localStorage.getItem('psicoai_enc_key')
    if (!devKey) {
      devKey = `dk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('psicoai_enc_key', devKey)
    }
    return devKey
  } catch { return 'psicoai-clinical-v2-fallback' }
}

// ── Shape tool list ───────────────────────────────────────────────────────────
const SHAPE_TOOLS = ['rect', 'circle', 'diamond', 'arrow', 'line']

// Draws a shape preview/commit onto a canvas context
function drawShape(ctx, shape, x1, y1, x2, y2, color, lineWidth) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([])       // reset qualquer lineDash herdado do contexto
  ctx.setLineDashOffset(0)
  const w  = x2 - x1
  const h  = y2 - y1
  const cx = (x1 + x2) / 2
  const cy = (y1 + y2) / 2
  ctx.beginPath()
  if (shape === 'rect') {
    ctx.rect(x1, y1, w, h)
    ctx.stroke()
  } else if (shape === 'circle') {
    const rx = Math.abs(w) / 2
    const ry = Math.abs(h) / 2
    ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, Math.PI * 2)
    ctx.stroke()
  } else if (shape === 'diamond') {
    ctx.moveTo(cx, y1)
    ctx.lineTo(x2, cy)
    ctx.lineTo(cx, y2)
    ctx.lineTo(x1, cy)
    ctx.closePath()
    ctx.stroke()
  } else if (shape === 'line') {
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  } else if (shape === 'arrow') {
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    const angle    = Math.atan2(y2 - y1, x2 - x1)
    const alen     = Math.max(lineWidth * 4, 18 * SCALE)
    const spread   = Math.PI / 6
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - alen * Math.cos(angle - spread), y2 - alen * Math.sin(angle - spread))
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - alen * Math.cos(angle + spread), y2 - alen * Math.sin(angle + spread))
    ctx.stroke()
  }
  ctx.restore()
}

// Tenta descriptografar com a chave atual; se falhar, tenta JSON puro (dados legados)
function tryParse(raw, key) {
  try {
    const dec = AES.decrypt(raw, key).toString(CryptoEnc.Utf8)
    if (!dec) throw new Error('empty')
    return JSON.parse(dec)
  } catch { /* tenta plaintext abaixo */ }
  try { return JSON.parse(raw) } catch { return null }
}

// Um caderno por paciente — chave por paciente é a primária.
// Chave por sessão é salva como espelho para recuperação cross-device via backend.
function loadCanvasPages(sessionId, patientId) {
  try {
    const key = getEncKey()
    // 1. Chave por paciente (primária — documento único por paciente)
    if (patientId) {
      const rawPat = localStorage.getItem(canvasKeyPat(patientId))
      if (rawPat) {
        const parsed = tryParse(rawPat, key)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    }
    // 2. Fallback: chave por sessão (dados legados ou cross-device)
    const rawSession = sessionId ? localStorage.getItem(canvasKey(sessionId)) : null
    if (rawSession) {
      const parsed = tryParse(rawSession, key)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migra para chave por paciente
        if (patientId) saveCanvasPages(sessionId, patientId, parsed)
        return parsed
      }
    }
    return null
  } catch { return null }
}

function saveCanvasPages(sessionId, patientId, pages) {
  try {
    const data = JSON.stringify(pages.map(p => ({
      id: p.id,
      pageType: p.pageType || 'draw',
      dataUrl: p.dataUrl || null,
      textHtml: p.textHtml || null,
      sessionId: p.sessionId || null,   // rastreia a qual sessão a página pertence
    })))
    if (data.length >= 4 * 1024 * 1024) return // muito grande
    const encrypted = AES.encrypt(data, getEncKey()).toString()
    // Salva sempre na chave por paciente (documento único)
    if (patientId) localStorage.setItem(canvasKeyPat(patientId), encrypted)
    // Espelho na chave por sessão (para autosave backend / cross-device)
    if (sessionId) localStorage.setItem(canvasKey(sessionId), encrypted)
  } catch { /* quota */ }
}

// ── Shared helpers — declarados antes de qualquer componente para evitar TDZ no Rolldown ──
function TBtn({ active, onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 44, height: 44, borderRadius: 8, border: 'none',
      background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.55)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s', flexShrink: 0,
      touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
    }}
    onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}}
    onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />
}

function AddPageMenu({ onAddPage }) {
  return (
    <div style={{
      background: '#242424', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8, overflow: 'hidden',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      display: 'flex', flexDirection: 'column',
      minWidth: 130, zIndex: 50,
    }}>
      {[
        { type: 'draw', label: 'Desenho', icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg> },
        { type: 'text', label: 'Texto',   icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/></svg> },
      ].map((opt, i) => (
        <button key={opt.type} onClick={() => onAddPage(opt.type)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '10px 14px', textAlign: 'left',
            color: 'rgba(255,255,255,0.8)', fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            display: 'flex', alignItems: 'center', gap: 8,
            borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {opt.icon} {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── A4 canvas page (modo canvas) ──────────────────────────────────────────────
function CanvasPage({ page, isActive, toolRef, colorRef, sizeRef, onStrokeEnd, onClick, penDetectedRef }) {
  const canvasRef        = useRef(null)
  const isDrawing        = useRef(false)
  const lastPos          = useRef({ x: 0, y: 0 })
  const prevDataUrl      = useRef(null) // snapshot antes do traço comecar
  const shapeStartRef    = useRef(null) // {x,y} — início do shape drag
  const shapeSnapshotRef = useRef(null) // ImageData — canvas antes do preview

  useEffect(() => { page.canvasRef.current = canvasRef.current })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    if (page.dataUrl) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = page.dataUrl
    }
  }, [page.id]) // eslint-disable-line

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return {
      x: (e.clientX - r.left) * (canvasRef.current.width  / r.width),
      y: (e.clientY - r.top)  * (canvasRef.current.height / r.height),
    }
  }

  const onPointerDown = useCallback((e) => {
    if (e.button !== undefined && e.button > 0) return
    // Palm rejection: once a stylus is detected, block touch (finger) input
    if (e.pointerType === 'pen' && penDetectedRef) penDetectedRef.current = true
    if (penDetectedRef?.current && e.pointerType === 'touch') return
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    isDrawing.current = true
    prevDataUrl.current = canvasRef.current?.toDataURL('image/png') || null
    const pos = getPos(e)
    lastPos.current = pos
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!ctx) return
    if (SHAPE_TOOLS.includes(toolRef.current)) {
      // Shape mode: record start position + take ImageData snapshot for live preview
      shapeStartRef.current    = pos
      shapeSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
    } else {
      // Freehand: draw initial dot
      ctx.save()
      ctx.globalCompositeOperation = toolRef.current === 'eraser' ? 'destination-out' : 'source-over'
      ctx.fillStyle = toolRef.current === 'eraser' ? 'rgba(0,0,0,1)' : colorRef.current
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, (sizeRef.current * SCALE) / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }, []) // eslint-disable-line

  const onPointerMove = useCallback((e) => {
    if (!isDrawing.current) return
    if (penDetectedRef?.current && e.pointerType === 'touch') return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx    = canvas?.getContext('2d')
    if (!ctx) return
    const pos = getPos(e)
    if (SHAPE_TOOLS.includes(toolRef.current)) {
      if (!shapeStartRef.current || !shapeSnapshotRef.current) return
      // Restore to pre-drag state, then draw live preview
      ctx.putImageData(shapeSnapshotRef.current, 0, 0)
      const lineW = sizeRef.current * SCALE * 1.5
      drawShape(ctx, toolRef.current, shapeStartRef.current.x, shapeStartRef.current.y, pos.x, pos.y, colorRef.current, lineW)
    } else {
      const pressure = (e.pointerType === 'pen' && e.pressure > 0) ? e.pressure : 0.5
      const lineW    = (sizeRef.current * SCALE) * (0.4 + pressure * 1.2)
      ctx.save()
      ctx.globalCompositeOperation = toolRef.current === 'eraser' ? 'destination-out' : 'source-over'
      ctx.strokeStyle = toolRef.current === 'eraser' ? 'rgba(0,0,0,1)' : colorRef.current
      ctx.lineWidth = lineW; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.stroke()
      ctx.restore()
      lastPos.current = pos
    }
  }, []) // eslint-disable-line

  const onPointerUp = useCallback((e) => {
    if (!isDrawing.current) return
    isDrawing.current = false
    e.preventDefault()
    shapeStartRef.current    = null
    shapeSnapshotRef.current = null
    onStrokeEnd(page.id, prevDataUrl.current)
    prevDataUrl.current = null
  }, [page.id, onStrokeEnd])

  return (
    <div
      id={`page-${page.id}`}
      className="as-page-wrap as-page-canvas"
      onClick={onClick}
      style={{
        flexShrink: 0, width: PAGE_W, height: PAGE_H,
        background: '#fff', borderRadius: 2,
        boxShadow: isActive
          ? '0 0 0 2.5px #5C8F6A, 0 8px 40px rgba(0,0,0,0.22)'
          : '0 4px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden', cursor: 'crosshair', touchAction: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        className="as-canvas"
        width={PAGE_W * SCALE} height={PAGE_H * SCALE}
        style={{ width: PAGE_W, height: PAGE_H, display: 'block' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}     onPointerCancel={onPointerUp}
      />
    </div>
  )
}

// ── DatePicker custom — calendário 100% CSS/JS, sem input nativo ──────────────
const MONTHS_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTHS_SHORT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
const WEEK_LABELS  = ['Do','Se','Te','Qu','Qu','Se','Sá']

function isoToDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function dateToIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtPill(iso) {
  if (!iso) return 'Definir data'
  const d = isoToDate(iso)
  return `${String(d.getDate()).padStart(2,'0')} ${MONTHS_SHORT[d.getMonth()]}. ${d.getFullYear()}`
}
function sameDay(a, b) {
  return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function buildCalDays(year, month) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const rows  = []
  let startDow = first.getDay() // 0=Dom
  const cells = []
  for (let i = startDow - 1; i >= 0; i--)
    cells.push({ d: new Date(year, month, -i), cur: false })
  for (let d = 1; d <= last.getDate(); d++)
    cells.push({ d: new Date(year, month, d), cur: true })
  while (cells.length % 7 !== 0)
    cells.push({ d: new Date(year, month + 1, cells.length - startDow - last.getDate() + 1), cur: false })
  for (let i = 0; i < cells.length; i += 7)
    rows.push(cells.slice(i, i + 7))
  return rows
}

function DatePill({ value, onChange }) {
  const [open,    setOpen]    = useState(false)
  const [hovered, setHovered] = useState(false)
  const [pos,     setPos]     = useState({ top: 0, left: 0, above: false })

  const today    = new Date(); today.setHours(0,0,0,0)
  const selDate  = isoToDate(value)
  const initDate = selDate || today

  const [viewY, setViewY] = useState(initDate.getFullYear())
  const [viewM, setViewM] = useState(initDate.getMonth())

  const triggerRef  = useRef(null)
  const calendarRef = useRef(null)

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (!calendarRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target))
        setOpen(false)
    }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', handler, true)
    document.addEventListener('touchstart', handler, true)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler, true)
      document.removeEventListener('touchstart', handler, true)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  // Sincroniza viewY/viewM quando value muda externamente
  useEffect(() => {
    if (selDate) { setViewY(selDate.getFullYear()); setViewM(selDate.getMonth()) }
  }, [value]) // eslint-disable-line

  const handleToggle = () => {
    if (!triggerRef.current) return
    const r   = triggerRef.current.getBoundingClientRect()
    const vw  = window.innerWidth
    const vh  = window.innerHeight
    const CAL_W = Math.min(288, vw - 24)
    const CAL_H = 320

    let left = r.left + r.width / 2 - CAL_W / 2
    left = Math.max(12, Math.min(left, vw - CAL_W - 12))

    const spaceBelow = vh - r.bottom - 10
    const spaceAbove = r.top - 10
    const above = spaceBelow < CAL_H && spaceAbove > spaceBelow

    setPos({ top: above ? r.top - CAL_H - 8 : r.bottom + 8, left, above })
    setOpen(o => !o)
  }

  const prevMonth = () => {
    setViewM(m => { if (m === 0) { setViewY(y => y - 1); return 11 } return m - 1 })
  }
  const nextMonth = () => {
    setViewM(m => { if (m === 11) { setViewY(y => y + 1); return 0 } return m + 1 })
  }
  const selectDay = (d) => { onChange(dateToIso(d)); setOpen(false) }
  const goToday   = () => { selectDay(today) }

  const rows = buildCalDays(viewY, viewM)

  const CAL_W = typeof window !== 'undefined' ? Math.min(288, window.innerWidth - 24) : 288

  return (
    <>
      {/* ── Trigger pill ── */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '6px 14px', borderRadius: 20,
          background: open ? '#D4E8DA' : hovered ? '#D4E8DA' : '#EBF4EE',
          border: `1.5px solid ${open || hovered ? '#8BB89A' : '#D4E8DA'}`,
          cursor: 'pointer', transition: 'all 0.18s ease',
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: open ? '0 2px 10px rgba(74,124,89,0.2)' : hovered ? '0 2px 8px rgba(74,124,89,0.12)' : 'none',
          touchAction: 'manipulation',
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={open || hovered ? '#2D4A38' : '#5C8F6A'} strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: open || hovered ? '#1A2E20' : '#3D6B4A', whiteSpace: 'nowrap' }}>
          {fmtPill(value)}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={open || hovered ? '#3D6B4A' : '#8BB89A'} strokeWidth="2.5"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* ── Calendário custom (portal via position:fixed) ── */}
      {open && (
        <>
          {/* Backdrop móvel — toque fora fecha */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 11998, background: 'transparent' }}
            onClick={() => setOpen(false)}
          />
          <div
            ref={calendarRef}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: CAL_W,
              zIndex: 11999,
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
              border: '1px solid #E8E5E0',
              overflow: 'hidden',
              fontFamily: "'DM Sans', sans-serif",
              animation: 'dpIn 0.18s cubic-bezier(0.34,1.56,0.64,1)',
              transformOrigin: pos.above ? 'bottom center' : 'top center',
            }}
            onClick={e => e.stopPropagation()}
          >
            <style>{`
              @keyframes dpIn { from{opacity:0;transform:scale(0.92)} to{opacity:1;transform:scale(1)} }
            `}</style>

            {/* Header: mês/ano + navegação */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', background: '#2D4A38' }}>
              <button onClick={prevMonth} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '0.2px' }}>{MONTHS_FULL[viewM]}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{viewY}</div>
              </div>
              <button onClick={nextMonth} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'manipulation' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>

            {/* Labels dias da semana */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '8px 12px 4px', background: '#F5F2EC' }}>
              {WEEK_LABELS.map((l, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#8B8B8B', letterSpacing: '0.5px', padding: '2px 0' }}>{l}</div>
              ))}
            </div>

            {/* Grid de dias */}
            <div style={{ padding: '4px 12px 8px', background: '#fff' }}>
              {rows.map((row, ri) => (
                <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
                  {row.map(({ d, cur }, ci) => {
                    const isSel   = sameDay(d, selDate)
                    const isTod   = sameDay(d, today)
                    const isOther = !cur
                    return (
                      <button
                        key={ci}
                        onClick={() => selectDay(d)}
                        style={{
                          width: '100%', aspectRatio: '1', borderRadius: 8,
                          border: isTod && !isSel ? '2px solid #4A7C59' : '2px solid transparent',
                          background: isSel ? '#4A7C59' : 'transparent',
                          color: isSel ? '#fff' : isOther ? '#C8C4BD' : isTod ? '#2D4A38' : '#1C1C1C',
                          fontSize: 13, fontWeight: isSel || isTod ? 700 : 400,
                          cursor: 'pointer', transition: 'all 0.12s',
                          fontFamily: "'DM Sans', sans-serif",
                          touchAction: 'manipulation',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          minHeight: 36,
                        }}
                        onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#EBF4EE' }}
                        onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}
                      >
                        {d.getDate()}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Footer: Hoje + limpar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 12px', borderTop: '1px solid #F0EDE8' }}>
              <button
                onClick={() => { onChange(''); setOpen(false) }}
                style={{ fontSize: 12, color: '#B0ADA8', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: '4px 8px', borderRadius: 6, touchAction: 'manipulation' }}
              >
                Limpar
              </button>
              <button
                onClick={goToday}
                style={{ fontSize: 12, fontWeight: 700, color: '#4A7C59', background: '#EBF4EE', border: '1.5px solid #D4E8DA', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: '5px 14px', borderRadius: 20, touchAction: 'manipulation' }}
              >
                Hoje
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── A4 text page (modo canvas, página de texto) ───────────────────────────────
function TextPage({ page, isActive, onTextChange, onClick, sessionDate, onDateChange }) {
  const editorRef = useRef(null)

  useEffect(() => {
    // FE-002 FIX: sanitizar HTML antes de injetar — page.textHtml vem do localStorage/backend
    if (editorRef.current)
      editorRef.current.innerHTML = sanitizeAnnotHtml(page.textHtml)
  }, [page.id]) // só na montagem

  return (
    <div
      id={`page-${page.id}`}
      className="as-page-wrap as-page-text"
      onClick={onClick}
      style={{
        flexShrink: 0, width: PAGE_W, minHeight: PAGE_H,
        background: '#fff', borderRadius: 2,
        boxShadow: isActive
          ? '0 0 0 2.5px #5C8F6A, 0 8px 40px rgba(0,0,0,0.22)'
          : '0 4px 32px rgba(0,0,0,0.18)',
        overflow: 'visible', cursor: 'text',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header — data clínica centralizada, prominente */}
      <div style={{
        padding: '14px 24px 12px',
        borderBottom: '2px solid #F0EDE8',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        flexShrink: 0,
        gap: 8,
        background: '#FDFAF6',
      }}>
        {/* Esquerda: ícone + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C8C2BA" strokeWidth="2" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span style={{ fontSize: 9.5, color: '#C8C2BA', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.6px', textTransform: 'uppercase', fontWeight: 600 }}>
            Sessão clínica
          </span>
        </div>

        {/* Centro: DatePill — data clínica visível no corpo do documento */}
        {onDateChange ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <DatePill value={sessionDate} onChange={onDateChange} />
          </div>
        ) : sessionDate ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#3D6B4A', background: '#EBF4EE', border: '1.5px solid #D4E8DA', borderRadius: 20, padding: '5px 14px', fontFamily: "'DM Sans', sans-serif" }}>
              📅 {sessionDate.split('-').reverse().join('/')}
            </span>
          </div>
        ) : (
          <div />
        )}

        {/* Direita: espaçador */}
        <div />
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Escreva suas observações clínicas aqui…"
        style={{
          flex: 1, padding: '28px 44px 48px',
          minHeight: PAGE_H - 80, outline: 'none',
          fontSize: 15.5, lineHeight: 1.9,
          color: '#1A1F1C', fontFamily: "'DM Sans', sans-serif",
          caretColor: '#4A7C59',
          letterSpacing: '0.01em',
        }}
        onInput={e => onTextChange(page.id, e.currentTarget.innerHTML)}
        onKeyDown={e => {
          if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    ') }
        }}
      />
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AnnotationSession({
  patient,
  isOpen,
  initialPageType = null,   // 'draw' | 'text' — tipo da nova página a adicionar. null = recovery/histórico
  // legacy props mantidos para não quebrar chamadas existentes:
  type,
  initialHtml,
  initialCanvasData,
  onClose,
  onMinimize,
  onAnalyze,
  onAutosave,
  onFetchSession,           // async (sessionId) => canvasData string | null — fallback quando localStorage vazio
  sessionId,
  scrollToSessionId = null, // após carregar, scrolla até a primeira página desta sessão
  viewOnly = false,         // true → visualização histórica: sem autosave, sem badge
}) {
  // Sempre canvas — texto é apenas um tipo de página dentro do canvas
  const isCanvas = true
  const isText   = false

  // ── Data da sessão clínica (editável pelo psicólogo) ─────────────────────
  const todayIso = () => new Date().toISOString().slice(0, 10)
  const metaKey  = sessionId ? `psicoai_meta_s${sessionId}` : null

  const [sessionDate, setSessionDate] = useState(() => {
    if (!metaKey) return todayIso()
    try { const m = JSON.parse(localStorage.getItem(metaKey) || '{}'); return m.sessionDate || todayIso() }
    catch { return todayIso() }
  })

  const handleDateChange = (iso) => {
    setSessionDate(iso)
    if (metaKey) {
      try { localStorage.setItem(metaKey, JSON.stringify({ sessionDate: iso })) } catch {}
    }
  }

  // ── Estado compartilhado ───────────────────────────────────────────────────
  const [showEndModal, setShowEndModal] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [isDirty, setIsDirty]           = useState(false)

  // ── Sidebar: overlay em mobile/tablet, inline em desktop ──────────────────
  // Sempre começa aberta — no mobile mostra a lista de páginas antes do canvas
  const [sidebarOpen, setSidebarOpen]    = useState(true)
  const [isOverlaySidebar, setIsOverlay] = useState(() => window.innerWidth <= 900)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const h = (e) => { setIsOverlay(e.matches); setSidebarOpen(!e.matches) }
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])

  const isTouch = useRef(window.matchMedia('(hover: none) and (pointer: coarse)').matches)

  // ── Estado canvas ──────────────────────────────────────────────────────────
  const [pages, setPages]           = useState(() => [{ id: newPageId(), pageType: 'draw', canvasRef: { current: null }, dataUrl: null, textHtml: null }])
  const [activePage, setActivePage] = useState(0)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const addMenuRef = useRef(null)
  const [sidebarTab, setSidebarTab] = useState('pages') // 'pages' | 'guide'
  const [hoveredPageIdx, setHoveredPageIdx] = useState(-1)

  // ── Estado do fluxo de análise ─────────────────────────────────────────────
  const [analysisStep, setAnalysisStep]         = useState('idle') // 'idle' | 'picker' | 'destination'
  const [selectedPageIds, setSelectedPageIds]   = useState(() => new Set())
  const [analysisRunning, setAnalysisRunning]   = useState(false)
  const [tool, setTool]             = useState('pen')
  const [color, setColor]           = useState('#1C1C1C')
  const [size, setSize]             = useState(3)
  // Undo stack: { [pageId]: string[] } — array de dataUrls
  const undoStackRef = useRef({})
  const redoStackRef = useRef({})

  const [zoom, setZoom] = useState(1.0)

  const toolRef  = useRef(tool)
  const colorRef = useRef(color)
  const sizeRef  = useRef(size)
  const pagesRef = useRef(pages)
  useEffect(() => { toolRef.current  = tool  }, [tool])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { sizeRef.current  = size  }, [size])
  useEffect(() => { pagesRef.current = pages }, [pages])

  // ── Estado texto ───────────────────────────────────────────────────────────
  const [savedIndicator, setSavedIndicator] = useState(false)
  const [backendSyncStatus, setBackendSyncStatus] = useState('idle') // 'idle'|'pending'|'saved'|'error'
  const editorRef       = useRef(null)
  const autosaveRef     = useRef(null)   // timer debounce backend
  const localSaveRef    = useRef(null)
  const patientIdRef    = useRef(patient?.id)
  const pagesRef2           = useRef(null)   // snapshot das pages para flush síncrono no unload
  const isDirtyForBackend   = useRef(false)  // true quando conteúdo mudou e backend ainda não foi atualizado
  useEffect(() => { patientIdRef.current = patient?.id }, [patient?.id])

  // ── Refs compartilhados ────────────────────────────────────────────────────
  const mainScrollRef   = useRef(null)
  const sidebarRef      = useRef(null)
  const sessionIdRef    = useRef(sessionId)
  // Palm rejection: set to true on first pen event — blocks touch (fingers) in canvas
  const penDetectedRef  = useRef(false)
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  // ── Inicializa ao abrir ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !patient?.id) return
    setIsDirty(false)
    setShowEndModal(false)
    penDetectedRef.current = false

    const init = async () => {
      // 1. Tenta localStorage primeiro (rápido, sem latência)
      let saved = loadCanvasPages(sessionId, patient.id)

      // 2. Fallback: se localStorage vazio E há sessionId, busca canvasData do backend
      //    Isso garante recuperação em outros dispositivos ou após limpeza do browser
      if (!saved && sessionId && onFetchSession) {
        try {
          const raw = await onFetchSession(sessionId)
          if (raw) {
            const parsed = (() => { try { return JSON.parse(raw) } catch { return null } })()
            if (Array.isArray(parsed) && parsed.length > 0) {
              saved = parsed
              // Migra para localStorage para próximos acessos ficarem rápidos
              saveCanvasPages(sessionId, patient.id, saved)
            }
          }
        } catch { /* backend indisponível — continua sem dados */ }
      }

      // 3. Fallback: initialCanvasData prop (pre-construído pelo parent — ex: nota rápida sem canvas)
      if (!saved && initialCanvasData) {
        try {
          const parsed = JSON.parse(initialCanvasData)
          if (Array.isArray(parsed) && parsed.length > 0) saved = parsed
        } catch { /* JSON inválido — ignora */ }
      }

      const restored = saved
        ? saved.map(p => ({ id: p.id, pageType: p.pageType || 'draw', canvasRef: { current: null }, dataUrl: p.dataUrl || null, textHtml: p.textHtml || null, sessionId: p.sessionId || null }))
        : []

      if (initialPageType && restored.length > 0) {
        // Nova anotação sobre histórico existente: adiciona nova página ao final (marcada com sessão atual)
        const nova = { id: newPageId(), pageType: initialPageType, canvasRef: { current: null }, dataUrl: null, textHtml: null, sessionId: sessionId || null }
        const all = [...restored, nova]
        setPages(all)
        setActivePage(all.length - 1)
        setTimeout(() => {
          const c = mainScrollRef.current
          if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
        }, 200)
      } else if (restored.length > 0) {
        setPages(restored)
        // Se há sessão alvo, scrolla até a primeira página dela; senão vai pro início
        if (scrollToSessionId) {
          const idx = restored.findIndex(p => p.sessionId === scrollToSessionId)
          const target = idx >= 0 ? idx : 0
          setActivePage(target)
          setTimeout(() => {
            const el = document.getElementById(`page-${restored[target]?.id}`)
            const c  = mainScrollRef.current
            if (el && c) c.scrollTo({ top: el.offsetTop - 32, behavior: 'smooth' })
          }, 250)
        } else {
          setActivePage(0)
        }
      } else {
        // Primeiro acesso ou sem dados recuperáveis: nova página de texto (padrão clínico)
        const nova = { id: newPageId(), pageType: initialPageType || 'text', canvasRef: { current: null }, dataUrl: null, textHtml: null, sessionId: sessionId || null }
        setPages([nova])
        setActivePage(0)
      }
    }

    init()
  }, [isOpen, patient?.id, initialPageType]) // eslint-disable-line

  // ── Autosave backend — debounce 6s + flush no unload/hidden ──────────────────
  // Padrão Google Docs:
  //   1. Toda mudança → localStorage imediato (sem latência visual)
  //   2. 6s de inatividade → backend silencioso (sem spinner)
  //   3. beforeunload + visibilitychange → força flush antes de sair

  const flushToBackend = useCallback(async (pagesSnapshot) => {
    if (!onAutosave || !sessionIdRef.current || !pagesSnapshot) return
    if (!isDirtyForBackend.current) return  // nada mudou desde o último save — não bate na API
    try {
      // Coleta textContent + htmlContent das páginas de texto
      const textPages = pagesSnapshot.filter(p => p.pageType === 'text' && p.textHtml)
      const htmlContent = textPages.map(p => p.textHtml).join('\n\n') || null
      const textContent = htmlContent
        ? (new DOMParser().parseFromString(htmlContent, 'text/html').body.textContent || '').slice(0, 80_000)
        : null
      // Serializa canvas pages para o backend — inclui dataUrl (PNG) para não perder desenhos
      // Se o payload com imagens exceder 4MB, envia sem imagens (melhor do que truncar JSON no meio)
      const pagesWithImages = JSON.stringify(pagesSnapshot.map(p => ({
        id: p.id, pageType: p.pageType, textHtml: p.textHtml || null,
        dataUrl: p.dataUrl || null,  // PNG do desenho — essencial para não perder em crashes
      })))
      const pagesStructureOnly = JSON.stringify(pagesSnapshot.map(p => ({
        id: p.id, pageType: p.pageType, textHtml: p.textHtml || null,
        // dataUrl omitido apenas quando payload total > 4MB
      })))
      const canvasData = pagesWithImages.length <= 4_000_000 ? pagesWithImages : pagesStructureOnly
      await onAutosave(sessionIdRef.current, { textContent, htmlContent, canvasData })
      isDirtyForBackend.current = false  // backend está sincronizado
      setBackendSyncStatus('saved')
      setTimeout(() => setBackendSyncStatus('idle'), 2000)
    } catch {
      setBackendSyncStatus('error')
      // isDirtyForBackend permanece true — próximo flush tentará de novo
    }
  }, [onAutosave])

  // Mantém ref atualizado com pages atuais para o flush síncrono no unload
  useEffect(() => { pagesRef2.current = pages }, [pages])

  // Debounce: 6s após última mudança → flush backend
  const scheduleBackendSave = useCallback((pagesSnapshot) => {
    if (viewOnly) return  // modo visualização: nunca bate no backend
    isDirtyForBackend.current = true  // marca que há mudança pendente
    setBackendSyncStatus('pending')
    clearTimeout(autosaveRef.current)
    autosaveRef.current = setTimeout(() => flushToBackend(pagesSnapshot), 6000)
  }, [flushToBackend, viewOnly])

  // beforeunload + visibilitychange: flush síncrono antes de sair
  useEffect(() => {
    if (!isOpen) return
    const handleUnload = () => {
      clearTimeout(autosaveRef.current)
      // Só flush se: há sessão, há dados e conteúdo realmente mudou desde o último save
      if (onAutosave && sessionIdRef.current && pagesRef2.current && isDirtyForBackend.current) {
        flushToBackend(pagesRef2.current).catch(() => {})
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handleUnload()
    }
    window.addEventListener('beforeunload', handleUnload)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [isOpen, flushToBackend, onAutosave])

  const exec = (cmd, arg) => {
    document.execCommand(cmd, false, arg || null)
  }

  // Insere seção de guia na página de texto ativa (canvas text page)
  const insertGuideSection = (label) => {
    // Usa o elemento focado ou procura o editor da página ativa
    let editor = null
    const active = document.activeElement
    if (active && active.contentEditable === 'true') {
      editor = active
    } else {
      const pageEl = document.getElementById(`page-${pages[activePage]?.id}`)
      editor = pageEl?.querySelector('[contenteditable="true"]')
    }
    if (!editor) return
    editor.focus()
    document.execCommand('insertText', false, (editor.innerText.trim() ? '\n\n' : '') + label + ': ')
  }

  // ── Undo/Redo por página — declarado ANTES de handleStrokeEnd para evitar TDZ na dep array ──
  const pushUndo = useCallback((pageId, dataUrl) => {
    const stack = undoStackRef.current
    if (!stack[pageId]) stack[pageId] = []
    stack[pageId].push(dataUrl)
    if (stack[pageId].length > 15) stack[pageId].shift() // SEC-023: 15 itens ≈ 30MB max vs 80MB com 40
    redoStackRef.current[pageId] = [] // ação nova limpa redo
  }, [])

  // ── Canvas: thumbnail após traço ──────────────────────────────────────────
  const handleStrokeEnd = useCallback((pageId, prevDataUrl) => {
    setIsDirty(true)
    pushUndo(pageId, prevDataUrl || 'blank')
    setPages(prev => {
      const updated = prev.map(p => {
        if (p.id !== pageId) return p
        return { ...p, dataUrl: p.canvasRef.current?.toDataURL('image/png') || p.dataUrl }
      })
      if (patient?.id) saveCanvasPages(sessionIdRef.current, patient.id, updated)
      scheduleBackendSave(updated)
      return updated
    })
  }, [patient?.id, pushUndo, scheduleBackendSave])

  // ── Canvas: nova página ────────────────────────────────────────────────────
  const addPage = useCallback((pageType = 'draw') => {
    const newPage = { id: newPageId(), pageType, canvasRef: { current: null }, dataUrl: null, textHtml: null, sessionId: sessionIdRef.current || null }
    setPages(prev => {
      const next = [...prev, newPage]
      if (patient?.id) saveCanvasPages(sessionIdRef.current, patient.id, next)
      scheduleBackendSave(next) // nova página → backend imediato (6s debounce)
      return next
    })
    setActivePage(p => p + 1)
    setShowAddMenu(false)
    setTimeout(() => {
      const c = mainScrollRef.current
      if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
    }, 80)
  }, [patient?.id, scheduleBackendSave])

  // ── Canvas: apagar página ─────────────────────────────────────────────────
  const deletePage = useCallback((pageId) => {
    setPages(prev => {
      if (prev.length <= 1) return prev
      const deletedIdx = prev.findIndex(p => p.id === pageId)
      if (deletedIdx === -1) return prev
      const next = prev.filter(p => p.id !== pageId)
      if (patient?.id) saveCanvasPages(sessionIdRef.current, patient.id, next)
      scheduleBackendSave(next)
      setActivePage(ap => {
        if (ap > deletedIdx) return ap - 1
        if (ap === deletedIdx) return Math.min(ap, next.length - 1)
        return ap
      })
      return next
    })
    setIsDirty(true)
  }, [patient?.id, scheduleBackendSave])

  // ── Contador de palavras (todas as páginas de texto) ─────────────────────
  const [wordCount, setWordCount] = useState(0)

  // ── Canvas: atualizar texto em página de texto ────────────────────────────
  const handlePageTextChange = useCallback((pageId, html) => {
    setIsDirty(true)
    setPages(prev => {
      const updated = prev.map(p => p.id === pageId ? { ...p, textHtml: html } : p)
      if (patient?.id) saveCanvasPages(sessionIdRef.current, patient.id, updated)
      scheduleBackendSave(updated) // debounce 6s — não salva a cada tecla no backend
      // Recalcula word count de todas as páginas de texto
      const totalText = updated.filter(p => p.pageType === 'text' && p.textHtml)
        .map(p => new DOMParser().parseFromString(p.textHtml, 'text/html').body.textContent || '')
        .join(' ')
      setWordCount(totalText.trim() ? totalText.trim().split(/\s+/).filter(Boolean).length : 0)
      return updated
    })
  }, [patient?.id, scheduleBackendSave])

  // ── Canvas: scroll → página ativa ─────────────────────────────────────────
  // M-2: usa pagesRef para não recriar o handler a cada mudança de páginas
  // C-3: usa el.offsetHeight em vez de PAGE_H para funcionar com CSS scaling no mobile
  const handleScroll = useCallback(() => {
    const c = mainScrollRef.current
    if (!c) return
    const midY = c.scrollTop + c.clientHeight / 2
    let closest = 0, minDist = Infinity
    pagesRef.current.forEach((p, i) => {
      const el = document.getElementById(`page-${p.id}`)
      if (!el) return
      const dist = Math.abs(el.offsetTop + el.offsetHeight / 2 - midY)
      if (dist < minDist) { minDist = dist; closest = i }
    })
    setActivePage(closest)
  }, []) // eslint-disable-line — intencional: usa pagesRef, nunca recria

  useEffect(() => {
    const sb = sidebarRef.current
    if (!sb || !isCanvas) return
    sb.querySelector(`[data-thumb="${activePage}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activePage, isCanvas])

  // ── Click-outside fecha menu "+" ──────────────────────────────────────────
  useEffect(() => {
    if (!showAddMenu) return
    const handler = (e) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target))
        setShowAddMenu(false)
    }
    document.addEventListener('pointerdown', handler, true)
    return () => document.removeEventListener('pointerdown', handler, true)
  }, [showAddMenu])

  // M-1: version counter previne race condition — stale onload de imagem anterior não sobrescreve nova
  const undoVersionRef = useRef(0)

  const handleUndo = useCallback(() => {
    const page = pages[activePage]
    if (!page || page.pageType !== 'draw') return
    const stack = undoStackRef.current[page.id] || []
    if (stack.length === 0) return
    const prev = stack.pop()
    const canvas = page.canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rStack = redoStackRef.current
    if (!rStack[page.id]) rStack[page.id] = []
    rStack[page.id].push(canvas.toDataURL('image/png'))
    if (prev === 'blank') {
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    } else {
      undoVersionRef.current += 1
      const myVersion = undoVersionRef.current
      const img = new Image()
      img.onload = () => {
        if (undoVersionRef.current !== myVersion) return // stale — descarta
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0)
      }
      img.src = prev
    }
    setPages(pr => pr.map(p => p.id === page.id ? { ...p, dataUrl: prev === 'blank' ? null : prev } : p))
    setIsDirty(true)
  }, [pages, activePage])

  const handleRedo = useCallback(() => {
    const page = pages[activePage]
    if (!page || page.pageType !== 'draw') return
    const rStack = redoStackRef.current[page.id] || []
    if (rStack.length === 0) return
    const next = rStack.pop()
    const canvas = page.canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const stack = undoStackRef.current
    if (!stack[page.id]) stack[page.id] = []
    stack[page.id].push(canvas.toDataURL('image/png'))
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
    }
    img.src = next
    setPages(pr => pr.map(p => p.id === page.id ? { ...p, dataUrl: next } : p))
    setIsDirty(true)
  }, [pages, activePage])

  // Keyboard shortcuts: Undo/Redo + Cmd+S (save modal) + Cmd+Enter (finish)
  useEffect(() => {
    if (!isOpen || !isCanvas) return
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); setShowEndModal(true) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); setShowEndModal(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, isCanvas, handleUndo, handleRedo])

  const scrollToPage = (idx) => {
    const c  = mainScrollRef.current
    const el = document.getElementById(`page-${pages[idx]?.id}`)
    if (!c || !el) return
    c.scrollTo({ top: el.offsetTop - 32, behavior: 'smooth' })
    setActivePage(idx)
  }

  // ── Helpers de análise ─────────────────────────────────────────────────────
  const togglePageSel = (id) => setSelectedPageIds(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const handleStartAnalysis = () => {
    // Pré-seleciona página ativa
    setSelectedPageIds(new Set([pages[activePage]?.id].filter(Boolean)))
    // Se só 1 página, pula direto para escolha de destino
    setAnalysisStep(pages.length === 1 ? 'destination' : 'picker')
    setShowEndModal(false)
  }

  const handleAnalyzeWithDest = async (dest) => {
    setAnalysisRunning(true)
    const ids = Array.from(selectedPageIds)
    const data = await exportData(ids.length > 0 ? ids : null)
    setAnalysisRunning(false)
    setAnalysisStep('idle')
    setIsDirty(false)
    onAnalyze({ duration: 0, destination: dest, ...data })
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportData = async (pageIds = null) => {
    // SEC-019: limitar a 6 páginas por export — canvas combinado de 10+ pages = ~340MB heap V8
    const MAX_EXPORT_PAGES = 6
    const targetPages = (pageIds ? pages.filter(p => pageIds.includes(p.id)) : pages).slice(0, MAX_EXPORT_PAGES)
    // Combina as páginas selecionadas em imagem única
    const snaps = targetPages.map(p => ({
      id: p.id,
      dataUrl: p.canvasRef.current?.toDataURL('image/png') || p.dataUrl || null,
    }))
    let imageBase64 = null
    try {
      const combined = document.createElement('canvas')
      combined.width  = PAGE_W * SCALE
      combined.height = snaps.length * PAGE_H * SCALE
      const ctx = combined.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, combined.width, combined.height)
      for (let i = 0; i < snaps.length; i++) {
        if (!snaps[i].dataUrl) continue
        await new Promise(res => {
          const img = new Image()
          img.onload = () => { ctx.drawImage(img, 0, i * PAGE_H * SCALE); res() }
          img.src = snaps[i].dataUrl
        })
      }
      imageBase64 = combined.toDataURL('image/png').split(',')[1]
    } catch (e) { console.warn('[AnnotationSession] export:', e) }

    // C-2: coleta conteúdo de páginas de texto para a IA processar
    const allTextHtml = targetPages
      .filter(p => p.pageType === 'text' && p.textHtml)
      .map(p => p.textHtml)
      .join('<hr/>')

    return {
      imageBase64,
      canvasDataJson: JSON.stringify({ pages: snaps }),
      textContent: allTextHtml ? allTextHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : null,
      htmlContent: allTextHtml || null,
      sessionDate,  // data clínica definida pelo psicólogo — usada pela IA para contexto longitudinal
    }
  }

  const handleSave = async () => {
    setSaving(true)
    const data = await exportData()
    setSaving(false); setShowEndModal(false); setIsDirty(false)
    onClose({ duration: 0, ...data })
  }


  if (!isOpen) return null

  const patientName = patient?.name || 'Paciente'

  // ── Sidebar content ────────────────────────────────────────────────────────
  const SidebarContent = () => {
    if (isCanvas) {
      return (
        <>
          {/* ── Tabs ── */}
          <div style={{
            display: 'flex', width: '100%', flexShrink: 0,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 6,
          }}>
            {[
              { id: 'pages', label: 'Páginas' },
              { id: 'guide', label: 'Guia' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                style={{
                  flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer',
                  background: 'transparent',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.4px',
                  color: sidebarTab === tab.id ? '#9DC4A8' : 'rgba(255,255,255,0.28)',
                  borderBottom: `2px solid ${sidebarTab === tab.id ? '#5C8F6A' : 'transparent'}`,
                  transition: 'color 0.15s, border-color 0.15s',
                  fontFamily: "'DM Sans', sans-serif",
                  textTransform: 'uppercase',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Páginas ── */}
          {sidebarTab === 'pages' && (
            <>
              {/* Contador de páginas — ajuda na orientação com muitas páginas */}
              {pages.length > 1 && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '2px 0 6px', letterSpacing: '0.3px' }}>
                  {pages.length} páginas
                </div>
              )}
              {pages.map((p, i) => (
                <div
                  key={p.id}
                  data-thumb={i}
                  onMouseEnter={() => setHoveredPageIdx(i)}
                  onMouseLeave={() => setHoveredPageIdx(-1)}
                  onClick={() => { scrollToPage(i); if (isOverlaySidebar) setSidebarOpen(false) }}
                  style={{
                    width: '100%', cursor: 'pointer',
                    background: hoveredPageIdx === i && activePage !== i
                      ? 'rgba(255,255,255,0.06)'
                      : activePage === i ? 'rgba(74,124,89,0.3)' : 'transparent',
                    borderLeft: `2px solid ${activePage === i ? '#5C8F6A' : 'transparent'}`,
                    padding: '8px 0',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'background 0.15s',
                    position: 'relative',
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 72, height: 102, background: '#fff', borderRadius: 2, overflow: 'hidden',
                      border: `1.5px solid ${activePage === i ? '#5C8F6A' : 'rgba(255,255,255,0.15)'}`,
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {p.pageType === 'text'
                        ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, width: '100%' }}>
                            {[60, 80, 70, 50].map((w, j) => (
                              <div key={j} style={{ height: 3, borderRadius: 2, background: '#E8E5E0', width: `${w}%` }} />
                            ))}
                          </div>
                        : p.dataUrl
                          ? <img src={p.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                          : <div style={{ width: '100%', height: '100%', background: '#fff' }} />
                      }
                    </div>
                    {/* Botão apagar — aparece no hover, oculto se só 1 página */}
                    {hoveredPageIdx === i && pages.length > 1 && (
                      <button
                        onClick={e => { e.stopPropagation(); deletePage(p.id) }}
                        title="Apagar página"
                        style={{
                          position: 'absolute', top: 3, right: 3,
                          width: 22, height: 22, borderRadius: 4,
                          background: 'rgba(192,57,43,0.88)',
                          border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          zIndex: 5,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(192,57,43,1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(192,57,43,0.88)' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: activePage === i ? '#9DC4A8' : 'rgba(255,255,255,0.35)' }}>
                    {i + 1}
                  </span>
                </div>
              ))}

              {/* Add page buttons */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={() => addPage('draw')}
                  title="Nova página de desenho"
                  style={{
                    width: 44, height: 34,
                    border: '1.5px dashed rgba(255,255,255,0.2)',
                    borderRadius: 4, background: 'transparent',
                    color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#5C8F6A'; e.currentTarget.style.color = '#5C8F6A'; e.currentTarget.style.background = 'rgba(74,124,89,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                  </svg>
                </button>
                <button
                  onClick={() => addPage('text')}
                  title="Nova página de texto"
                  style={{
                    width: 44, height: 34,
                    border: '1.5px dashed rgba(255,255,255,0.2)',
                    borderRadius: 4, background: 'transparent',
                    color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#5C8F6A'; e.currentTarget.style.color = '#5C8F6A'; e.currentTarget.style.background = 'rgba(74,124,89,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.background = 'transparent' }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
                  </svg>
                </button>
              </div>
            </>
          )}

          {/* ── Tab: Guia ── */}
          {sidebarTab === 'guide' && (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 6px 0' }}>
              {GUIDE.map(g => (
                <button key={g.label} title={g.hint}
                  onClick={() => {
                    insertGuideSection(g.label)
                    if (isOverlaySidebar) setSidebarOpen(false)
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 8, padding: '8px 8px', cursor: 'pointer',
                    textAlign: 'left', fontFamily: "'DM Sans', sans-serif", width: '100%',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  <div style={{ fontSize: 14, marginBottom: 3 }}>{g.icon}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, fontWeight: 500 }}>{g.label}</div>
                </button>
              ))}
              <div style={{ marginTop: 8, fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.5, padding: '0 4px' }}>
                Toque num item para inserir na página de texto ativa
              </div>
            </div>
          )}
        </>
      )
    }

    return null
  }

  // ── Toolbar content ────────────────────────────────────────────────────────
  // Página ativa é de texto? (sessão canvas com página de tipo texto)
  const activePageIsText = pages[activePage]?.pageType === 'text'

  const ToolbarContent = () => {
    // Canvas mode: toolbar muda conforme o tipo da página ativa
    if (isCanvas && activePageIsText) {
      // Toolbar de formatação para página de texto dentro de uma sessão canvas
      return (
        <>
          <button title="Negrito"
            onMouseDown={e => { e.preventDefault(); document.execCommand('bold') }}
            style={{ width: 36, height: 36, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'rgba(255,255,255,0.6)', transition: 'all 0.12s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
          ><strong style={{ fontFamily: 'inherit' }}>B</strong></button>
          <button title="Itálico"
            onMouseDown={e => { e.preventDefault(); document.execCommand('italic') }}
            style={{ width: 36, height: 36, border: 'none', borderRadius: 8, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: 'rgba(255,255,255,0.6)', transition: 'all 0.12s', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
          ><em style={{ fontFamily: 'inherit' }}>I</em></button>
          <Sep />
          {/* Botão de nova página no canto direito */}
          <div ref={addMenuRef} style={{ marginLeft: 'auto', display: 'flex', gap: 6, position: 'relative' }}>
            <TBtn active={showAddMenu} onClick={() => setShowAddMenu(p => !p)} title="Nova página">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </TBtn>
            {showAddMenu && <AddPageMenu onAddPage={addPage} />}
          </div>
        </>
      )
    }

    if (isCanvas) {
      const SHAPES = [
        { id: 'rect',    title: 'Retângulo',
          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="18" height="12" rx="1.5"/></svg> },
        { id: 'circle',  title: 'Elipse',
          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="12" rx="9" ry="6.5"/></svg> },
        { id: 'diamond', title: 'Losango (decisão)',
          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3L21 12L12 21L3 12Z"/></svg> },
        { id: 'arrow',   title: 'Seta',
          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/></svg> },
        { id: 'line',    title: 'Linha',
          icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="20" x2="20" y2="4"/></svg> },
      ]
      return (
        <>
          <TBtn active={tool === 'pen'} onClick={() => setTool('pen')} title="Caneta">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
            </svg>
          </TBtn>
          <TBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Borracha">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 20H7L3 16l10-10 7 7-1.5 1.5"/>
              <path d="M6 20l-3-3 10-10"/>
            </svg>
          </TBtn>

          <Sep />

          {/* Shape tools */}
          {SHAPES.map(s => (
            <TBtn key={s.id} active={tool === s.id} onClick={() => setTool(s.id)} title={s.title}>
              {s.icon}
            </TBtn>
          ))}

          <Sep />

          {COLORS.map(c => (
            <button key={c}
              onClick={() => { setColor(c); if (!SHAPE_TOOLS.includes(tool)) setTool('pen') }}
              title={c}
              style={{
                // 44×44 tap target wrapping a 22px dot — WCAG minimum
                width: 44, height: 44, borderRadius: 8, background: 'transparent',
                border: 'none', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: c, flexShrink: 0,
                boxShadow: color === c && (tool === 'pen' || SHAPE_TOOLS.includes(tool)) ? `0 0 0 2px #1A1A1A, 0 0 0 3.5px ${c}` : 'none',
                transition: 'box-shadow 0.15s',
              }} />
            </button>
          ))}

          <Sep />

          {/* Tamanhos: pen usa 2/4/8, eraser usa os maiores também */}
          {(tool === 'eraser' ? [4, 12, 24, 40] : [2, 4, 8]).map(s => (
            <button key={s} onClick={() => setSize(s)} title={`Espessura ${s}`}
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: size === s ? 'rgba(255,255,255,0.12)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              <div style={{
                width: Math.min(s * (tool === 'eraser' ? 0.6 : 2.5), 26),
                height: Math.min(s * (tool === 'eraser' ? 0.6 : 2.5), 26),
                borderRadius: tool === 'eraser' ? 3 : '50%',
                background: tool === 'eraser' ? 'rgba(255,255,255,0.3)' : color,
                border: tool === 'eraser' ? '1.5px solid rgba(255,255,255,0.4)' : 'none',
              }} />
            </button>
          ))}

          <Sep />

          {/* Undo/Redo */}
          <TBtn active={false} onClick={handleUndo} title="Desfazer (Ctrl+Z)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
            </svg>
          </TBtn>
          <TBtn active={false} onClick={handleRedo} title="Refazer (Ctrl+Y)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
            </svg>
          </TBtn>

          <Sep />

          {/* Zoom controls — PC não tem pinch, tablet/mobile já têm */}
          <TBtn active={false} onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(1)))} title="Reduzir zoom (–)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </TBtn>
          <button
            onClick={() => setZoom(1.0)}
            title="Zoom 100%"
            style={{
              minWidth: 38, height: 28, borderRadius: 6, border: 'none',
              background: zoom !== 1.0 ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: zoom !== 1.0 ? '#fff' : 'rgba(255,255,255,0.45)',
              cursor: 'pointer', fontSize: 10, fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.3px',
              flexShrink: 0, transition: 'all 0.15s',
            }}
          >
            {Math.round(zoom * 100)}%
          </button>
          <TBtn active={false} onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(1)))} title="Aumentar zoom (+)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
          </TBtn>

          <div ref={addMenuRef} style={{ marginLeft: 'auto', display: 'flex', gap: 6, position: 'relative' }}>
            <TBtn active={showAddMenu} onClick={() => setShowAddMenu(p => !p)} title="Nova página">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </TBtn>
            {showAddMenu && <AddPageMenu onAddPage={addPage} />}
          </div>
        </>
      )
    }

    // Texto: formatação — botão simples reutilizável
    const FBtn = ({ cmd, arg, icon, title, onMD }) => (
      <button title={title}
        onMouseDown={e => { e.preventDefault(); onMD ? onMD() : exec(cmd, arg) }}
        style={{
          width: 36, height: 36, border: 'none', borderRadius: 8,
          background: 'transparent', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, color: 'rgba(255,255,255,0.6)', transition: 'all 0.12s',
          flexShrink: 0, touchAction: 'manipulation',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
      >{icon}</button>
    )

    // Cores de texto clínicas (verde, vermelho, roxo, cinza)
    const TEXT_COLORS = [
      { c: '#2D6A4F', label: 'Verde' },
      { c: '#C0392B', label: 'Vermelho' },
      { c: '#7D3C98', label: 'Roxo' },
      { c: '#1C1C1C', label: 'Preto' },
    ]

    return (
      <>
        {/* Grupo 1: peso/estilo */}
        <FBtn cmd="bold"          title="Negrito (Ctrl+B)"    icon={<strong style={{ fontFamily: 'inherit', fontSize: 14 }}>B</strong>} />
        <FBtn cmd="italic"        title="Itálico (Ctrl+I)"    icon={<em style={{ fontFamily: 'inherit', fontSize: 14 }}>I</em>} />
        <FBtn cmd="underline"     title="Sublinhado (Ctrl+U)" icon={<u style={{ fontFamily: 'inherit', fontSize: 13 }}>U</u>} />
        <FBtn cmd="strikeThrough" title="Tachado"             icon={<s style={{ fontFamily: 'inherit', fontSize: 13 }}>S</s>} />

        <Sep />

        {/* Grupo 2: títulos */}
        <FBtn cmd="formatBlock" arg="h1" title="Título grande (H1)"
          icon={<span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '-0.3px' }}>H1</span>} />
        <FBtn cmd="formatBlock" arg="h2" title="Título médio (H2)"
          icon={<span style={{ fontWeight: 700, fontSize: 12 }}>H2</span>} />
        <FBtn cmd="formatBlock" arg="h3" title="Título pequeno (H3)"
          icon={<span style={{ fontWeight: 600, fontSize: 11 }}>H3</span>} />
        <FBtn cmd="formatBlock" arg="p" title="Parágrafo normal"
          icon={<span style={{ fontSize: 11, opacity: 0.8 }}>¶</span>} />

        <Sep />

        {/* Grupo 3: listas e indent */}
        <FBtn cmd="insertUnorderedList" title="Lista com marcadores"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
            <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>} />
        <FBtn cmd="insertOrderedList" title="Lista numerada"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/>
            <line x1="10" y1="18" x2="21" y2="18"/>
            <path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
          </svg>} />
        <FBtn cmd="indent"  title="Aumentar recuo (Tab)"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 8 7 12 3 16"/><line x1="21" y1="12" x2="11" y2="12"/>
            <line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="18" x2="3" y2="18"/>
          </svg>} />
        <FBtn cmd="outdent" title="Diminuir recuo"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="7 8 3 12 7 16"/><line x1="21" y1="12" x2="11" y2="12"/>
            <line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="18" x2="3" y2="18"/>
          </svg>} />

        <Sep />

        {/* Grupo 4: alinhamento */}
        <FBtn cmd="justifyLeft"   title="Alinhar esquerda"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/>
            <line x1="3" y1="18" x2="18" y2="18"/>
          </svg>} />
        <FBtn cmd="justifyCenter" title="Centralizar"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/>
            <line x1="4" y1="18" x2="20" y2="18"/>
          </svg>} />

        <Sep />

        {/* Grupo 5: cores de texto */}
        {TEXT_COLORS.map(({ c, label }) => (
          <button key={c} title={`Cor: ${label}`}
            onMouseDown={e => { e.preventDefault(); exec('foreColor', c) }}
            style={{
              width: 32, height: 32, borderRadius: 8, border: 'none',
              background: 'transparent', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.12s', touchAction: 'manipulation',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontWeight: 800, fontSize: 14, color: c, fontFamily: 'inherit', lineHeight: 1 }}>A</span>
          </button>
        ))}

        {/* Highlight amarelo */}
        <button title="Destacar (amarelo)"
          onMouseDown={e => { e.preventDefault(); exec('hiliteColor', '#FFF176') }}
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: 'transparent', cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.12s', touchAction: 'manipulation',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          <span style={{ fontWeight: 800, fontSize: 14, color: '#1C1C1C', background: '#FFF176', padding: '0 2px', lineHeight: 1, borderRadius: 2, fontFamily: 'inherit' }}>A</span>
        </button>

        <Sep />

        {/* Grupo 6: limpar + zoom */}
        <FBtn cmd="removeFormat" title="Limpar formatação"
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            <line x1="15" y1="5" x2="19" y2="9"/>
            <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="1.5" opacity="0.4"/>
          </svg>} />

        {/* Zoom (igual ao canvas) */}
        <Sep />
        <TBtn active={false} onClick={() => setZoom(z => Math.max(0.4, +(z - 0.1).toFixed(1)))} title="Reduzir zoom">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </TBtn>
        <button onMouseDown={e => { e.preventDefault(); setZoom(1.0) }} title="Zoom 100%"
          style={{
            minWidth: 38, height: 28, borderRadius: 6, border: 'none',
            background: zoom !== 1.0 ? 'rgba(255,255,255,0.12)' : 'transparent',
            color: zoom !== 1.0 ? '#fff' : 'rgba(255,255,255,0.45)',
            cursor: 'pointer', fontSize: 10, fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.3px',
            flexShrink: 0, transition: 'all 0.15s',
          }}>
          {Math.round(zoom * 100)}%
        </button>
        <TBtn active={false} onClick={() => setZoom(z => Math.min(2.5, +(z + 0.1).toFixed(1)))} title="Aumentar zoom">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </TBtn>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Indicador de sync backend — discreto, no canto */}
          {onAutosave && backendSyncStatus !== 'idle' && (
            <span style={{
              fontSize: 10, display: 'flex', alignItems: 'center', gap: 3,
              color: backendSyncStatus === 'saved' ? '#5C8F6A'
                   : backendSyncStatus === 'error' ? '#E88'
                   : 'rgba(255,255,255,0.25)',
              transition: 'color 0.3s',
            }}>
              {backendSyncStatus === 'pending' && (
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.2s ease-in-out infinite' }} />
              )}
              {backendSyncStatus === 'saved' && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
              {backendSyncStatus === 'error' && '!'}
              <span className="as-kbd-hint">
                {backendSyncStatus === 'pending' ? 'salvando…' : backendSyncStatus === 'saved' ? 'salvo' : 'erro ao salvar'}
              </span>
            </span>
          )}
          <span className="as-kbd-hint" style={{
            fontSize: 10, color: savedIndicator ? '#5C8F6A' : 'rgba(255,255,255,0.28)',
            display: 'flex', alignItems: 'center', gap: 4, transition: 'color 0.3s',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block', flexShrink: 0 }} />
            {savedIndicator ? 'Salvo' : 'Ctrl+B · Ctrl+I'}
          </span>
        </div>
      </>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
      background: '#1E1E1E',
      // iOS notch: fixed elements start at physical y=0 (behind status bar)
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        height: 52, flexShrink: 0,
        background: '#2D4A38',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {/* Toggle sidebar */}
        <button
          onClick={() => setSidebarOpen(p => !p)}
          title={sidebarOpen ? 'Ocultar painel' : isCanvas ? 'Mostrar páginas' : 'Guia de anotação'}
          style={{
            width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
            background: sidebarOpen ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>

        {/* Minimizar */}
        {onMinimize && (
          <button onClick={onMinimize} title="Minimizar"
            style={{
              width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        )}

        {/* Nome + tipo — minWidth:0 + overflow:hidden evita empurrar os botões direitos para fora */}
        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
          <span style={{ opacity: 0.5, flexShrink: 0 }}>Ψ</span>
          <span className="as-patient-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patientName}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, flexShrink: 0,
            background: activePageIsText ? 'rgba(255,255,255,0.12)' : 'rgba(125,60,152,0.3)',
            color: activePageIsText ? 'rgba(255,255,255,0.6)' : '#C39BD3',
            letterSpacing: '0.5px', textTransform: 'uppercase',
          }}>
            {activePageIsText ? 'TEXTO' : 'CANVAS'}
          </span>
          {pages.length > 1 && (
            <span className="as-page-count" style={{ fontSize: 11, background: 'rgba(255,255,255,0.12)', padding: '2px 6px', borderRadius: 20, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
              {activePage + 1}/{pages.length}
            </span>
          )}
        </div>

        {/* Data da sessão — sempre visível no header, independente do tipo de página */}
        {!viewOnly && (
          <div style={{ flexShrink: 0 }}>
            <DatePill value={sessionDate} onChange={handleDateChange} />
          </div>
        )}

        {/* Auto-save indicator — sempre visível no header */}
        {onAutosave && backendSyncStatus !== 'idle' ? (
          <span style={{
            fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
            color: backendSyncStatus === 'saved' ? '#7DC499'
                 : backendSyncStatus === 'error' ? '#E88'
                 : 'rgba(255,255,255,0.35)',
            transition: 'color 0.3s',
          }}>
            {backendSyncStatus === 'pending' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1.2s ease-in-out infinite' }} />}
            {backendSyncStatus === 'saved' && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
            {backendSyncStatus === 'error' && '!'}
            {backendSyncStatus === 'pending' ? 'salvando…' : backendSyncStatus === 'saved' ? 'salvo' : 'erro'}
          </span>
        ) : isDirty ? (
          <span style={{ fontSize: 10, color: 'rgba(240,165,0,0.7)', flexShrink: 0 }}>rascunho</span>
        ) : null}
        {/* Word count — visível quando há páginas de texto */}
        {wordCount > 0 && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', flexShrink: 0, whiteSpace: 'nowrap' }}>
            {wordCount} {wordCount === 1 ? 'palavra' : 'palavras'}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* Analisar com IA */}
          <button
            onClick={handleStartAnalysis}
            style={{
              padding: '7px 14px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8, color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6,
              touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.16)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <span className="as-btn-txt as-analyze-txt">Analisar</span>
          </button>
          {/* Salvar */}
          <button
            onClick={() => setShowEndModal(true)}
            style={{
              padding: '7px 18px', background: '#4A7C59', border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.15s',
              touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#3D6B4A'}
            onMouseLeave={e => e.currentTarget.style.background = '#4A7C59'}
          >
            <span className="as-btn-txt">Salvar</span>
            <span className="as-btn-full-txt"> anotação</span>
          </button>
          {/* Fechar — abre modal de salvamento para não perder rascunho */}
          <button
            onClick={() => setShowEndModal(true)}
            title="Fechar sessão"
            style={{
              width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(192,57,43,0.25)'; e.currentTarget.style.borderColor = 'rgba(192,57,43,0.5)'; e.currentTarget.style.color = '#E88' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Backdrop overlay sidebar */}
        {isOverlaySidebar && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: 'absolute', inset: 0, zIndex: 15,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(1px)',
            }}
          />
        )}

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className="as-sidebar"
          style={isOverlaySidebar ? {
            position: 'absolute', left: 0, top: 0, bottom: 0,
            width: isCanvas ? 120 : 160, zIndex: 20,
            background: '#161616',
            overflowY: 'auto', overflowX: 'hidden',
            display: 'flex', flexDirection: 'column',
            alignItems: isCanvas ? 'center' : 'stretch',
            padding: isCanvas ? '12px 0 16px' : 0,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.22s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: sidebarOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none',
          } : {
            width: sidebarOpen ? (isCanvas ? 120 : 160) : 0,
            flexShrink: 0, background: '#161616',
            overflowY: sidebarOpen ? 'auto' : 'hidden', overflowX: 'hidden',
            display: 'flex', flexDirection: 'column',
            alignItems: isCanvas ? 'center' : 'stretch',
            padding: sidebarOpen ? (isCanvas ? '12px 0 16px' : 0) : 0,
            transition: 'width 0.2s ease, padding 0.2s ease',
          }}
        >
          {SidebarContent()}
        </div>

        {/* Área principal */}
        <div
          ref={mainScrollRef}
          onScroll={isCanvas ? handleScroll : undefined}
          onWheel={e => {
            // Ctrl+scroll ou ⌘+scroll → zoom do canvas (não faz scroll)
            if (!e.ctrlKey && !e.metaKey) return
            e.preventDefault()
            const delta = e.deltaY > 0 ? -0.1 : 0.1
            setZoom(z => Math.min(2.5, Math.max(0.4, +(z + delta).toFixed(1))))
          }}
          className="as-main"
          style={{
            flex: 1, overflowY: 'auto', overflowX: 'auto',
            background: '#2A2A2A',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 24px 80px',
            overscrollBehavior: 'contain', // prevents iOS rubber-band from disrupting drawing
          }}
        >
          {/* zoom: CSS zoom property altera layout (scroll correto), diferente de transform:scale */}
          {/* width:100% necessário: sem isso, min(794px,100%) resolve para 794px sempre (circular) */}
          <div style={{ zoom: zoom, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32, width: '100%' }}>
            {pages.map((p, i) => (
              p.pageType === 'text'
                ? <TextPage
                    key={p.id} page={p}
                    isActive={activePage === i}
                    onTextChange={handlePageTextChange}
                    onClick={() => setActivePage(i)}
                    sessionDate={sessionDate}
                    onDateChange={handleDateChange}
                  />
                : <CanvasPage
                    key={p.id} page={p}
                    isActive={activePage === i}
                    toolRef={toolRef} colorRef={colorRef} sizeRef={sizeRef}
                    onStrokeEnd={handleStrokeEnd}
                    onClick={() => setActivePage(i)}
                    penDetectedRef={penDetectedRef}
                  />
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="as-toolbar" style={{
        // A-2: height TOTAL inclui safe-area-inset-bottom para não sobrepor home indicator
        height: 'calc(56px + env(safe-area-inset-bottom, 0px))',
        flexShrink: 0,
        background: '#1A1A1A',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', gap: 4,
        padding: '0 12px', paddingTop: 0,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        overflowX: 'auto',
      }}>
        {ToolbarContent()}
      </div>

      {/* ── Modal salvar / analisar ──────────────────────────────────────── */}
      {showEndModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16, touchAction: 'none',
        }}>
          <div style={{
            background: '#fff', borderRadius: 16, width: '100%', maxWidth: 440,
            maxHeight: 'min(90dvh,90vh)', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          }}>
            <div style={{ padding: '24px 24px 16px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: '#1C1C1C', marginBottom: 6 }}>
                Salvar anotação
              </div>
              <div style={{ fontSize: 13, color: '#8B8B8B', lineHeight: 1.6 }}>
                {patientName} · {pages.length} página{pages.length > 1 ? 's' : ''}
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleStartAnalysis} disabled={saving}
                style={{
                  width: '100%', padding: 16, border: '2px solid var(--g300)',
                  borderRadius: 12, background: 'var(--g50)', cursor: saving ? 'wait' : 'pointer',
                  textAlign: 'left', fontFamily: "'DM Sans', sans-serif",
                  opacity: saving ? 0.7 : 1, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = 'var(--g100)'; e.currentTarget.style.borderColor = 'var(--g400)' }}}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--g50)'; e.currentTarget.style.borderColor = 'var(--g300)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  {saving
                    ? <span style={{ width: 16, height: 16, border: '2px solid var(--g300)', borderTopColor: 'var(--g600)', borderRadius: '50%', display: 'inline-block', animation: 'as-spin 0.8s linear infinite', flexShrink: 0 }} />
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2" style={{ flexShrink: 0 }}>
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                  }
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--g700)' }}>
                    {saving ? 'Analisando…' : 'Analisar com IA'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--g600)', lineHeight: 1.5, paddingLeft: 26 }}>
                  A IA analisa suas anotações e devolve hipóteses diagnósticas, padrões e alertas de risco.
                </div>
              </button>

              <button
                onClick={handleSave} disabled={saving}
                style={{
                  width: '100%', padding: '14px 16px', border: '1px solid var(--gr2)',
                  borderRadius: 12, background: 'var(--w)', cursor: 'pointer',
                  textAlign: 'left', fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--w)'}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--d)', marginBottom: 3 }}>Só salvar</div>
                <div style={{ fontSize: 12, color: 'var(--gr5)' }}>Salva no prontuário. Você pode analisar com IA depois.</div>
              </button>

              <button onClick={() => setShowEndModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--gr4)', fontSize: 12, cursor: 'pointer', padding: 4, fontFamily: "'DM Sans', sans-serif" }}>
                ← Continuar anotando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Fluxo de análise — bottom sheet ──────────────────────────── */}
      {analysisStep !== 'idle' && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 20,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            backdropFilter: 'blur(2px)',
          }}
          onClick={() => { if (!analysisRunning) setAnalysisStep('idle') }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1A1A1A', borderRadius: '20px 20px 0 0',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
              maxHeight: '85dvh', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
              animation: 'as-slideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.55)',
            }}
          >
            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.18)' }} />
            </div>

            {/* ─ STEP: picker ─ */}
            {analysisStep === 'picker' && (
              <>
                <div style={{ padding: '8px 20px 14px' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                    Quais páginas analisar?
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    Toque para selecionar · {selectedPageIds.size} selecionada{selectedPageIds.size !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Shortcut pills */}
                <div style={{ display: 'flex', gap: 8, padding: '0 20px 14px' }}>
                  <button
                    onClick={() => setSelectedPageIds(new Set(pages.map(p => p.id)))}
                    style={{
                      padding: '6px 14px', borderRadius: 20,
                      background: selectedPageIds.size === pages.length ? '#4A7C59' : 'rgba(255,255,255,0.1)',
                      border: 'none', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                  >
                    Todas ({pages.length})
                  </button>
                  <button
                    onClick={() => setSelectedPageIds(new Set([pages[activePage]?.id].filter(Boolean)))}
                    style={{
                      padding: '6px 14px', borderRadius: 20,
                      background: selectedPageIds.size === 1 && selectedPageIds.has(pages[activePage]?.id)
                        ? '#4A7C59' : 'rgba(255,255,255,0.1)',
                      border: 'none', color: '#fff', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                  >
                    Só esta
                  </button>
                </div>

                {/* Thumbnails — horizontal scroll */}
                <div style={{
                  display: 'flex', gap: 10, overflowX: 'auto',
                  padding: '4px 20px 20px',
                  scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch',
                }}>
                  {pages.map((p, i) => {
                    const sel = selectedPageIds.has(p.id)
                    return (
                      <button
                        key={p.id}
                        onClick={() => togglePageSel(p.id)}
                        style={{
                          flexShrink: 0, width: 80, height: 113,
                          border: `2.5px solid ${sel ? '#5C8F6A' : 'rgba(255,255,255,0.12)'}`,
                          borderRadius: 8, overflow: 'hidden',
                          background: '#fff', cursor: 'pointer', position: 'relative',
                          scrollSnapAlign: 'start', transition: 'border-color 0.15s, transform 0.12s',
                          padding: 0, transform: sel ? 'scale(1.04)' : 'scale(1)',
                        }}
                      >
                        {p.pageType === 'text'
                          ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, background: '#fff', height: '100%' }}>
                              {[60, 80, 70, 50, 65, 75, 55].map((w, j) => (
                                <div key={j} style={{ height: 2.5, borderRadius: 2, background: '#E0DDD8', width: `${w}%` }} />
                              ))}
                            </div>
                          : p.dataUrl
                            ? <img src={p.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            : <div style={{ width: '100%', height: '100%', background: '#F5F3F0' }} />
                        }
                        {/* Page number */}
                        <div style={{
                          position: 'absolute', bottom: 4, right: 4,
                          fontSize: 9, fontWeight: 700,
                          color: sel ? '#4A7C59' : 'rgba(0,0,0,0.3)',
                          background: 'rgba(255,255,255,0.92)', borderRadius: 3, padding: '1px 4px',
                        }}>
                          {i + 1}
                        </div>
                        {/* Check overlay */}
                        {sel && (
                          <div style={{
                            position: 'absolute', inset: 0, background: 'rgba(74,124,89,0.16)',
                            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                            padding: 5,
                          }}>
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%', background: '#4A7C59',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                            </div>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* CTA */}
                <div style={{ padding: '0 20px 20px', display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setAnalysisStep('idle')}
                    style={{
                      padding: '13px 16px', borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'transparent', color: 'rgba(255,255,255,0.45)',
                      fontSize: 13, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => setAnalysisStep('destination')}
                    disabled={selectedPageIds.size === 0}
                    style={{
                      flex: 1, padding: '13px 20px', borderRadius: 12,
                      background: selectedPageIds.size === 0 ? 'rgba(255,255,255,0.08)' : '#4A7C59',
                      border: 'none', color: '#fff',
                      fontSize: 14, fontWeight: 700,
                      cursor: selectedPageIds.size === 0 ? 'not-allowed' : 'pointer',
                      transition: 'background 0.15s',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    Continuar · {selectedPageIds.size} pág{selectedPageIds.size !== 1 ? 's' : ''} →
                  </button>
                </div>
              </>
            )}

            {/* ─ STEP: destination ─ */}
            {analysisStep === 'destination' && (
              <>
                <div style={{ padding: '8px 20px 14px' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 3 }}>
                    Onde ver a análise?
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    {pages.length > 1
                      ? `${selectedPageIds.size} página${selectedPageIds.size !== 1 ? 's' : ''} selecionada${selectedPageIds.size !== 1 ? 's' : ''}`
                      : 'Página atual · análise clínica com IA'
                    }
                  </div>
                </div>

                <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
                  {[
                    { dest: 'here',     icon: '🔍', title: 'Ver aqui',           desc: 'A análise abre nesta tela assim que ficar pronta' },
                    { dest: 'analyses', icon: '📊', title: 'Ir para análises',   desc: 'Navega para a seção de análises com o resultado aberto' },
                    { dest: 'later',    icon: '⏱', title: 'Mais tarde',          desc: 'Salva e avisa com uma notificação quando estiver pronto' },
                  ].map(opt => (
                    <button
                      key={opt.dest}
                      onClick={() => { if (!analysisRunning) handleAnalyzeWithDest(opt.dest) }}
                      disabled={analysisRunning}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 16px', borderRadius: 14,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1.5px solid rgba(255,255,255,0.1)',
                        cursor: analysisRunning ? 'wait' : 'pointer',
                        textAlign: 'left', transition: 'all 0.15s',
                        opacity: analysisRunning ? 0.6 : 1,
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                      onMouseEnter={e => { if (!analysisRunning) { e.currentTarget.style.background = 'rgba(74,124,89,0.16)'; e.currentTarget.style.borderColor = '#4A7C59' }}}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
                    >
                      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{opt.title}</div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>{opt.desc}</div>
                      </div>
                      {analysisRunning
                        ? <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.18)', borderTopColor: '#5C8F6A', borderRadius: '50%', display: 'inline-block', animation: 'as-spin 0.8s linear infinite', flexShrink: 0 }} />
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
                      }
                    </button>
                  ))}

                  {pages.length > 1 && (
                    <button
                      onClick={() => { if (!analysisRunning) setAnalysisStep('picker') }}
                      disabled={analysisRunning}
                      style={{
                        background: 'none', border: 'none',
                        color: 'rgba(255,255,255,0.35)', fontSize: 12,
                        cursor: 'pointer', padding: '6px 0', textAlign: 'center',
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      ← Mudar seleção de páginas
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes as-spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }
        @keyframes as-slideUp {
          from { transform: translateY(100%); opacity: 0.6 }
          to   { transform: translateY(0);    opacity: 1 }
        }

        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder); color: #B0ADA8; pointer-events: none;
        }
        [contenteditable] h1 {
          font-size: 26px; font-weight: 800;
          color: #1C1C1C; margin: 24px 0 10px; line-height: 1.2;
          border-bottom: 2px solid #E8E5E0; padding-bottom: 6px;
        }
        [contenteditable] h2 {
          font-size: 20px; font-weight: 700;
          color: #2A2A2A; margin: 20px 0 8px; line-height: 1.3;
        }
        [contenteditable] h3 {
          font-size: 16px; font-weight: 600;
          color: #3A3A3A; margin: 16px 0 6px; line-height: 1.4;
        }
        [contenteditable] ul { padding-left: 22px; margin: 8px 0; list-style: disc; }
        [contenteditable] ol { padding-left: 22px; margin: 8px 0; list-style: decimal; }
        [contenteditable] li { margin-bottom: 4px; }
        [contenteditable] strong { font-weight: 700; }
        [contenteditable] em { font-style: italic; }
        [contenteditable] u { text-decoration: underline; }
        [contenteditable] s { text-decoration: line-through; opacity: 0.6; }
        [contenteditable] blockquote {
          border-left: 3px solid #4A7C59; margin: 10px 0; padding: 4px 12px;
          color: #555; font-style: italic;
        }

        .as-sidebar::-webkit-scrollbar { width: 3px }
        .as-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px }
        .as-toolbar::-webkit-scrollbar { display: none }

        @media (hover: none) { .as-kbd-hint { display: none } }

        @media (max-width: 640px) {
          .as-main { padding: 16px 10px 80px !important; gap: 20px !important; }
        }
        @media (max-width: 900px) {
          .as-main { padding: 20px 14px 80px !important; }
        }

        /* ── Responsive A4 page scaling ─────────────────────────────────────
           On narrow viewports the 794px page overflows. Scale it down.
           zoom div agora tem width:100%, então 100% aqui resolve para o
           espaço disponível do container (corretamente).

           Canvas: escala com aspect-ratio (proporção A4 mantida)
           Texto: largura escala, altura cresce livremente com conteúdo     */
        @media (max-width: 860px) {
          .as-page-wrap {
            width: min(794px, 100%) !important;
            height: auto !important;
            min-height: unset !important;
          }
          /* Canvas: mantém proporção A4, overflow hidden para não vazar desenhos */
          .as-page-canvas {
            aspect-ratio: 794 / 1123;
            overflow: hidden !important;
          }
          .as-canvas {
            width: 100% !important;
            height: auto !important;
          }
          /* Texto: cresce com conteúdo, min-height proporcional à largura */
          .as-page-text {
            min-height: calc(min(794px, 100%) * 1123 / 794) !important;
            overflow: visible !important;
          }
        }

        /* ── Narrow phone header ──────────────────────────────────────────────
           ≤520px: "Analisar" vira ícone (só o star), Salvar mantém texto
           ≤480px: "anotação" some (botão fica só "Salvar")
           ≤380px: "Rascunho" some, pág count some
           ≤340px: "Salvar" também some (ícone save)                          */
        @media (max-width: 520px) {
          .as-analyze-txt { display: none; }
        }
        @media (max-width: 480px) {
          .as-btn-full-txt { display: none; }
        }
        @media (max-width: 380px) {
          .as-dirty { display: none !important; }
          .as-page-count { display: none !important; }
        }
        @media (max-width: 340px) {
          .as-btn-txt { display: none; }
        }
      `}</style>
    </div>
  )
}

