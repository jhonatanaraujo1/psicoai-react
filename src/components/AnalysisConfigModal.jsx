/**
 * AnalysisConfigModal — pré-configuração antes de disparar análise IA.
 *
 * 1. Escopo: todas as anotações OU seleção manual por data
 * 2. Tipo: Geral · Risco · Longitudinal
 *    → Risco e Longitudinal bloqueados para plano Consultório (evita crédito perdido em 422)
 * 3. Créditos: pips visuais para plano Consultório; oculto para Especialista/ilimitado
 *
 * Props:
 *   patient      { id, name }
 *   currentUser  { analysesRemaining, plan }
 *   onConfirm    ({ noteIds: string[], template: string|null }) → void
 *   onCancel     () → void
 */

import { useState, useEffect } from 'react'
import { api } from '../services'

// ── Constantes ────────────────────────────────────────────────────────────────

const UNLIMITED = 2147483647 // Int.MAX_VALUE

const RESTRICTED_PLANS = ['consultorio', 'base']

const ANALYSIS_TYPES = [
  {
    id: null,
    label: 'Geral',
    premiumOnly: false,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
    desc: 'Hipóteses diagnósticas, padrões comportamentais e evolução clínica',
  },
  {
    id: 'risk',
    label: 'Risco',
    premiumOnly: true,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
    ),
    desc: 'Foco em sinais de crise, ideação e fatores de risco imediato',
  },
  {
    id: 'longitudinal',
    label: 'Longitudinal',
    premiumOnly: true,
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    desc: 'Progressão ao longo do tempo: melhoras, recaídas e tendências',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fmtNoteDate(iso) {
  if (!iso) return '—'
  const parts = iso.split('-')
  const d = parseInt(parts[2], 10)
  const m = parseInt(parts[1], 10)
  const y = parts[0]
  return `${String(d).padStart(2,'0')} ${MONTHS[m-1]}. ${y}`
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1,2,3].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <div className="skel-pulse" style={{ width: 16, height: 16, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ flex: 1 }}>
            <div className="skel-pulse" style={{ height: 11, width: '35%', borderRadius: 3, marginBottom: 5, background: 'rgba(255,255,255,0.08)' }} />
            <div className="skel-pulse" style={{ height: 10, width: '65%', borderRadius: 3, background: 'rgba(255,255,255,0.05)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Pacotes de compra avulsa de análises
const PACKS = [
  { qty: 1,  label: '1 análise',   price: 'R$4,90',  unitLabel: 'R$4,90/un' },
  { qty: 5,  label: '5 análises',  price: 'R$19,90', unitLabel: 'R$3,98/un' },
  { qty: 10, label: '10 análises', price: 'R$34,90', unitLabel: 'R$3,49/un' },
]

// ── Credit pips ───────────────────────────────────────────────────────────────

function CreditBlock({ remaining, plan, onBuyPack, purchasing }) {
  const isUnlimited = remaining >= UNLIMITED || !RESTRICTED_PLANS.includes(plan)
  if (isUnlimited) return null // Especialista — sem ruído visual

  const TOTAL = 5
  const used  = Math.max(0, TOTAL - Math.min(remaining, TOTAL))
  const isPPU = remaining <= 0

  return (
    <div style={{
      padding: '12px 22px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {/* Linha 1: pips + status */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Pips: verde = disponível, cinza = usado */}
          <div style={{ display: 'flex', gap: 3 }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i < used
                  ? 'rgba(255,255,255,0.18)'
                  : isPPU ? 'rgba(251,191,36,0.4)' : '#4ade80',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: isPPU ? 'rgba(251,191,36,0.75)' : 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', sans-serif" }}>
            {isPPU
              ? 'Análises do plano esgotadas'
              : `${remaining} análise${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''} este mês`}
          </span>
        </div>
        {!isPPU && (
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Sans', sans-serif" }}>
            Plano Consultório
          </span>
        )}
      </div>

      {/* Linha 2 (só quando esgotado): pacotes de compra */}
      {isPPU && (
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
            Adicionar créditos de análise:
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {PACKS.map(p => (
              <button
                key={p.qty}
                onClick={() => onBuyPack(p.qty)}
                disabled={purchasing}
                style={{
                  padding: '7px 13px', borderRadius: 8, cursor: purchasing ? 'not-allowed' : 'pointer',
                  background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)',
                  color: '#4ade80', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600,
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
                  opacity: purchasing ? 0.6 : 1, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!purchasing) e.currentTarget.style.background = 'rgba(74,222,128,0.15)' }}
                onMouseLeave={e => { if (!purchasing) e.currentTarget.style.background = 'rgba(74,222,128,0.08)' }}
              >
                <span>{p.label}</span>
                <span style={{ fontSize: 10, color: 'rgba(74,222,128,0.6)', fontWeight: 500 }}>
                  {p.price} · {p.unitLabel}
                </span>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: "'DM Sans', sans-serif" }}>
            Ou continue — cobrado automaticamente R$4,90 por análise
          </div>
        </div>
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AnalysisConfigModal({ patient, currentUser, onConfirm, onCancel }) {
  const [notes, setNotes]               = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [scope, setScope]               = useState('all')   // 'all' | 'select'
  const [selectedIds, setSelectedIds]   = useState(new Set())
  const [template, setTemplate]         = useState(null)    // null | 'risk' | 'longitudinal'
  const [submitting, setSubmitting]     = useState(false)
  const [purchasing, setPurchasing]     = useState(false)

  const plan      = currentUser?.plan ?? 'consultorio'
  const remaining = currentUser?.analysesRemaining ?? 0
  const isRestricted = RESTRICTED_PLANS.includes(plan)

  const handleBuyPack = async (quantity) => {
    if (purchasing) return
    setPurchasing(true)
    try {
      const res = await api.purchaseAnalysisPack({
        quantity,
        successUrl: window.location.origin,
        cancelUrl: window.location.href,
      })
      // Redireciona para o Stripe Checkout. Após pagamento, Stripe devolve para
      // successUrl?analyses_purchased=N, onde App.jsx processa o retorno.
      window.location.href = res.url
    } catch {
      // Erro de infra — nunca expor e.message (pode conter dados de billing)
      setPurchasing(false)
    }
  }

  // Carrega anotações do paciente ao abrir
  useEffect(() => {
    if (!patient?.id) return
    setLoadingNotes(true)
    api.getPatientNotes(patient.id, { size: 50 })
      .then(res => {
        const list = (res?.content || []).sort((a, b) => {
          const da = a.sessionDate || a.noteDate || a.createdAt || ''
          const db = b.sessionDate || b.noteDate || b.createdAt || ''
          return db.localeCompare(da)
        })
        setNotes(list)
        setSelectedIds(new Set(list.map(n => n.id)))
      })
      .catch(() => setNotes([]))
      .finally(() => setLoadingNotes(false))
  }, [patient?.id])

  // ESC fecha
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onCancel])

  const toggleNote = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === notes.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(notes.map(n => n.id)))
  }

  const handleConfirm = () => {
    if (submitting) return
    setSubmitting(true)
    const noteIds = scope === 'all' ? [] : Array.from(selectedIds)
    onConfirm({ noteIds, template })
  }

  const canConfirm = scope === 'all' || selectedIds.size > 0

  const initials = patient?.name?.split(' ').slice(0, 2).map(w => w[0]).join('') || '?'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        borderRadius: 18, overflow: 'hidden',
        background: 'linear-gradient(160deg, #0d1f15 0%, #0f1a14 55%, #111820 100%)',
        border: '1px solid rgba(74,222,128,0.14)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(74,222,128,0.06)',
        animation: 'acm-in 0.22s cubic-bezier(0.22,1,0.36,1)',
      }}>
        <style>{`
          @keyframes acm-in { from{opacity:0;transform:scale(0.96)translateY(8px)} to{opacity:1;transform:scale(1)translateY(0)} }
          .acm-note-row:hover { background: rgba(255,255,255,0.05) !important; }
        `}</style>

        {/* ── Header ── */}
        <div style={{
          padding: '20px 22px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(74,222,128,0.04)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(74,222,128,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#4ade80', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', fontFamily: "'Fraunces', serif" }}>
              {patient?.name}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              Configurar análise clínica com IA
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}
          >✕</button>
        </div>

        {/* ── Body (scrollável) ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(74,222,128,0.2) transparent' }}>

          {/* ── Bloco 1: Escopo ── */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
              Escopo das anotações
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: scope === 'select' ? 14 : 0 }}>
              {[
                { id: 'all',    label: `Todas${notes.length > 0 ? ` (${notes.length})` : ''}` },
                { id: 'select', label: 'Selecionar' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setScope(opt.id)}
                  style={{
                    padding: '8px 18px', borderRadius: 20, cursor: 'pointer',
                    fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
                    border: `1.5px solid ${scope === opt.id ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.1)'}`,
                    background: scope === opt.id ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.04)',
                    color: scope === opt.id ? '#4ade80' : 'rgba(255,255,255,0.5)',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Lista de anotações selecionáveis */}
            {scope === 'select' && (
              <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 14px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.03)',
                }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                    {selectedIds.size} de {notes.length} selecionadas
                  </span>
                  <button
                    onClick={toggleAll}
                    style={{ fontSize: 11, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600, padding: '2px 4px' }}
                  >
                    {selectedIds.size === notes.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </button>
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                  {loadingNotes ? <div style={{ padding: '14px 14px' }}><Skeleton /></div> : (
                    notes.length === 0 ? (
                      <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
                        Nenhuma anotação encontrada para este paciente.
                      </div>
                    ) : (
                      notes.map((note, idx) => {
                        const checked = selectedIds.has(note.id)
                        const dateStr = fmtNoteDate(note.sessionDate || note.noteDate)
                        const preview = note.notePreview || note.preview || (note.type === 'canvas' ? 'Anotação em canvas' : 'Sem texto')
                        const pos = note.num || `P${(note.position ?? idx) + 1}`
                        return (
                          <div
                            key={note.id}
                            className="acm-note-row"
                            onClick={() => toggleNote(note.id)}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 10,
                              padding: '10px 14px',
                              borderBottom: idx < notes.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                              cursor: 'pointer', transition: 'background 0.12s',
                              background: checked ? 'rgba(74,222,128,0.06)' : 'transparent',
                            }}
                          >
                            <div style={{
                              width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                              border: `1.5px solid ${checked ? '#4ade80' : 'rgba(255,255,255,0.2)'}`,
                              background: checked ? 'rgba(74,222,128,0.2)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.12s',
                            }}>
                              {checked && (
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="3" strokeLinecap="round">
                                  <polyline points="20 6 9 17 4 12"/>
                                </svg>
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: checked ? '#4ade80' : 'rgba(255,255,255,0.5)', fontFamily: "'Fraunces', serif" }}>
                                  {pos}
                                </span>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
                                  {dateStr}
                                </span>
                                {note.type === 'canvas' && (
                                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(125,60,152,0.2)', color: '#B39DDB', fontWeight: 600, letterSpacing: '0.3px' }}>
                                    CANVAS
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {preview.slice(0, 90)}{preview.length > 90 ? '…' : ''}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Bloco 2: Tipo de análise ── */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>
              Tipo de análise
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ANALYSIS_TYPES.map(t => {
                const active   = template === t.id
                const locked   = t.premiumOnly && isRestricted
                const disabled = locked

                return (
                  <button
                    key={String(t.id)}
                    onClick={() => !disabled && setTemplate(t.id)}
                    disabled={disabled}
                    title={locked ? 'Disponível no plano Especialista' : undefined}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px', borderRadius: 10, textAlign: 'left',
                      border: `1.5px solid ${active ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.08)'}`,
                      background: active
                        ? 'rgba(74,222,128,0.09)'
                        : disabled ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      transition: 'all 0.15s',
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                    onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { if (!active && !disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  >
                    {/* Ícone */}
                    <div style={{
                      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                      background: active ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${active ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: active ? '#4ade80' : 'rgba(255,255,255,0.35)',
                      transition: 'all 0.15s',
                    }}>
                      {t.icon}
                    </div>
                    {/* Texto */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: active ? '#f1f5f9' : 'rgba(255,255,255,0.6)', transition: 'color 0.15s' }}>
                          {t.label}
                        </span>
                        {locked && (
                          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', padding: '1px 6px', borderRadius: 10, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)', textTransform: 'uppercase' }}>
                            Especialista
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                        {t.desc}
                      </div>
                    </div>
                    {/* Radio indicator */}
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                      border: `2px solid ${active ? '#4ade80' : 'rgba(255,255,255,0.2)'}`,
                      background: 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'border-color 0.15s',
                    }}>
                      {active && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80' }} />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Bloco de créditos (só Consultório) ── */}
        <CreditBlock remaining={remaining} plan={plan} onBuyPack={handleBuyPack} purchasing={purchasing} />

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 22px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexShrink: 0,
        }}>
          <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.18)', lineHeight: 1.5, maxWidth: 260 }}>
            Hipóteses de suporte ao raciocínio clínico · diagnóstico é responsabilidade do profissional
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onCancel}
              style={{
                padding: '9px 18px', borderRadius: 9,
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.45)', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm || submitting}
              style={{
                padding: '9px 20px', borderRadius: 9,
                background: !canConfirm || submitting
                  ? 'rgba(74,222,128,0.15)'
                  : 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                border: 'none', color: !canConfirm || submitting ? 'rgba(74,222,128,0.4)' : '#0a1a0f',
                cursor: !canConfirm || submitting ? 'not-allowed' : 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'all 0.15s',
              }}
            >
              {submitting ? (
                <>
                  <span style={{ width: 12, height: 12, border: '2px solid rgba(10,26,15,0.3)', borderTopColor: '#0a1a0f', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Iniciando…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                  Analisar com IA
                  {remaining <= 0 && !( remaining >= UNLIMITED || !RESTRICTED_PLANS.includes(plan)) && (
                    <span style={{ fontSize: 11, opacity: 0.7 }}>· R$4,90</span>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
