/**
 * CanvasSession — Anotação em folha A4, estilo leitor de PDF.
 *
 * Layout:
 *   • Header fixo (← voltar, nome, salvar)
 *   • Sidebar esquerda: miniaturas de páginas + botão nova página
 *   • Área central: scroll vertical de folhas A4 brancas (canvas HTML nativo)
 *   • Toolbar inferior: caneta, borracha, cores, espessura
 *
 * Canvas HTML nativo com PointerEvents → suporte a Apple Pencil / stylus.
 * Cada página é um <canvas> 794×1123px (A4 a 96dpi × 2 para retina).
 * Sem dependência de bibliotecas externas de canvas.
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Dimensões A4 ──────────────────────────────────────────────────────────────
const PAGE_W   = 794    // px A4 largura (96 dpi)
const PAGE_H   = 1123   // px A4 altura
const SCALE    = 2      // multiplicador HiDPI / retina

// ── Cores de caneta disponíveis ───────────────────────────────────────────────
const COLORS = ['#1C1C1C', '#2D6A4F', '#7B5E3A', '#C0392B', '#2471A3', '#7D3C98']

// ── LocalStorage ──────────────────────────────────────────────────────────────
const lsKey = (patientId) => `psicoai_canvas2_p${patientId}`

function loadPages(patientId) {
  try {
    const raw = localStorage.getItem(lsKey(patientId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed // array de { id, dataUrl }
  } catch { return null }
}

function savePages(patientId, pages) {
  try {
    const data = JSON.stringify(pages.map(p => ({ id: p.id, dataUrl: p.dataUrl || null })))
    if (data.length < 4 * 1024 * 1024) {
      localStorage.setItem(lsKey(patientId), data)
    }
  } catch { /* quota exceeded — silencioso */ }
}

// ── Novo ID de página ─────────────────────────────────────────────────────────
let _pid = 0
const newPageId = () => `pg-${Date.now()}-${_pid++}`

// ── Sub-componente: uma folha A4 ──────────────────────────────────────────────
function A4Page({ page, isActive, toolRef, colorRef, sizeRef, onStrokeEnd, onClick }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })

  // Expõe o canvas element via page.canvasRef
  useEffect(() => {
    page.canvasRef.current = canvasRef.current
  })

  // Carrega dataUrl salva (restaura conteúdo ao montar)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    // Limpa e preenche de branco
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (page.dataUrl) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0)
      img.src = page.dataUrl
    }
  }, [page.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const getPos = (e) => {
    const canvas = canvasRef.current
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    }
  }

  const onPointerDown = useCallback((e) => {
    if (e.button !== undefined && e.button > 0) return // ignora clique direito
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    isDrawing.current = true
    lastPos.current = getPos(e)

    // Ponto único (tap)
    const ctx    = canvasRef.current?.getContext('2d')
    const tool   = toolRef.current
    const color  = colorRef.current
    const size   = sizeRef.current
    if (!ctx) return

    ctx.save()
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color
    ctx.beginPath()
    ctx.arc(lastPos.current.x, lastPos.current.y, (size * SCALE) / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = useCallback((e) => {
    if (!isDrawing.current) return
    e.preventDefault()

    const ctx   = canvasRef.current?.getContext('2d')
    const tool  = toolRef.current
    const color = colorRef.current
    const size  = sizeRef.current
    if (!ctx) return

    const pos = getPos(e)
    // Pressure support (Apple Pencil): e.pressure = 0..1, default 0.5
    const pressure = (e.pointerType === 'pen' && e.pressure > 0) ? e.pressure : 0.5
    const lineW    = (size * SCALE) * (0.4 + pressure * 1.2)

    ctx.save()
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle  = tool === 'eraser' ? 'rgba(0,0,0,1)' : color
    ctx.lineWidth    = lineW
    ctx.lineCap      = 'round'
    ctx.lineJoin     = 'round'

    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.restore()

    lastPos.current = pos
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerUp = useCallback((e) => {
    if (!isDrawing.current) return
    isDrawing.current = false
    e.preventDefault()
    // Notifica pai para capturar thumbnail e salvar
    onStrokeEnd(page.id)
  }, [page.id, onStrokeEnd])

  return (
    <div
      id={`page-${page.id}`}
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: PAGE_W,
        height: PAGE_H,
        background: '#fff',
        boxShadow: isActive
          ? '0 0 0 2.5px #5C8F6A, 0 8px 40px rgba(0,0,0,0.22)'
          : '0 4px 32px rgba(0,0,0,0.18)',
        borderRadius: 2,
        overflow: 'hidden',
        cursor: 'crosshair',
        touchAction: 'none',  // crítico para pointer events no touch/stylus
      }}
    >
      <canvas
        ref={canvasRef}
        width={PAGE_W * SCALE}
        height={PAGE_H * SCALE}
        style={{ width: PAGE_W, height: PAGE_H, display: 'block' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CanvasSession({
  patient,
  isOpen,
  onClose,
  onMinimize,
  onAnalyze,
  onAutosave,
  sessionId,
  initialCanvasData,
}) {
  // Páginas: array de { id, canvasRef: {current}, dataUrl }
  const [pages, setPages]             = useState(() => [{ id: newPageId(), canvasRef: { current: null }, dataUrl: null }])
  const [activePage, setActivePage]   = useState(0)
  const [tool, setTool]               = useState('pen')
  const [color, setColor]             = useState('#1C1C1C')
  const [size, setSize]               = useState(3)
  const [isDirty, setIsDirty]         = useState(false)
  const [showEndModal, setShowEndModal] = useState(false)
  const [saving, setSaving]           = useState(false)

  // Refs para acesso sem re-render nos handlers de pointer
  const toolRef  = useRef(tool)
  const colorRef = useRef(color)
  const sizeRef  = useRef(size)
  useEffect(() => { toolRef.current = tool },   [tool])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { sizeRef.current = size },   [size])

  const mainScrollRef = useRef(null)
  const sidebarRef    = useRef(null)
  const sessionIdRef  = useRef(sessionId)
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])

  // ── Inicializa / restaura ao abrir ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !patient?.id) return
    setIsDirty(false)
    setShowEndModal(false)
    setActivePage(0)

    const saved = loadPages(patient.id)
    if (saved && saved.length > 0) {
      setPages(saved.map(p => ({ id: p.id, canvasRef: { current: null }, dataUrl: p.dataUrl })))
    } else {
      setPages([{ id: newPageId(), canvasRef: { current: null }, dataUrl: null }])
    }
  }, [isOpen, patient?.id])

  // ── Captura thumbnail após cada traço ──────────────────────────────────────
  const handleStrokeEnd = useCallback((pageId) => {
    setIsDirty(true)
    setPages(prev => {
      const updated = prev.map(p => {
        if (p.id !== pageId) return p
        const dataUrl = p.canvasRef.current?.toDataURL('image/png') || p.dataUrl
        return { ...p, dataUrl }
      })
      // Salva no localStorage (fire-and-forget)
      if (patient?.id) savePages(patient.id, updated)
      return updated
    })
  }, [patient?.id])

  // ── Nova página ────────────────────────────────────────────────────────────
  const addPage = useCallback(() => {
    const newPage = { id: newPageId(), canvasRef: { current: null }, dataUrl: null }
    setPages(prev => {
      const next = [...prev, newPage]
      if (patient?.id) savePages(patient.id, next)
      return next
    })
    setActivePage(p => p + 1) // vai para a nova página
    // Scroll até a nova página
    setTimeout(() => {
      const container = mainScrollRef.current
      if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }, 80)
  }, [patient?.id])

  // ── Scroll da área principal → atualiza página ativa ──────────────────────
  const handleScroll = useCallback(() => {
    const container = mainScrollRef.current
    if (!container) return
    const midY = container.scrollTop + container.clientHeight / 2
    // Encontra qual página está no centro
    let closest = 0
    let minDist = Infinity
    pages.forEach((p, i) => {
      const el = document.getElementById(`page-${p.id}`)
      if (!el) return
      const elTop = el.offsetTop
      const elMid = elTop + PAGE_H / 2
      const dist  = Math.abs(elMid - midY)
      if (dist < minDist) { minDist = dist; closest = i }
    })
    setActivePage(closest)
  }, [pages])

  // ── Sidebar scroll para acompanhar página ativa ───────────────────────────
  useEffect(() => {
    const sb = sidebarRef.current
    if (!sb) return
    const el = sb.querySelector(`[data-thumb="${activePage}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activePage])

  // ── Scroll da sidebar → scroll da área principal ──────────────────────────
  const scrollToPage = (idx) => {
    const container = mainScrollRef.current
    if (!container) return
    const el = document.getElementById(`page-${pages[idx]?.id}`)
    if (!el) return
    const topOffset = el.offsetTop - 32
    container.scrollTo({ top: topOffset, behavior: 'smooth' })
    setActivePage(idx)
  }

  // ── Export para salvar / analisar ──────────────────────────────────────────
  const exportData = async () => {
    // Atualiza dataUrls de todos os canvas
    const snapshots = pages.map(p => ({
      id: p.id,
      dataUrl: p.canvasRef.current?.toDataURL('image/png') || p.dataUrl || null,
    }))

    // Combina todas as páginas verticalmente numa imagem única para a IA
    let imageBase64 = null
    try {
      const totalH = snapshots.length * PAGE_H * SCALE
      const combined = document.createElement('canvas')
      combined.width  = PAGE_W * SCALE
      combined.height = totalH
      const ctx = combined.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, combined.width, combined.height)

      for (let i = 0; i < snapshots.length; i++) {
        if (!snapshots[i].dataUrl) continue
        await new Promise(resolve => {
          const img = new Image()
          img.onload = () => {
            ctx.drawImage(img, 0, i * PAGE_H * SCALE)
            resolve()
          }
          img.src = snapshots[i].dataUrl
        })
      }
      imageBase64 = combined.toDataURL('image/png').split(',')[1]
    } catch (e) {
      console.warn('[CanvasSession] export failed:', e)
    }

    const canvasDataJson = JSON.stringify({ pages: snapshots })
    return { imageBase64, canvasDataJson, canvasTextContent: null }
  }

  const handleSave = async () => {
    setSaving(true)
    const data = await exportData()
    setSaving(false)
    setShowEndModal(false)
    setIsDirty(false)
    onClose({ duration: 0, ...data })
  }

  const handleAnalyze = async () => {
    setSaving(true)
    const data = await exportData()
    setSaving(false)
    setShowEndModal(false)
    setIsDirty(false)
    onAnalyze({ duration: 0, ...data })
  }

  if (!isOpen) return null

  const patientName = patient?.name || 'Paciente'

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
        padding: '0 16px', gap: 12,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        {onMinimize && (
          <button
            onClick={onMinimize}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
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

        <div style={{ fontSize: 14, color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ opacity: 0.5 }}>Ψ</span>
          {patientName}
          {pages.length > 1 && (
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
            Rascunho não salvo
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowEndModal(true)}
            style={{
              padding: '7px 18px', background: '#4A7C59',
              border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#3D6B4A'}
            onMouseLeave={e => e.currentTarget.style.background = '#4A7C59'}
          >
            Salvar anotação
          </button>
        </div>
      </div>

      {/* ── Body: sidebar + páginas ──────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          style={{
            width: 120, flexShrink: 0,
            background: '#161616',
            overflowY: 'auto', overflowX: 'hidden',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            padding: '12px 0 16px',
            gap: 0,
          }}
        >
          {pages.map((p, i) => (
            <button
              key={p.id}
              data-thumb={i}
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
              {/* Miniatura A4 */}
              <div style={{
                width: 72, height: 102,
                background: '#fff',
                border: `1.5px solid ${activePage === i ? '#5C8F6A' : 'rgba(255,255,255,0.15)'}`,
                borderRadius: 2, overflow: 'hidden', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {p.dataUrl
                  ? <img src={p.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                  : <div style={{ width: '100%', height: '100%', background: '#fff' }} />
                }
              </div>
              <span style={{ fontSize: 10, color: activePage === i ? '#9DC4A8' : 'rgba(255,255,255,0.35)' }}>
                {i + 1}
              </span>
            </button>
          ))}

          {/* Botão nova página */}
          <button
            onClick={addPage}
            title="Nova página"
            style={{
              marginTop: 8,
              width: 72, height: 36,
              border: '1.5px dashed rgba(255,255,255,0.2)',
              borderRadius: 4, background: 'transparent',
              color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
              fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#5C8F6A'; e.currentTarget.style.color = '#5C8F6A' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
          >
            +
          </button>
        </div>

        {/* Área principal de páginas */}
        <div
          ref={mainScrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1, overflowY: 'auto', overflowX: 'auto',
            background: '#2A2A2A',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            padding: '32px 24px 80px', gap: 32,
          }}
        >
          {pages.map((p, i) => (
            <A4Page
              key={p.id}
              page={p}
              isActive={activePage === i}
              toolRef={toolRef}
              colorRef={colorRef}
              sizeRef={sizeRef}
              onStrokeEnd={handleStrokeEnd}
              onClick={() => setActivePage(i)}
            />
          ))}
        </div>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{
        height: 52, flexShrink: 0,
        background: '#1A1A1A',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 8, padding: '0 16px',
      }}>
        {/* Caneta */}
        <ToolBtn active={tool === 'pen'} onClick={() => setTool('pen')} title="Caneta">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
          </svg>
        </ToolBtn>

        {/* Borracha */}
        <ToolBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Borracha">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 20H7L3 16l10-10 7 7-1.5 1.5"/>
            <path d="M6.0001 20l-3-3 10-10"/>
          </svg>
        </ToolBtn>

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Cores */}
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => { setColor(c); setTool('pen') }}
            title={c}
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: c, border: 'none', cursor: 'pointer', flexShrink: 0,
              boxShadow: color === c && tool === 'pen'
                ? `0 0 0 2px #1A1A1A, 0 0 0 3.5px ${c}`
                : 'none',
              transition: 'box-shadow 0.15s',
            }}
          />
        ))}

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Espessura */}
        {[2, 4, 8].map(s => (
          <button
            key={s}
            onClick={() => setSize(s)}
            title={`Espessura ${s}`}
            style={{
              width: 36, height: 36, borderRadius: 8, border: 'none',
              background: size === s ? 'rgba(255,255,255,0.12)' : 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (size !== s) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (size !== s) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ width: s * 2.5, height: s * 2.5, maxWidth: 20, maxHeight: 20, borderRadius: '50%', background: color, transition: 'all 0.15s' }} />
          </button>
        ))}

        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

        {/* Desfazer / Refazer — placeholder (TODO: implementar history) */}
        <ToolBtn active={false} onClick={() => document.execCommand?.('undo')} title="Desfazer (Ctrl+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
          </svg>
        </ToolBtn>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <ToolBtn active={false} onClick={addPage} title="Nova página">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
            </svg>
          </ToolBtn>
        </div>
      </div>

      {/* ── Modal salvar / analisar ──────────────────────────────────────── */}
      {showEndModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}>
          <div style={{
            background: '#fff', borderRadius: 16,
            width: '100%', maxWidth: 440,
            boxShadow: '0 24px 64px rgba(0,0,0,0.4)', overflow: 'hidden',
          }}>
            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, color: '#1C1C1C', marginBottom: 6 }}>
                Salvar anotação
              </div>
              <div style={{ fontSize: 13, color: '#8B8B8B', lineHeight: 1.6 }}>
                {patientName} · {pages.length} página{pages.length > 1 ? 's' : ''}
              </div>
            </div>

            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleAnalyze}
                disabled={saving}
                style={{
                  width: '100%', padding: 16, border: '2px solid var(--g300)',
                  borderRadius: 12, background: 'var(--g50)', cursor: saving ? 'wait' : 'pointer',
                  textAlign: 'left', fontFamily: "'DM Sans', sans-serif", opacity: saving ? 0.7 : 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!saving) { e.currentTarget.style.background = 'var(--g100)'; e.currentTarget.style.borderColor = 'var(--g400)' }}}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--g50)'; e.currentTarget.style.borderColor = 'var(--g300)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  {saving ? (
                    <span style={{ width: 16, height: 16, border: '2px solid var(--g300)', borderTopColor: 'var(--g600)', borderRadius: '50%', display: 'inline-block', animation: 'cs-spin 0.8s linear infinite', flexShrink: 0 }} />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2" style={{ flexShrink: 0 }}>
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--g700)' }}>
                    {saving ? 'Exportando…' : 'Gerar reflexão clínica com IA'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--g600)', lineHeight: 1.5, paddingLeft: 26 }}>
                  A IA lê o que você escreveu e devolve hipóteses, padrões e conexões com anotações anteriores.
                </div>
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
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

              <button
                onClick={() => setShowEndModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--gr4)', fontSize: 12, cursor: 'pointer', padding: 4, fontFamily: "'DM Sans', sans-serif" }}
              >
                ← Continuar anotando
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes cs-spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ── Botão de ferramenta ────────────────────────────────────────────────────────
function ToolBtn({ active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
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
