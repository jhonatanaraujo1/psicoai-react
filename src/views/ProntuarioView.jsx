/**
 * ProntuarioView — Visualização de prontuário estilo leitor de PDF.
 *
 * Layout:
 *   • Header fixo (← voltar, nome do paciente, abas, + Nova anotação)
 *   • Sidebar esquerda: miniaturas A4 clicáveis para navegação rápida
 *   • Área principal: scroll vertical de páginas A4 (texto ou canvas)
 *
 * IntersectionObserver sincroniza qual página está visível com o item
 * destacado na sidebar. Clicar na sidebar faz smooth-scroll para a página.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { api } from '../services'

// SEC-001: config de sanitização — apenas tags seguras para anotações clínicas
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'hr', 'span', 'div'],
  ALLOWED_ATTR: ['style'],
  ALLOWED_STYLE_PROPS: ['font-weight', 'font-style', 'text-decoration'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link', 'meta'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'href', 'src', 'action'],
}

// ── Proporções A4 ──────────────────────────────────────────────────────────────
const A4_W      = 680                       // px — largura máxima da página A4
const A4_H      = Math.round(A4_W * 1.414) // 961px
const THUMB_W   = 88                        // px — miniatura na sidebar
const THUMB_H   = Math.round(THUMB_W * 1.414) // 124px

// Largura real da página A4 calculada dinamicamente (responsivo)
function useA4Width() {
  const [w, setW] = useState(() => Math.min(A4_W, window.innerWidth - 48))
  useEffect(() => {
    const update = () => setW(Math.min(A4_W, window.innerWidth - 48))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return w
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch { return '' }
}

function formatDateShort(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'short',
    })
  } catch { return '' }
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(n => n[0] || '').join('').toUpperCase()
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/** Renderiza conteúdo de sessão de texto dentro da página A4 */
function TextContent({ notePreview, htmlContent, textContent }) {
  const html = htmlContent
  const plain = textContent || notePreview

  if (!html && !plain) {
    return (
      <p style={{ color: '#C0BCB6', fontStyle: 'italic', fontSize: 14 }}>
        Conteúdo não disponível.
      </p>
    )
  }
  if (html) {
    return (
      <div
        className="prontuario-html-content"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html, SANITIZE_CONFIG) }}
        style={{
          fontSize: 15, lineHeight: 1.85, color: '#1C1C1C',
          fontFamily: "'DM Sans', sans-serif",
        }}
      />
    )
  }
  return (
    <div style={{
      fontSize: 15, lineHeight: 1.85, color: '#1C1C1C',
      whiteSpace: 'pre-wrap', fontFamily: "'DM Sans', sans-serif",
    }}>
      {plain}
    </div>
  )
}

/** Placeholder para canvas sem imageBase64 */
function CanvasPlaceholder({ onOpen, canvasTextContent }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: 320, gap: 16,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: '#F5F2EC', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 28,
      }}>
        ✏️
      </div>

      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#5C5C5C', marginBottom: 8 }}>
          Anotação em Canvas
        </div>
        {canvasTextContent ? (
          <p style={{ fontSize: 13.5, color: '#7B7B7B', lineHeight: 1.7, margin: '0 0 16px' }}>
            {canvasTextContent}
          </p>
        ) : (
          <p style={{ fontSize: 13, color: '#B0ADA8', margin: '0 0 16px' }}>
            Abra para visualizar o canvas completo.
          </p>
        )}
      </div>

      <button
        onClick={onOpen}
        style={{
          padding: '8px 22px', background: '#4A7C59', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
          cursor: 'pointer', transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#3D6B4A' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#4A7C59' }}
      >
        ✏ Abrir canvas
      </button>
    </div>
  )
}

/** Uma página A4 do prontuário */
function A4Page({ session: s, onOpen, pageRef, active, pageWidth }) {
  const date    = formatDate(s.finishedAt || s.createdAt)
  const isCanvas = s.type === 'canvas'
  const w = pageWidth || A4_W
  const contentPad = w < 500 ? '16px 20px 28px' : '32px 48px 48px'

  return (
    <div
      ref={pageRef}
      data-session-id={s.id}
      style={{
        width: w, minHeight: Math.round(w * 1.414),
        background: '#fff',
        boxShadow: active
          ? '0 0 0 2px #5C8F6A, 0 6px 40px rgba(0,0,0,0.14)'
          : '0 4px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.05)',
        borderRadius: 4,
        display: 'flex', flexDirection: 'column',
        flexShrink: 0,
        transition: 'box-shadow 0.2s',
        overflow: 'hidden',
      }}
    >
      {/* ── Cabeçalho da página ──────────────────────────────────────────── */}
      <div style={{
        padding: '16px 32px 14px',
        borderBottom: '1px solid #F0EDE8',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#555', fontWeight: 500 }}>{date}</span>

          <span style={{
            padding: '2px 9px', borderRadius: 4, fontSize: 12, fontWeight: 600,
            background: isCanvas ? '#FDF3E7' : '#EBF5EE',
            color: isCanvas ? '#7B5E3A' : '#2D6A4F',
          }}>
            {isCanvas ? 'Canvas' : 'Texto'}
          </span>

          {s.hasAnalysis && (
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
              background: '#EEF7F1', color: '#3D7A55', letterSpacing: '0.2px',
            }}>
              ✦ Analisado
            </span>
          )}

          {s.wordCount > 0 && (
            <span style={{ fontSize: 12, color: '#B0ADA8' }}>
              {s.wordCount} palavras
            </span>
          )}
        </div>

        {/* Botão abrir */}
        <button
          onClick={onOpen}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 14px',
            background: '#F5F2EC', border: '1px solid #E8E5E0',
            borderRadius: 6, fontSize: 12.5, fontWeight: 600,
            color: '#4A7C59', cursor: 'pointer', transition: 'all 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#4A7C59'
            e.currentTarget.style.color = '#fff'
            e.currentTarget.style.borderColor = '#4A7C59'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#F5F2EC'
            e.currentTarget.style.color = '#4A7C59'
            e.currentTarget.style.borderColor = '#E8E5E0'
          }}
        >
          ✏ Abrir
        </button>
      </div>

      {/* ── Conteúdo da página ───────────────────────────────────────────── */}
      <div style={{
        flex: 1, padding: contentPad,
        minHeight: `calc(${Math.round(w * 1.414)}px - 57px)`,
      }}>
        {isCanvas ? (
          s.imageBase64 ? (
            <img
              src={`data:image/png;base64,${s.imageBase64}`}
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 2 }}
              alt="Anotação em canvas"
            />
          ) : (
            <CanvasPlaceholder onOpen={onOpen} canvasTextContent={s.canvasTextContent} />
          )
        ) : (
          <TextContent
            notePreview={s.notePreview}
            htmlContent={s.htmlContent}
            textContent={s.textContent}
          />
        )}

        {/* Se texto foi cortado (só tem preview) */}
        {!isCanvas && !s.htmlContent && !s.textContent && s.notePreview && s.wordCount > 0 && (
          <div style={{
            marginTop: 24, paddingTop: 16,
            borderTop: '1px dashed #E8E5E0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12.5, color: '#B0ADA8', fontStyle: 'italic' }}>
              Visualizando prévia · {s.wordCount} palavras no total
            </span>
            <button
              onClick={onOpen}
              style={{
                fontSize: 12.5, color: '#4A7C59', background: 'none',
                border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0,
              }}
            >
              Ver completo →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sidebar thumbnail ──────────────────────────────────────────────────────────

function SidebarThumb({ session: s, active, onClick }) {
  const dateStr = formatDateShort(s.finishedAt || s.createdAt)

  return (
    <button
      data-sidebar-id={s.id}
      onClick={onClick}
      title={formatDate(s.finishedAt || s.createdAt)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 5, padding: '10px 8px',
        border: 'none', cursor: 'pointer',
        background: active ? 'rgba(74,124,89,0.30)' : 'transparent',
        borderLeft: `2px solid ${active ? '#5C8F6A' : 'transparent'}`,
        transition: 'background 0.15s',
        width: '100%',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      {/* Miniatura A4 */}
      <div style={{
        width: THUMB_W, height: THUMB_H, borderRadius: 3,
        overflow: 'hidden', flexShrink: 0,
        border: `1.5px solid ${active ? '#5C8F6A' : 'rgba(255,255,255,0.12)'}`,
        background: '#2A3830',
        position: 'relative', transition: 'border-color 0.15s',
      }}>
        {s.type === 'canvas' && s.imageBase64 ? (
          <img
            src={`data:image/png;base64,${s.imageBase64}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            alt=""
          />
        ) : s.type === 'canvas' ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 4,
          }}>
            <span style={{ fontSize: 20 }}>✏️</span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2px' }}>Canvas</span>
          </div>
        ) : (
          // Mini-texto simulado
          <div style={{ padding: '7px 6px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {[0.9, 0.6, 0.85, 0.5, 0.75, 0.4, 0.9, 0.65, 0.3].map((w, i) => (
              <div
                key={i}
                style={{
                  height: 2, borderRadius: 1,
                  background: 'rgba(255,255,255,0.18)',
                  width: `${Math.round(w * 100)}%`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Data curta */}
      <span style={{
        fontSize: 10, textAlign: 'center', lineHeight: 1.3, letterSpacing: '-0.2px',
        color: active ? '#9DC4A8' : 'rgba(255,255,255,0.42)',
        transition: 'color 0.15s',
      }}>
        {dateStr}
      </span>
    </button>
  )
}

// ── Estado vazio ───────────────────────────────────────────────────────────────

function EmptyState({ patientFirstName, onNewAnnotation }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flex: 1, gap: 16, padding: '48px 32px',
    }}>
      <div style={{ fontSize: 56 }}>📄</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#1C1C1C' }}>
        Nenhuma anotação ainda
      </div>
      <p style={{
        fontSize: 14.5, textAlign: 'center', maxWidth: 340,
        margin: 0, lineHeight: 1.7, color: '#7B7B7B',
      }}>
        Registre a primeira anotação de{' '}
        <strong style={{ color: '#1C1C1C' }}>{patientFirstName}</strong>{' '}
        para construir o prontuário clínico.
      </p>
      <button
        onClick={onNewAnnotation}
        style={{
          marginTop: 8, padding: '11px 28px',
          background: '#4A7C59', color: '#fff',
          border: 'none', borderRadius: 8,
          fontSize: 14.5, fontWeight: 600, cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#3D6B4A' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#4A7C59' }}
      >
        + Nova anotação
      </button>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

export default function ProntuarioView({
  patient,
  onClose,
  onNewAnnotation,
  onOpenCanvas,
  onReopenSession,
}) {
  const [sessions, setSessions]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [activeTab, setActiveTab] = useState('all')   // 'all' | 'text' | 'canvas'
  const [activePage, setActivePage] = useState(null)  // session.id da página visível
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768)

  const pageRefs  = useRef({})   // { [sessionId]: DOMElement }
  const mainRef   = useRef(null)
  const sidebarRef = useRef(null)
  const pageWidth = useA4Width()

  // Ajusta sidebar ao resize
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const handler = (e) => { if (e.matches) setSidebarOpen(false) }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ── Buscar sessões do paciente ───────────────────────────────────────────
  useEffect(() => {
    if (!patient?.id) return
    setLoading(true)
    api.getPatientSessions(patient.id, { page: 0, size: 100 })
      .then(res => {
        const items = Array.isArray(res) ? res : (res?.content || [])
        setSessions(items)
        if (items.length > 0) setActivePage(items[0].id)
      })
      .catch(err => {
        console.error('[ProntuarioView] getPatientSessions:', err)
        setSessions([])
      })
      .finally(() => setLoading(false))
  }, [patient?.id])

  // ── Filtro por aba ───────────────────────────────────────────────────────
  const filtered = sessions.filter(s => {
    if (activeTab === 'text')   return s.type === 'text'
    if (activeTab === 'canvas') return s.type === 'canvas'
    return true
  })

  const textCount   = sessions.filter(s => s.type === 'text').length
  const canvasCount = sessions.filter(s => s.type === 'canvas').length

  // ── IntersectionObserver — rastreia qual página está visível ────────────
  useEffect(() => {
    if (!mainRef.current || filtered.length === 0) return

    const observer = new IntersectionObserver(
      entries => {
        // Pega a primeira entrada visível (mais próxima do topo)
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActivePage(visible[0].target.dataset.sessionId)
        }
      },
      {
        root: mainRef.current,
        rootMargin: '-10% 0px -60% 0px',
        threshold: 0,
      }
    )

    filtered.forEach(s => {
      const el = pageRefs.current[s.id]
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [filtered.map(s => s.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sincroniza sidebar com página ativa ──────────────────────────────────
  useEffect(() => {
    if (!activePage || !sidebarRef.current) return
    const el = sidebarRef.current.querySelector(`[data-sidebar-id="${activePage}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activePage])

  const scrollToPage = useCallback((sessionId) => {
    const el = pageRefs.current[sessionId]
    if (el && mainRef.current) {
      // Scroll dentro do container, não window
      const containerTop  = mainRef.current.getBoundingClientRect().top
      const elTop         = el.getBoundingClientRect().top
      const scrollDelta   = elTop - containerTop - 32 // 32px de padding topo
      mainRef.current.scrollBy({ top: scrollDelta, behavior: 'smooth' })
    }
  }, [])

  const handleOpenSession = useCallback((s) => {
    if (s.type === 'canvas') {
      onOpenCanvas?.(s)
    } else {
      onReopenSession?.(s)
    }
  }, [onOpenCanvas, onReopenSession])

  const initials     = getInitials(patient?.name)
  const avatarBg     = patient?.avatarBg    || '#4A7C59'
  const avatarColor  = patient?.avatarColor || '#fff'
  const firstName    = patient?.name?.split(' ')[0] || 'este paciente'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#EDEAE4',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'DM Sans', sans-serif",
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        height: 56, flexShrink: 0,
        background: '#2D4A38',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 12,
      }}>
        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(p => !p)}
          title={sidebarOpen ? 'Ocultar miniaturas' : 'Mostrar miniaturas'}
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: sidebarOpen ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.8)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
          onMouseLeave={e => e.currentTarget.style.background = sidebarOpen ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>

        {/* Voltar */}
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none',
            color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 13.5, padding: '4px 10px', borderRadius: 6,
            transition: 'color 0.15s', fontFamily: 'inherit', flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.65)' }}
        >
          ← Pacientes
        </button>

        {/* Divisor */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

        {/* Avatar + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: avatarBg, color: avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
          </div>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
            {patient?.name || 'Paciente'}
          </span>
        </div>

        {/* Abas */}
        <div className="prontuario-tabs" style={{ marginLeft: 'auto' }}>
          {[
            { key: 'all',    label: `Todas (${sessions.length})` },
            { key: 'text',   label: `Texto (${textCount})` },
            { key: 'canvas', label: `Canvas (${canvasCount})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
                transition: 'all 0.15s', fontFamily: 'inherit',
                background: activeTab === tab.key ? 'rgba(255,255,255,0.22)' : 'transparent',
                color:      activeTab === tab.key ? '#fff' : 'rgba(255,255,255,0.55)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Nova anotação */}
        <button
          onClick={onNewAnnotation}
          style={{
            marginLeft: 8, flexShrink: 0,
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.22)',
            color: '#fff', padding: '6px 12px',
            borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.15s',
            fontFamily: 'inherit', minWidth: 36, minHeight: 36,
            justifyContent: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.24)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)' }}
        >
          +<span className="pron-new-label"> Nova anotação</span>
        </button>
      </div>

      {/* ── Body: sidebar + área de páginas ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar — colapsável */}
        <div
          ref={sidebarRef}
          className="prontuario-sidebar"
          style={{
            width: sidebarOpen ? 136 : 0,
            flexShrink: 0,
            background: '#1C2820',
            overflowY: sidebarOpen ? 'auto' : 'hidden',
            overflowX: 'hidden',
            display: 'flex', flexDirection: 'column',
            paddingTop: sidebarOpen ? 8 : 0,
            paddingBottom: sidebarOpen ? 16 : 0,
            transition: 'width 0.2s ease, padding 0.2s ease',
          }}
        >
          {loading && (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
              ...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
              Nenhuma
            </div>
          )}
          {!loading && filtered.map(s => (
            <SidebarThumb
              key={s.id}
              session={s}
              active={activePage === s.id}
              onClick={() => scrollToPage(s.id)}
            />
          ))}
        </div>

        {/* Área de páginas */}
        <div
          ref={mainRef}
          className="prontuario-pages"
          style={{
            flex: 1, overflowY: 'auto',
            padding: '32px 24px 64px',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 32,
          }}
        >
          {loading ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', flex: 1, gap: 14, color: '#8B8B8B', fontSize: 14,
              minHeight: '60vh',
            }}>
              <span style={{
                width: 28, height: 28,
                border: '2px solid #E8E5E0', borderTopColor: '#4A7C59',
                borderRadius: '50%', display: 'inline-block',
                animation: 'pron-spin 0.8s linear infinite',
              }} />
              Carregando anotações…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              patientFirstName={firstName}
              onNewAnnotation={onNewAnnotation}
            />
          ) : (
            filtered.map(s => (
              <A4Page
                key={s.id}
                session={s}
                active={activePage === s.id}
                onOpen={() => handleOpenSession(s)}
                pageRef={el => { pageRefs.current[s.id] = el }}
                pageWidth={pageWidth}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Estilos globais injetados ────────────────────────────────────── */}
      <style>{`
        @keyframes pron-spin { to { transform: rotate(360deg) } }

        /* Scrollbar minimalista */
        .prontuario-sidebar::-webkit-scrollbar { width: 4px }
        .prontuario-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px }

        /* Estilos do conteúdo HTML de sessões de texto */
        .prontuario-html-content h1,
        .prontuario-html-content h2,
        .prontuario-html-content h3 {
          font-weight: 700; margin: 0.8em 0 0.3em; color: #1C1C1C;
        }
        .prontuario-html-content p { margin: 0 0 0.8em }
        .prontuario-html-content p:last-child { margin-bottom: 0 }
        .prontuario-html-content ul,
        .prontuario-html-content ol { padding-left: 1.4em; margin: 0.5em 0 }
        .prontuario-html-content li { margin-bottom: 0.25em }
        .prontuario-html-content strong { font-weight: 700 }
        .prontuario-html-content em { font-style: italic }

        /* Sidebar: scrollbar minimalista */
        .prontuario-sidebar { min-width: 0 }

        /* Header: tabs com scroll horizontal em telas pequenas */
        .prontuario-tabs {
          display: flex; gap: 2px;
          background: rgba(255,255,255,0.10); border-radius: 8px; padding: 3px;
          overflow-x: auto; flex-shrink: 1;
        }
        .prontuario-tabs::-webkit-scrollbar { display: none }

        /* Nova anotação: oculta label em telas muito pequenas, mantém ícone */
        @media (max-width: 480px) {
          .pron-new-label { display: none }
        }

        /* Área de páginas: padding menor em mobile */
        @media (max-width: 640px) {
          .prontuario-pages { padding: 16px 12px 48px !important; gap: 20px !important; }
        }
        @media (max-width: 900px) {
          .prontuario-pages { padding: 20px 16px 48px !important; }
        }
      `}</style>
    </div>
  )
}
