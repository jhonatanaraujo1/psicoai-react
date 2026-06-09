/**
 * PatientAnalysisHub — Timeline de análises IA de um paciente.
 *
 * Cada análise é um snapshot clínico imutável.
 * Acesso via Insights → clicar paciente (com ou sem análises).
 *
 * Props:
 *   patient          { id, name }
 *   currentUser      { analysesRemaining, plan }
 *   onBack           () → volta para Insights
 *   onOpenAnalysis   (analysisId, patient) → abre AnalysisDetailView
 *   onNewAnalysis    (patient) → abre AnalysisConfigModal
 */

import { useState, useEffect } from 'react'
import { api } from '../services'

// ── Constantes ────────────────────────────────────────────────────────────────

const UNLIMITED = 2147483647 // Int.MAX_VALUE — planos ilimitados

const TEMPLATE_META = {
  null:          { label: 'Geral',         color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.25)'   },
  undefined:     { label: 'Geral',         color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.25)'   },
  risk:          { label: 'Risco',         color: '#f87171', bg: 'rgba(248,113,113,0.12)',  border: 'rgba(248,113,113,0.25)'  },
  longitudinal:  { label: 'Longitudinal',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)'  },
}

const EVOLUTION_DOT = {
  positive: '#4ade80',
  negative: '#f87171',
  neutral:  '#fbbf24',
}

const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fmtDate(iso) {
  if (!iso) return '—'
  // "2026-06-07T14:32:00Z" → "07 jun 2026 · 14h32"
  const d = new Date(iso)
  const day  = String(d.getDate()).padStart(2, '0')
  const mon  = MONTHS[d.getMonth()]
  const yr   = d.getFullYear()
  const hh   = String(d.getHours()).padStart(2, '0')
  const mm   = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${mon} ${yr} · ${hh}h${mm}`
}

function fmtRelative(iso) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days < 7)  return `${days} dias atrás`
  if (days < 30) return `${Math.floor(days / 7)} sem. atrás`
  if (days < 365) return `${Math.floor(days / 30)} meses atrás`
  return `${Math.floor(days / 365)} ano${Math.floor(days / 365) > 1 ? 's' : ''} atrás`
}

function templateMeta(t) {
  return TEMPLATE_META[t] ?? TEMPLATE_META.null
}

// ── Credit Pips ───────────────────────────────────────────────────────────────

function CreditPips({ remaining, plan }) {
  const isUnlimited = remaining >= UNLIMITED || plan === 'especialista' || plan === 'clinico'
  if (isUnlimited) return null

  const TOTAL = 5
  const used  = Math.max(0, TOTAL - remaining)
  const isPPU = remaining <= 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Pips */}
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i < used ? 'rgba(255,255,255,0.18)' : (isPPU ? 'rgba(251,191,36,0.5)' : '#4ade80'),
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 11, color: isPPU ? 'rgba(251,191,36,0.75)' : 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
        {isPPU
          ? 'Análises incluídas esgotadas · R$4,90/un'
          : `${remaining} análise${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''} este mês`}
      </span>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 16, paddingBottom: 28, position: 'relative' }}>
          {/* Linha vertical */}
          {i < 3 && (
            <div style={{
              position: 'absolute', left: 4, top: 12, bottom: 0,
              width: 1, background: 'rgba(255,255,255,0.06)',
            }} />
          )}
          {/* Dot */}
          <div className="skel-pulse" style={{
            width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 3,
            background: 'rgba(255,255,255,0.08)',
          }} />
          {/* Conteúdo */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <div className="skel-pulse" style={{ height: 12, width: 130, borderRadius: 4 }} />
              <div className="skel-pulse" style={{ height: 18, width: 72, borderRadius: 20 }} />
            </div>
            <div className="skel-pulse" style={{ height: 11, width: '70%', borderRadius: 4, marginBottom: 5 }} />
            <div className="skel-pulse" style={{ height: 11, width: '45%', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── AnalysisRow ────────────────────────────────────────────────────────────────

function AnalysisRow({ analysis, index, total, isFirst, onOpen }) {
  const [hovered, setHovered] = useState(false)
  const meta = templateMeta(analysis.template)
  const evColor = EVOLUTION_DOT[analysis.evolution] || EVOLUTION_DOT.neutral
  const isLast = index === total - 1

  const scopeLabel = analysis.scope === 'notebook'
    ? 'Caderno completo'
    : analysis.scope === 'selection'
      ? `${analysis.noteCount ?? '?'} anotações selecionadas`
      : 'Anotação única'

  const isProcessing = analysis.status === 'processing'
  const isFailed     = analysis.status === 'failed'

  return (
    <div
      style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 28, position: 'relative', cursor: 'pointer' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !isProcessing && !isFailed && onOpen(analysis.id)}
    >
      {/* Linha vertical */}
      {!isLast && (
        <div style={{
          position: 'absolute', left: 4, top: 12, bottom: 0,
          width: 1, background: 'rgba(255,255,255,0.07)',
          zIndex: 0,
        }} />
      )}

      {/* Dot */}
      <div style={{
        width: isFirst ? 10 : 8, height: isFirst ? 10 : 8, borderRadius: '50%',
        flexShrink: 0, marginTop: 4, zIndex: 1,
        background: isFirst ? evColor : 'rgba(255,255,255,0.15)',
        border: `2px solid ${isFirst ? '#0d1f15' : 'rgba(255,255,255,0.12)'}`,
        boxShadow: isFirst ? `0 0 8px ${evColor}55` : 'none',
        transition: 'all 0.15s',
      }} />

      {/* Conteúdo */}
      <div style={{
        flex: 1, padding: '8px 12px', borderRadius: 10,
        background: hovered && !isProcessing ? 'rgba(255,255,255,0.03)' : 'transparent',
        transition: 'background 0.15s',
        border: '1px solid transparent',
        borderColor: hovered && !isProcessing ? 'rgba(255,255,255,0.06)' : 'transparent',
      }}>
        {/* Linha 1: data + badge + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.65)', fontFamily: "'DM Sans', sans-serif" }}>
            {fmtDate(analysis.createdAt)}
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', padding: '2px 7px', borderRadius: 20,
            background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
            textTransform: 'uppercase', flexShrink: 0,
          }}>
            {meta.label}
          </span>
          {isProcessing && (
            <span style={{ fontSize: 10, color: 'rgba(251,191,36,0.7)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, border: '1.5px solid rgba(251,191,36,0.3)', borderTopColor: 'rgba(251,191,36,0.7)', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
              Gerando…
            </span>
          )}
          {isFailed && (
            <span style={{ fontSize: 10, color: '#f87171' }}>Falha na geração</span>
          )}
        </div>

        {/* Linha 2: scope */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
          {scopeLabel}
          {analysis.noteCount > 0 && analysis.scope !== 'note' && ` · ${analysis.noteCount} anotações`}
        </div>

        {/* Linha 3: preview */}
        {analysis.summary && !isProcessing && !isFailed && (
          <div style={{
            fontSize: 12, fontStyle: 'italic', color: 'rgba(255,255,255,0.32)',
            lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif",
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            "{analysis.summary.slice(0, 160)}{analysis.summary.length > 160 ? '…' : ''}"
          </div>
        )}

        {/* CTA hover */}
        {!isProcessing && !isFailed && (
          <div style={{
            marginTop: 6, fontSize: 11, fontWeight: 600,
            color: hovered ? '#4ade80' : 'rgba(74,222,128,0.4)',
            transition: 'color 0.15s',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Ver análise →
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function PatientAnalysisHub({ patient, currentUser, onBack, onOpenAnalysis, onNewAnalysis }) {
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  const remaining = currentUser?.analysesRemaining ?? 0
  const plan      = currentUser?.plan ?? 'consultorio'

  useEffect(() => {
    if (!patient?.id) return
    setLoading(true)
    setError(null)
    api.getPatientAnalyses(patient.id, { size: 50 })
      .then(res => setAnalyses(res?.content || []))
      .catch(() => setError('Não foi possível carregar o histórico.'))
      .finally(() => setLoading(false))
  }, [patient?.id])

  const initials = patient?.name?.split(' ').slice(0, 2).map(w => w[0]).join('') || '?'

  return (
    <div className="view" style={{ maxWidth: 720 }}>
      {/* ── Breadcrumb + Header ── */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 12, color: 'var(--gr4)', fontFamily: "'DM Sans', sans-serif",
            marginBottom: 14, transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--d)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--gr4)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Insights
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          {/* Paciente */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(74,222,128,0.15)', color: '#4ade80',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 400, color: 'var(--d)', letterSpacing: '-0.02em' }}>
                {patient?.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gr5)', marginTop: 2 }}>
                Análises clínicas com IA
              </div>
            </div>
          </div>

          {/* Créditos + botão nova análise */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <CreditPips remaining={remaining} plan={plan} />
            <button
              onClick={() => onNewAnalysis(patient)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 9, cursor: 'pointer',
                background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
                border: 'none', color: '#0a1a0f',
                fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Nova análise
            </button>
          </div>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {loading ? (
        <TimelineSkeleton />
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(248,113,113,0.4)" strokeWidth="1.2"
            style={{ margin: '0 auto 14px', display: 'block' }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>{error}</div>
          <button
            onClick={() => { setLoading(true); api.getPatientAnalyses(patient.id, { size: 50 }).then(r => { setAnalyses(r?.content || []); setError(null) }).catch(() => setError('Não foi possível carregar o histórico.')).finally(() => setLoading(false)) }}
            style={{ fontSize: 12, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}
          >
            Tentar novamente
          </button>
        </div>
      ) : analyses.length === 0 ? (
        // ── Empty state ──
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.2)" strokeWidth="1"
            style={{ margin: '0 auto 18px', display: 'block' }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
            Nenhuma análise gerada ainda
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', lineHeight: 1.7, marginBottom: 20, maxWidth: 360, margin: '0 auto 20px' }}>
            Configure a primeira análise para começar a construir o histórico clínico de {patient?.name?.split(' ')[0]}.
          </div>
          <button
            onClick={() => onNewAnalysis(patient)}
            style={{
              padding: '10px 22px', borderRadius: 9,
              background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
              border: 'none', color: '#0a1a0f',
              fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            Configurar primeira análise →
          </button>
        </div>
      ) : (
        // ── Timeline ──
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.25)', marginBottom: 20,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Histórico de análises · {analyses.length} registro{analyses.length !== 1 ? 's' : ''}
          </div>
          <div>
            {analyses.map((a, idx) => (
              <AnalysisRow
                key={a.id}
                analysis={a}
                index={idx}
                total={analyses.length}
                isFirst={idx === 0}
                onOpen={(analysisId) => onOpenAnalysis(analysisId, patient)}
              />
            ))}
          </div>

          {/* Disclaimer */}
          <div style={{
            marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)',
            fontSize: 11, color: 'rgba(255,255,255,0.18)', lineHeight: 1.6,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Cada análise é um registro gerado no momento da solicitação e reflete as anotações disponíveis naquela data.
            Hipóteses de suporte ao raciocínio clínico — diagnóstico é de responsabilidade exclusiva do profissional.
          </div>
        </div>
      )}
    </div>
  )
}
