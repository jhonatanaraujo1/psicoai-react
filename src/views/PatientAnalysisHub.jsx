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

const UNLIMITED = 2147483647

const TEMPLATE_META = {
  reflexao_clinica: { label: 'Geral',         color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  null:             { label: 'Geral',         color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  undefined:        { label: 'Geral',         color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  risk:             { label: 'Risco',         color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  foco_risco:       { label: 'Risco',         color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  longitudinal:     { label: 'Longitudinal',  color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  evolucao_longitudinal: { label: 'Longitudinal', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  supervisao_clinica:    { label: 'Supervisão',   color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  psicodinamica:         { label: 'Psicodinâmica', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
}

const EVOLUTION_CHIP = {
  positive: { label: '↑ Positiva', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  negative: { label: '↓ Atenção',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  neutral:  { label: '→ Neutra',   color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
}

const EVOLUTION_DOT = {
  positive: '#16a34a',
  negative: '#dc2626',
  neutral:  '#d97706',
}

const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, '0')
  const mon = MONTHS[d.getMonth()]
  const yr  = d.getFullYear()
  const hh  = String(d.getHours()).padStart(2, '0')
  const mm  = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${mon} ${yr} · ${hh}h${mm}`
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
      <div style={{ display: 'flex', gap: 3 }}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i < used
              ? 'var(--gr3)'
              : isPPU ? '#fbbf24' : '#16a34a',
            transition: 'background 0.2s',
          }} />
        ))}
      </div>
      <span style={{
        fontSize: 11,
        color: isPPU ? '#d97706' : 'var(--gr5)',
        whiteSpace: 'nowrap',
      }}>
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
          {i < 3 && (
            <div style={{
              position: 'absolute', left: 4, top: 12, bottom: 0,
              width: 1, background: 'var(--gr2)',
            }} />
          )}
          <div className="skel-pulse" style={{
            width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 3,
            background: 'var(--gr2)',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <div className="skel-pulse" style={{ height: 13, width: 150, borderRadius: 4, background: 'var(--gr2)' }} />
              <div className="skel-pulse" style={{ height: 20, width: 60, borderRadius: 20, background: 'var(--gr2)' }} />
            </div>
            <div className="skel-pulse" style={{ height: 12, width: '75%', borderRadius: 4, marginBottom: 6, background: 'var(--gr2)' }} />
            <div className="skel-pulse" style={{ height: 12, width: '50%', borderRadius: 4, background: 'var(--gr2)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── AnalysisRow ───────────────────────────────────────────────────────────────

function AnalysisRow({ analysis, index, total, isFirst, onOpen, onRetry }) {
  const [hovered, setHovered] = useState(false)
  const meta    = templateMeta(analysis.template)
  const evColor = EVOLUTION_DOT[analysis.evolution] ?? EVOLUTION_DOT.neutral
  const evChip  = EVOLUTION_CHIP[analysis.evolution] ?? EVOLUTION_CHIP.neutral
  const isLast  = index === total - 1

  const isProcessing = analysis.status === 'processing'
  const isFailed     = analysis.status === 'failed'
  // Fallback: se status ausente/desconhecido, assume completed (retrocompatibilidade com mock e dados legados)
  const isCompleted  = !isProcessing && !isFailed

  const scopeLabel = analysis.scope === 'notebook'
    ? 'Caderno completo'
    : analysis.scope === 'selection'
      ? `${analysis.noteCount ?? '?'} anotações selecionadas`
      : 'Anotação única'

  const noteInfo = analysis.noteCount > 0 && analysis.scope !== 'note'
    ? ` · ${analysis.noteCount} anotação${analysis.noteCount !== 1 ? 'ões' : ''}`
    : ''

  return (
    <div
      style={{ display: 'flex', gap: 16, paddingBottom: isLast ? 0 : 24, position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Linha vertical */}
      {!isLast && (
        <div style={{
          position: 'absolute', left: 4, top: 14, bottom: 0,
          width: 1, background: 'var(--gr2)', zIndex: 0,
        }} />
      )}

      {/* Dot de evolução */}
      <div style={{
        width: isFirst ? 10 : 8,
        height: isFirst ? 10 : 8,
        borderRadius: '50%',
        flexShrink: 0,
        marginTop: 5,
        zIndex: 1,
        background: isProcessing
          ? '#d97706'
          : isFailed
            ? '#dc2626'
            : isFirst ? evColor : 'var(--gr3)',
        boxShadow: isFirst && isCompleted ? `0 0 6px ${evColor}55` : 'none',
        transition: 'all 0.15s',
        animation: isProcessing ? 'pulse-dot 1.4s ease-in-out infinite' : 'none',
      }} />

      {/* Card conteúdo */}
      <div
        onClick={() => isCompleted && onOpen(analysis.id)}
        style={{
          flex: 1,
          padding: '12px 16px',
          borderRadius: 10,
          background: hovered && isCompleted
            ? 'var(--g50)'
            : isFailed
              ? '#fef2f2'
              : isProcessing
                ? '#fffbeb'
                : 'var(--ow)',
          border: `1px solid ${
            isFailed     ? '#fecaca' :
            isProcessing ? '#fde68a' :
            hovered && isCompleted ? 'var(--g200)' :
            'var(--gr2)'
          }`,
          cursor: isCompleted ? 'pointer' : 'default',
          transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
          boxShadow: hovered && isCompleted ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        }}
      >
        {/* Linha 1: data + badge + status chip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: 'var(--d)',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            {fmtDate(analysis.createdAt)}
          </span>

          {/* Badge template */}
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.7px',
            padding: '2px 8px', borderRadius: 20,
            background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
            textTransform: 'uppercase', flexShrink: 0,
          }}>
            {meta.label}
          </span>

          {/* Evolution chip — só em completed */}
          {isCompleted && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              padding: '2px 8px', borderRadius: 20,
              background: evChip.bg, color: evChip.color, border: `1px solid ${evChip.border}`,
              flexShrink: 0,
            }}>
              {evChip.label}
            </span>
          )}

          {/* Chip "Gerando" */}
          {isProcessing && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: '#92400e',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{
                width: 9, height: 9,
                border: '1.5px solid #fde68a',
                borderTopColor: '#d97706',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
                flexShrink: 0,
              }} />
              Analisando…
            </span>
          )}

          {/* Chip "Falhou" */}
          {isFailed && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: '#dc2626',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Falha na geração
            </span>
          )}
        </div>

        {/* Linha 2: escopo */}
        <div style={{
          fontSize: 11, color: 'var(--gr5)',
          marginBottom: 6,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {scopeLabel}{noteInfo}
        </div>

        {/* Linha 3: conteúdo dependente do estado */}
        {isCompleted && analysis.summary && (
          <div style={{
            fontSize: 12,
            color: 'var(--gr5)',
            lineHeight: 1.6,
            fontFamily: "'DM Sans', sans-serif",
            overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            marginBottom: 8,
          }}>
            {analysis.summary.slice(0, 180)}{analysis.summary.length > 180 ? '…' : ''}
          </div>
        )}

        {isProcessing && (
          /* Shimmer skeleton onde ficaria o summary */
          <div style={{ marginBottom: 8 }}>
            <div className="skel-pulse" style={{ height: 11, width: '80%', borderRadius: 4, marginBottom: 5, background: '#fde68a55' }} />
            <div className="skel-pulse" style={{ height: 11, width: '55%', borderRadius: 4, background: '#fde68a55' }} />
          </div>
        )}

        {isFailed && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 12, color: '#b91c1c',
              lineHeight: 1.5, marginBottom: 8,
              fontFamily: "'DM Sans', sans-serif",
            }}>
              {analysis.errorMessage || 'Não foi possível gerar a análise. Tente novamente.'}
            </div>
            <button
              onClick={e => { e.stopPropagation(); onRetry() }}
              style={{
                fontSize: 11, fontWeight: 600,
                padding: '4px 12px', borderRadius: 6,
                border: '1px solid #dc2626', color: '#dc2626',
                background: 'white', cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              Gerar nova análise
            </button>
          </div>
        )}

        {/* CTA ver análise — só em completed + hover */}
        {isCompleted && (
          <div style={{
            fontSize: 11, fontWeight: 600,
            color: hovered ? '#16a34a' : 'var(--gr4)',
            transition: 'color 0.15s',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Ver análise completa →
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

  const loadAnalyses = () => {
    if (!patient?.id) return
    setLoading(true)
    setError(null)
    api.getPatientAnalyses(patient.id, { size: 50 })
      .then(res => setAnalyses(res?.content || []))
      .catch(() => setError('Não foi possível carregar o histórico.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAnalyses() }, [patient?.id])

  const initials = patient?.name?.split(' ').slice(0, 2).map(w => w[0]).join('') || '?'

  const completedCount  = analyses.filter(a => a.status === 'completed').length
  const processingCount = analyses.filter(a => a.status === 'processing').length

  return (
    <div className="view" style={{ maxWidth: 720 }}>

      {/* ── Breadcrumb ── */}
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontSize: 12, color: 'var(--gr4)', fontFamily: "'DM Sans', sans-serif",
          marginBottom: 18, transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--d)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--gr4)'}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Insights
      </button>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 28,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'var(--g100)', color: 'var(--g700)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
          </div>
          <div>
            <div style={{
              fontFamily: "'Fraunces', serif",
              fontSize: 20, fontWeight: 400,
              color: 'var(--d)', letterSpacing: '-0.02em',
            }}>
              {patient?.name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gr5)', marginTop: 2 }}>
              {loading
                ? 'Carregando histórico…'
                : completedCount > 0
                  ? `${completedCount} análise${completedCount !== 1 ? 's' : ''} no histórico${processingCount > 0 ? ` · ${processingCount} gerando` : ''}`
                  : 'Análises clínicas com IA'}
            </div>
          </div>
        </div>

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
              boxShadow: '0 1px 4px rgba(34,197,94,0.3)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Nova análise
          </button>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {loading ? (
        <TimelineSkeleton />
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fca5a5" strokeWidth="1.2"
            style={{ margin: '0 auto 14px', display: 'block' }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ fontSize: 13, color: 'var(--gr5)', marginBottom: 14 }}>{error}</div>
          <button
            onClick={loadAnalyses}
            style={{
              fontSize: 12, fontWeight: 600, color: '#16a34a',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : analyses.length === 0 ? (
        // ── Empty state ──
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1"
            style={{ margin: '0 auto 18px', display: 'block' }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <div style={{
            fontSize: 15, fontWeight: 600,
            color: 'var(--d)', marginBottom: 8,
          }}>
            Nenhuma análise gerada ainda
          </div>
          <div style={{
            fontSize: 13, color: 'var(--gr5)', lineHeight: 1.7,
            maxWidth: 360, margin: '0 auto 24px',
          }}>
            Configure a primeira análise para começar a construir o histórico clínico de{' '}
            <strong>{patient?.name?.split(' ')[0]}</strong>.
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
            color: 'var(--gr4)', marginBottom: 20,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Histórico de análises · {analyses.length} registro{analyses.length !== 1 ? 's' : ''}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {analyses.map((a, idx) => (
              <AnalysisRow
                key={a.id}
                analysis={a}
                index={idx}
                total={analyses.length}
                isFirst={idx === 0}
                onOpen={(analysisId) => onOpenAnalysis(analysisId, patient)}
                onRetry={() => onNewAnalysis(patient)}
              />
            ))}
          </div>

          <div style={{
            marginTop: 28, paddingTop: 20,
            borderTop: '1px solid var(--gr2)',
            fontSize: 11, color: 'var(--gr4)', lineHeight: 1.6,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Cada análise é um registro gerado no momento da solicitação e reflete as anotações disponíveis naquela data.
            Hipóteses de suporte ao raciocínio clínico — diagnóstico é de responsabilidade exclusiva do profissional.
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
      `}</style>
    </div>
  )
}
