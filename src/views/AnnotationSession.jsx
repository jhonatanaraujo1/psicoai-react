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
const textKey   = (id) => `psicoai_text_draft_p${id}`

let _pid = 0
const newPageId = () => `pg-${Date.now()}-${_pid++}`

function loadCanvasPages(patientId) {
  try {
    const raw = localStorage.getItem(canvasKey(patientId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
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
    if (data.length < 4 * 1024 * 1024) localStorage.setItem(canvasKey(patientId), data)
  } catch { /* quota */ }
}

// ── A4 canvas page (modo canvas) ──────────────────────────────────────────────
function CanvasPage({ page, isActive, toolRef, colorRef, sizeRef, onStrokeEnd, onClick }) {
  const canvasRef    = useRef(null)
  const isDrawing    = useRef(false)
  const lastPos      = useRef({ x: 0, y: 0 })
  const prevDataUrl  = useRef(null) // snapshot antes do traço comecar

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
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    isDrawing.current = true
    prevDataUrl.current = canvasRef.current?.toDataURL('image/png') || null
    lastPos.current = getPos(e)
    const ctx  = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.globalCompositeOperation = toolRef.current === 'eraser' ? 'destination-out' : 'source-over'
    ctx.fillStyle = toolRef.current === 'eraser' ? 'rgba(0,0,0,1)' : colorRef.current
    ctx.beginPath()
    ctx.arc(lastPos.current.x, lastPos.current.y, (sizeRef.current * SCALE) / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, []) // eslint-disable-line

  const onPointerMove = useCallback((e) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const pos      = getPos(e)
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
  }, []) // eslint-disable-line

  const onPointerUp = useCallback((e) => {
    if (!isDrawing.current) return
    isDrawing.current = false
    e.preventDefault()
    onStrokeEnd(page.id, prevDataUrl.current)
    prevDataUrl.current = null
  }, [page.id, onStrokeEnd])

  return (
    <div
      id={`page-${page.id}`}
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
  type = 'text',
  onClose,
  onMinimize,
  onAnalyze,
  onAutosave,
  sessionId,
  initialHtml = '',
  initialCanvasData,
}) {
  const isCanvas = type === 'canvas'
  const isText   = type === 'text'

  // ── Estado compartilhado ───────────────────────────────────────────────────
  const [showEndModal, setShowEndModal] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [isDirty, setIsDirty]           = useState(false)

  // ── Sidebar: overlay em mobile/tablet, inline em desktop ──────────────────
  // Canvas: fechado por padrão em ≤900px
  // Texto: aberto por padrão em desktop (guia de anotação), fechado em mobile
  const [sidebarOpen, setSidebarOpen]    = useState(() => window.innerWidth > 900)
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
  const [tool, setTool]             = useState('pen')
  const [color, setColor]           = useState('#1C1C1C')
  const [size, setSize]             = useState(3)
  // Undo stack: { [pageId]: string[] } — array de dataUrls
  const undoStackRef = useRef({})
  const redoStackRef = useRef({})

  const toolRef  = useRef(tool)
  const colorRef = useRef(color)
  const sizeRef  = useRef(size)
  useEffect(() => { toolRef.current  = tool  }, [tool])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { sizeRef.current  = size  }, [size])

  // ── Estado texto ───────────────────────────────────────────────────────────
  const [savedIndicator, setSavedIndicator] = useState(false)
  const editorRef    = useRef(null)
  const autosaveRef  = useRef(null)
  const localSaveRef = useRef(null)
  const patientIdRef = useRef(patient?.id)
  useEffect(() => { patientIdRef.current = patient?.id }, [patient?.id])

  // ── Refs compartilhados ────────────────────────────────────────────────────
  const mainScrollRef = useRef(null)
  const sidebarRef    = useRef(null)
  const sessionIdRef  = useRef(sessionId)
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  // ── Inicializa ao abrir ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !patient?.id) return
    setIsDirty(false)
    setShowEndModal(false)
    setActivePage(0)

    if (isCanvas) {
      const saved = loadCanvasPages(patient.id)
      setPages(saved
        ? saved.map(p => ({ id: p.id, pageType: p.pageType || 'draw', canvasRef: { current: null }, dataUrl: p.dataUrl || null, textHtml: p.textHtml || null }))
        : [{ id: newPageId(), pageType: 'draw', canvasRef: { current: null }, dataUrl: null, textHtml: null }]
      )
    }

    if (isText) {
      setTimeout(() => {
        if (!editorRef.current) return
        const draft = patient?.id ? localStorage.getItem(textKey(patient.id)) : null
        editorRef.current.innerHTML = draft || initialHtml || ''
        if (!isTouch.current) editorRef.current.focus()
      }, 80)
    }
  }, [isOpen, patient?.id]) // eslint-disable-line

  // ── Texto: salva ao trocar aba / fechar janela ────────────────────────────
  const saveTextNow = useCallback(() => {
    clearTimeout(localSaveRef.current)
    if (patientIdRef.current && editorRef.current)
      localStorage.setItem(textKey(patientIdRef.current), editorRef.current.innerHTML)
  }, [])

  useEffect(() => {
    if (!isOpen || !isText) return
    const onHide = () => { if (document.visibilityState === 'hidden') saveTextNow() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', saveTextNow)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', saveTextNow)
    }
  }, [isOpen, isText, saveTextNow])

  // ── Texto: autosave backend a cada 30s ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !isText || !sessionId || !onAutosave) return
    autosaveRef.current = setInterval(() => {
      const text = editorRef.current?.innerText || ''
      if (text.trim()) onAutosave(sessionId, { textContent: text })
    }, 30000)
    return () => clearInterval(autosaveRef.current)
  }, [isOpen, isText, sessionId, onAutosave])

  const handleTextInput = () => {
    setIsDirty(true)
    clearTimeout(localSaveRef.current)
    localSaveRef.current = setTimeout(() => {
      if (patient?.id && editorRef.current) {
        localStorage.setItem(textKey(patient.id), editorRef.current.innerHTML)
        setSavedIndicator(true)
        setTimeout(() => setSavedIndicator(false), 1500)
      }
    }, 400)
  }

  const exec = (cmd, arg) => {
    document.execCommand(cmd, false, arg || null)
    editorRef.current?.focus()
  }

  const insertGuideSection = (label) => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand('insertText', false, (editor.innerText.trim() ? '\n\n' : '') + label + ': ')
  }

  // ── Undo/Redo por página — declarado ANTES de handleStrokeEnd para evitar TDZ na dep array ──
  const pushUndo = useCallback((pageId, dataUrl) => {
    const stack = undoStackRef.current
    if (!stack[pageId]) stack[pageId] = []
    stack[pageId].push(dataUrl)
    if (stack[pageId].length > 40) stack[pageId].shift()
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
  const handleScroll = useCallback(() => {
    const c = mainScrollRef.current
    if (!c) return
    const midY = c.scrollTop + c.clientHeight / 2
    let closest = 0, minDist = Infinity
    pages.forEach((p, i) => {
      const el = document.getElementById(`page-${p.id}`)
      if (!el) return
      const dist = Math.abs(el.offsetTop + PAGE_H / 2 - midY)
      if (dist < minDist) { minDist = dist; closest = i }
    })
    setActivePage(closest)
  }, [pages])

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
      const img = new Image()
      img.onload = () => {
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

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportData = async () => {
    if (isText) {
      const text = editorRef.current?.innerText || ''
      const html = editorRef.current?.innerHTML || ''
      return { textContent: text, htmlContent: html, imageBase64: null, canvasDataJson: null }
    }

    // canvas: combina todas as páginas em imagem única
    const snaps = pages.map(p => ({
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

    return {
      imageBase64,
      canvasDataJson: JSON.stringify({ pages: snaps }),
      textContent: null, htmlContent: null,
    }
  }

  const clearTextDraft = () => {
    if (patient?.id) localStorage.removeItem(textKey(patient.id))
  }

  const handleSave = async () => {
    setSaving(true)
    const data = await exportData()
    setSaving(false); setShowEndModal(false); setIsDirty(false)
    if (isText) clearTextDraft()
    onClose({ duration: 0, ...data })
  }

  const handleAnalyze = async () => {
    setSaving(true)
    const data = await exportData()
    setSaving(false); setShowEndModal(false); setIsDirty(false)
    if (isText) clearTextDraft()
    onAnalyze({ duration: 0, ...data })
  }

  if (!isOpen) return null

  const patientName = patient?.name || 'Paciente'

  // ── Sidebar content ────────────────────────────────────────────────────────
  // Menu de tipo de página (reutilizado na sidebar e na toolbar)
  const AddPageMenu = () => (
    <div style={{
      background: '#242424',
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
        <button key={opt.type} onClick={() => addPage(opt.type)}
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

  const SidebarContent = () => {
    if (isCanvas) {
      return (
        <>
          {pages.map((p, i) => (
            <button
              key={p.id} data-thumb={i}
              onClick={() => scrollToPage(i)}
              style={{
                width: '100%', border: 'none', cursor: 'pointer',
                background: activePage === i ? 'rgba(74,124,89,0.3)' : 'transparent',
                borderLeft: `2px solid ${activePage === i ? '#5C8F6A' : 'transparent'}`,
                padding: '8px 0',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (activePage !== i) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (activePage !== i) e.currentTarget.style.background = 'transparent' }}
            >
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
              <span style={{ fontSize: 10, color: activePage === i ? '#9DC4A8' : 'rgba(255,255,255,0.35)' }}>
                {i + 1}
              </span>
            </button>
          ))}
          {/* Add page button + mini-menu */}
          <div ref={addMenuRef} style={{ position: 'relative', marginTop: 8 }}>
            <button
              onClick={() => setShowAddMenu(p => !p)} title="Nova página"
              style={{
                width: 72, height: 36,
                border: `1.5px dashed ${showAddMenu ? '#5C8F6A' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: 4,
                background: showAddMenu ? 'rgba(74,124,89,0.15)' : 'transparent',
                color: showAddMenu ? '#5C8F6A' : 'rgba(255,255,255,0.35)',
                cursor: 'pointer', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!showAddMenu) { e.currentTarget.style.borderColor = '#5C8F6A'; e.currentTarget.style.color = '#5C8F6A' } }}
              onMouseLeave={e => { if (!showAddMenu) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' } }}
            >+</button>
            {showAddMenu && (
              <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 6 }}>
                <AddPageMenu />
              </div>
            )}
          </div>
        </>
      )
    }

    // Texto: guia de anotação
    return (
      <div style={{ padding: '12px 10px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 6, paddingLeft: 2 }}>
          Guia de anotação
        </div>
        {GUIDE.map(g => (
          <button
            key={g.label}
            title={g.hint}
            onClick={() => { insertGuideSection(g.label); if (isOverlaySidebar) setSidebarOpen(false) }}
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 7, padding: '7px 8px', cursor: 'pointer',
              textAlign: 'left', fontFamily: "'DM Sans', sans-serif",
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            <div style={{ fontSize: 14, marginBottom: 2 }}>{g.icon}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', lineHeight: 1.35, fontWeight: 500 }}>{g.label}</div>
          </button>
        ))}
      </div>
    )
  }

  // ── Toolbar content ────────────────────────────────────────────────────────
  // Página ativa é de texto? (sessão canvas com página de tipo texto)
  const activePageIsText = isCanvas && pages[activePage]?.pageType === 'text'

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
            {showAddMenu && <AddPageMenu />}
          </div>
        </>
      )
    }

    if (isCanvas) {
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

          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool('pen') }} title={c}
              style={{
                width: 22, height: 22, borderRadius: '50%', background: c,
                border: 'none', cursor: 'pointer', flexShrink: 0,
                boxShadow: color === c && tool === 'pen' ? `0 0 0 2px #1A1A1A, 0 0 0 3.5px ${c}` : 'none',
                transition: 'box-shadow 0.15s',
              }}
            />
          ))}

          <Sep />

          {[2, 4, 8].map(s => (
            <button key={s} onClick={() => setSize(s)} title={`Espessura ${s}`}
              style={{
                width: 36, height: 36, borderRadius: 8, border: 'none',
                background: size === s ? 'rgba(255,255,255,0.12)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ width: Math.min(s * 2.5, 20), height: Math.min(s * 2.5, 20), borderRadius: '50%', background: color }} />
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

          <div ref={addMenuRef} style={{ marginLeft: 'auto', display: 'flex', gap: 6, position: 'relative' }}>
            <TBtn active={showAddMenu} onClick={() => setShowAddMenu(p => !p)} title="Nova página">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
              </svg>
            </TBtn>
            {showAddMenu && <AddPageMenu />}
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

  // ── Save modal: word count para texto ─────────────────────────────────────
  const wordCount = isText
    ? (editorRef.current?.innerText?.trim().split(/\s+/).filter(Boolean).length || 0)
    : null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
      background: '#1E1E1E',
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

        {/* Nome + tipo */}
        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ opacity: 0.5 }}>Ψ</span>
          {patientName}
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: isCanvas ? 'rgba(125,60,152,0.3)' : 'rgba(255,255,255,0.12)',
            color: isCanvas ? '#C39BD3' : 'rgba(255,255,255,0.6)',
            letterSpacing: '0.5px', textTransform: 'uppercase',
          }}>
            {isCanvas ? 'Canvas' : 'Texto'}
          </span>
          {isCanvas && pages.length > 1 && (
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.12)', padding: '2px 8px', borderRadius: 20, color: 'rgba(255,255,255,0.6)' }}>
              pág. {activePage + 1} / {pages.length}
            </span>
          )}
        </div>

        {isDirty && (
          <span style={{ fontSize: 11, color: '#F0A500', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Rascunho
          </span>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => setShowEndModal(true)}
            style={{
              padding: '7px 18px', background: '#4A7C59', border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#3D6B4A'}
            onMouseLeave={e => e.currentTarget.style.background = '#4A7C59'}
          >
            Salvar anotação
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
          <SidebarContent />
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
            padding: '32px 24px 80px', gap: isCanvas ? 32 : 0,
          }}
        >
          {isCanvas ? (
            pages.map((p, i) => (
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
                  />
            ))
          ) : (
            /* Folha A4 de texto */
            <div style={{
              width: Math.min(PAGE_W, window.innerWidth - 48),
              minHeight: PAGE_H,
              background: '#fff',
              borderRadius: 2,
              boxShadow: '0 4px 32px rgba(0,0,0,0.22)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Cabeçalho da folha */}
              <div style={{
                padding: '20px 40px 16px',
                borderBottom: '1px solid #F0EDE8',
                flexShrink: 0,
              }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: '#1C1C1C', fontWeight: 400, marginBottom: 4 }}>
                  {patientName}
                </div>
                <div style={{ fontSize: 12, color: '#B0ADA8' }}>
                  {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Editor */}
              <div style={{ flex: 1, padding: '28px 40px 40px' }}>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Escreva livremente — o que o paciente trouxe, o que você observou, o que emergiu..."
                  style={{
                    minHeight: 600, outline: 'none',
                    fontSize: 15, lineHeight: 1.85,
                    color: '#1C1C1C', fontFamily: "'DM Sans', sans-serif",
                    caretColor: '#4A7C59',
                  }}
                  onInput={handleTextInput}
                  onKeyDown={e => {
                    if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '    ') }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="as-toolbar" style={{
        height: 52, flexShrink: 0,
        background: '#1A1A1A',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 6, padding: '0 16px',
        overflowX: 'auto',
      }}>
        <ToolbarContent />
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
                {patientName} · {isCanvas ? `${pages.length} página${pages.length > 1 ? 's' : ''}` : new Date().toLocaleDateString('pt-BR')}
              </div>

              {/* Word count hint (só texto) */}
              {isText && wordCount !== null && (() => {
                const c = wordCount < 30 ? '#E74C3C' : wordCount < 80 ? '#F39C12' : '#27AE60'
                const m = wordCount < 30
                  ? `Só ${wordCount} palavras — anotações curtas limitam a precisão da IA.`
                  : wordCount < 80
                  ? `${wordCount} palavras — bom começo.`
                  : `${wordCount} palavras — ótimo nível de detalhe.`
                return (
                  <div style={{ marginTop: 12, fontSize: 12, color: c, background: `${c}18`, border: `1px solid ${c}44`, borderRadius: 7, padding: '8px 12px', lineHeight: 1.5 }}>
                    {m}
                  </div>
                )
              })()}
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <button
                onClick={handleAnalyze} disabled={saving}
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

      <style>{`
        @keyframes as-spin { to { transform: rotate(360deg) } }

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
          .as-main { padding: 16px 10px 72px !important; }
        }
        @media (max-width: 900px) {
          .as-main { padding: 20px 14px 72px !important; }
        }
      `}</style>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────
function TBtn({ active, onClick, title, children }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 36, height: 36, borderRadius: 8, border: 'none',
      background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.55)',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s', flexShrink: 0,
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
