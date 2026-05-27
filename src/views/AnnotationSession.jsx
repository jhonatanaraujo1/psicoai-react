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
const canvasKey = (id) => `psicoai_canvas2_p${id}`

let _pid = 0
const newPageId = () => `pg-${Date.now()}-${_pid++}`

// SEC-003: chave derivada do JWT (muda por login, impede leitura cross-user)
// Não é perfeito (key é JS-acessível), mas bloqueia extensions que só lêem localStorage
const getEncKey = () => {
  try {
    const tok = localStorage.getItem('psicoai_token') || ''
    return tok.length > 16 ? `psicoai-v1:${tok.slice(-32)}` : 'psicoai-clinical-v1-dev'
  } catch { return 'psicoai-clinical-v1-dev' }
}

// ── Shape tool list ───────────────────────────────────────────────────────────
const SHAPE_TOOLS = ['rect', 'circle', 'diamond', 'arrow', 'line']

// Draws a shape preview/commit onto a canvas context
function drawShape(ctx, shape, x1, y1, x2, y2, color, lineWidth) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = 'transparent'
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
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

function loadCanvasPages(patientId) {
  try {
    const raw = localStorage.getItem(canvasKey(patientId))
    if (!raw) return null
    let parsed
    try {
      // Tenta descriptografar (formato novo — AES)
      const decrypted = AES.decrypt(raw, getEncKey()).toString(CryptoEnc.Utf8)
      parsed = JSON.parse(decrypted)
    } catch {
      // Fallback: tenta JSON puro (migração de dados legados não-criptografados)
      parsed = JSON.parse(raw)
      // Re-salva criptografado imediatamente
      if (Array.isArray(parsed) && parsed.length > 0) saveCanvasPages(patientId, parsed)
    }
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch { return null }
}

function saveCanvasPages(patientId, pages) {
  try {
    const data = JSON.stringify(pages.map(p => ({
      id: p.id,
      pageType: p.pageType || 'draw',
      dataUrl: p.dataUrl || null,
      textHtml: p.textHtml || null,
    })))
    if (data.length < 4 * 1024 * 1024) {
      // SEC-003: criptografar dados clínicos antes de persistir
      const encrypted = AES.encrypt(data, getEncKey()).toString()
      localStorage.setItem(canvasKey(patientId), encrypted)
    }
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
      className="as-page-wrap"
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

// ── A4 text page (modo canvas, página de texto) ───────────────────────────────
function TextPage({ page, isActive, onTextChange, onClick }) {
  const editorRef = useRef(null)

  useEffect(() => {
    if (editorRef.current)
      editorRef.current.innerHTML = page.textHtml || ''
  }, [page.id]) // só na montagem

  return (
    <div
      id={`page-${page.id}`}
      className="as-page-wrap"
      onClick={onClick}
      style={{
        flexShrink: 0, width: PAGE_W, minHeight: PAGE_H,
        background: '#fff', borderRadius: 2,
        boxShadow: isActive
          ? '0 0 0 2.5px #5C8F6A, 0 8px 40px rgba(0,0,0,0.22)'
          : '0 4px 32px rgba(0,0,0,0.18)',
        overflow: 'hidden', cursor: 'text',
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{
        padding: '16px 32px 8px',
        borderBottom: '1px solid #F0EDE8',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B0ADA8" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
        </svg>
        <span style={{ fontSize: 11, color: '#B0ADA8', fontFamily: "'DM Sans', sans-serif" }}>
          Página de texto
        </span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Escreva aqui..."
        style={{
          flex: 1, padding: '24px 40px 40px',
          minHeight: PAGE_H - 60, outline: 'none',
          fontSize: 15, lineHeight: 1.85,
          color: '#1C1C1C', fontFamily: "'DM Sans', sans-serif",
          caretColor: '#4A7C59',
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
  sessionId,
}) {
  // Sempre canvas — texto é apenas um tipo de página dentro do canvas
  const isCanvas = true
  const isText   = false

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
  const editorRef    = useRef(null)
  const autosaveRef  = useRef(null)
  const localSaveRef = useRef(null)
  const patientIdRef = useRef(patient?.id)
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
    penDetectedRef.current = false // C-1: reset palm rejection on every new session

    // Carrega histórico do paciente do localStorage
    const saved = loadCanvasPages(patient.id)
    const restored = saved
      ? saved.map(p => ({ id: p.id, pageType: p.pageType || 'draw', canvasRef: { current: null }, dataUrl: p.dataUrl || null, textHtml: p.textHtml || null }))
      : []

    if (initialPageType && restored.length > 0) {
      // Nova anotação sobre histórico existente: adiciona nova página ao final
      const nova = { id: newPageId(), pageType: initialPageType, canvasRef: { current: null }, dataUrl: null, textHtml: null }
      const all = [...restored, nova]
      setPages(all)
      setActivePage(all.length - 1)
      setTimeout(() => {
        const c = mainScrollRef.current
        if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
      }, 200)
    } else if (restored.length > 0) {
      // Recovery/histórico: exibe páginas existentes do início
      setPages(restored)
      setActivePage(0)
    } else {
      // Primeiro acesso: nova página em branco do tipo solicitado
      const nova = { id: newPageId(), pageType: initialPageType || 'draw', canvasRef: { current: null }, dataUrl: null, textHtml: null }
      setPages([nova])
      setActivePage(0)
    }
  }, [isOpen, patient?.id, initialPageType]) // eslint-disable-line

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
      if (patient?.id) saveCanvasPages(patient.id, updated)
      return updated
    })
  }, [patient?.id, pushUndo])

  // ── Canvas: nova página ────────────────────────────────────────────────────
  const addPage = useCallback((pageType = 'draw') => {
    const newPage = { id: newPageId(), pageType, canvasRef: { current: null }, dataUrl: null, textHtml: null }
    setPages(prev => {
      const next = [...prev, newPage]
      if (patient?.id) saveCanvasPages(patient.id, next)
      return next
    })
    setActivePage(p => p + 1)
    setShowAddMenu(false)
    setTimeout(() => {
      const c = mainScrollRef.current
      if (c) c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
    }, 80)
  }, [patient?.id])

  // ── Canvas: apagar página ─────────────────────────────────────────────────
  const deletePage = useCallback((pageId) => {
    setPages(prev => {
      if (prev.length <= 1) return prev // nunca apaga a última página
      const deletedIdx = prev.findIndex(p => p.id === pageId)
      if (deletedIdx === -1) return prev
      const next = prev.filter(p => p.id !== pageId)
      if (patient?.id) saveCanvasPages(patient.id, next)
      // Ajusta página ativa
      setActivePage(ap => {
        if (ap > deletedIdx) return ap - 1          // apagou antes da ativa
        if (ap === deletedIdx) return Math.min(ap, next.length - 1) // apagou a ativa
        return ap                                     // apagou depois da ativa
      })
      return next
    })
    setIsDirty(true)
  }, [patient?.id])

  // ── Canvas: atualizar texto em página de texto ────────────────────────────
  const handlePageTextChange = useCallback((pageId, html) => {
    setIsDirty(true)
    setPages(prev => {
      const updated = prev.map(p => p.id === pageId ? { ...p, textHtml: html } : p)
      if (patient?.id) saveCanvasPages(patient.id, updated)
      return updated
    })
  }, [patient?.id])

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

  // Keyboard undo/redo (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    if (!isOpen || !isCanvas) return
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo() }
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

    // Texto: formatação
    const fmtTools = [
      { cmd: 'bold',          icon: <strong style={{ fontFamily: 'inherit' }}>B</strong>,  title: 'Negrito' },
      { cmd: 'italic',        icon: <em style={{ fontFamily: 'inherit' }}>I</em>,           title: 'Itálico' },
      { cmd: 'underline',     icon: <u style={{ fontFamily: 'inherit' }}>U</u>,             title: 'Sublinhado' },
      { sep: true },
      { cmd: 'formatBlock',   arg: 'h3',
        icon: <span style={{ fontFamily: "'Fraunces',serif", fontSize: 15 }}>H</span>, title: 'Título' },
      { cmd: 'insertUnorderedList',
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>, title: 'Lista' },
      { sep: true },
      { cmd: 'removeFormat',
        icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          <line x1="15" y1="5" x2="19" y2="9"/>
        </svg>, title: 'Limpar' },
    ]

    return (
      <>
        {fmtTools.map((t, i) => t.sep
          ? <Sep key={i} />
          : (
            <button key={i} title={t.title}
              onMouseDown={e => { e.preventDefault(); exec(t.cmd, t.arg) }}
              style={{
                width: 36, height: 36, border: 'none', borderRadius: 8,
                background: 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, color: 'rgba(255,255,255,0.6)', transition: 'all 0.12s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
            >
              {t.icon}
            </button>
          )
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
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

        {isDirty && (
          <span className="as-dirty" style={{ fontSize: 11, color: '#F0A500', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Rascunho
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
          <div style={{ zoom: zoom, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
            {pages.map((p, i) => (
              p.pageType === 'text'
                ? <TextPage
                    key={p.id} page={p}
                    isActive={activePage === i}
                    onTextChange={handlePageTextChange}
                    onClick={() => setActivePage(i)}
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
                    {saving ? 'Exportando…' : 'Gerar reflexão clínica com IA'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--g600)', lineHeight: 1.5, paddingLeft: 26 }}>
                  A IA lê o que você escreveu e devolve hipóteses, padrões e conexões com sessões anteriores.
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
        @keyframes as-slideUp {
          from { transform: translateY(100%); opacity: 0.6 }
          to   { transform: translateY(0);    opacity: 1 }
        }

        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder); color: #B0ADA8; pointer-events: none;
        }
        [contenteditable] h3 {
          font-family: 'Fraunces', serif; font-size: 18px;
          font-weight: 500; color: #1C1C1C; margin: 20px 0 8px;
        }
        [contenteditable] ul { padding-left: 20px; margin: 8px 0; }
        [contenteditable] li { margin-bottom: 4px; }
        [contenteditable] strong { font-weight: 700; }
        [contenteditable] em { font-style: italic; }

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
           On narrow viewports the 794px page overflows. Scale it down
           proportionally using CSS — getPos() uses getBoundingClientRect()
           so coordinates automatically correct with CSS scaling.             */
        @media (max-width: 860px) {
          .as-page-wrap {
            width: min(794px, 100%) !important;
            height: auto !important;
            min-height: unset !important;
            aspect-ratio: 794 / 1123;
          }
          .as-canvas {
            width: 100% !important;
            height: auto !important;
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

