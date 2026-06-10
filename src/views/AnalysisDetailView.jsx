/**
 * AnalysisDetailView — Página dedicada por análise, com ID referenciável na URL.
 *
 * Suporta link compartilhado: ?view=analise&id={uuid}
 * Polling condicional quando status === 'processing'.
 *
 * Props:
 *   analysisId     string (UUID)
 *   patient        { id, name } — contexto de navegação (pode ser null se vindo de link externo)
 *   currentUser    { analysesRemaining, plan }
 *   onBack         () → volta para PatientAnalysisHub ou Insights
 *   onNewAnalysis  (patient) → abre AnalysisConfigModal
 */

import { useState, useEffect, useRef } from 'react'
import { api } from '../services'
import AiAnalysisPanel from '../components/AiAnalysisPanel'

// ── Constantes ────────────────────────────────────────────────────────────────

const UNLIMITED = 2147483647

const TEMPLATE_META = {
  null:         { label: 'Geral',        color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.25)'   },
  undefined:    { label: 'Geral',        color: '#4ade80', bg: 'rgba(74,222,128,0.12)',   border: 'rgba(74,222,128,0.25)'   },
  risk:         { label: 'Risco',        color: '#f87171', bg: 'rgba(248,113,113,0.12)',  border: 'rgba(248,113,113,0.25)'  },
  longitudinal: { label: 'Longitudinal', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.25)'  },
}

const MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']

function fmtDate(iso) {
  if (!iso) return '—'
  const d   = new Date(iso)
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

// ── Skeleton do painel de análise ─────────────────────────────────────────────

function AnalysisSkeleton() {
  const block = (w, h) => (
    <div className="skel-pulse" style={{ height: h, width: w, borderRadius: 6, marginBottom: 8 }} />
  )
  return (
    <div style={{ padding: '24px 0' }}>
      {block('55%', 14)}
      {block('80%', 11)}
      {block('70%', 11)}
      <div style={{ height: 20 }} />
      {block('40%', 14)}
      {block('92%', 11)}
      {block('85%', 11)}
      {block('60%', 11)}
      <div style={{ height: 20 }} />
      {block('50%', 14)}
      {block('78%', 11)}
      {block('65%', 11)}
    </div>
  )
}

// ── New analysis button (floating) ────────────────────────────────────────────

function FloatingNewAnalysis({ patient, remaining, plan, onClick }) {
  const isUnlimited = remaining >= UNLIMITED || plan === 'especialista' || plan === 'clinico'
  const isPPU = !isUnlimited && remaining <= 0
  const label = isPPU
    ? `Nova análise · R$4,90`
    : isUnlimited
      ? 'Nova análise'
      : `Nova análise · ${remaining} restante${remaining !== 1 ? 's' : ''}`

  return (
    <button
      onClick={() => patient && onClick(patient)}
      style={{
        position: 'fixed',
        bottom: 76,   // acima do BottomNav em mobile
        right: 20,
        zIndex: 600,
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '10px 18px', borderRadius: 22,
        background: 'linear-gradient(135deg, #4ade80 0%, #22c55e 100%)',
        border: 'none', color: '#0a1a0f',
        fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
        cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(74,222,128,0.35)',
        transition: 'box-shadow 0.15s, transform 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 28px rgba(74,222,128,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(74,222,128,0.35)'; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
      {label}
    </button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AnalysisDetailView({ analysisId, patient, currentUser, onBack, onNewAnalysis }) {
  const [analysis, setAnalysis]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [copied, setCopied]         = useState(false)
  const pollingRef                  = useRef(null)

  const remaining = currentUser?.analysesRemaining ?? 0
  const plan      = currentUser?.plan ?? 'consultorio'

  // Atualiza URL para ser referenciável/compartilhável
  useEffect(() => {
    if (!analysisId) return
    const params = new URLSearchParams(window.location.search)
    params.set('view', 'analise')
    params.set('id', analysisId)
    window.history.replaceState({}, '', `${window.location.pathname}?${params}`)
    return () => {
      // Limpa URL ao sair da view
      const p = new URLSearchParams(window.location.search)
      if (p.get('view') === 'analise') {
        p.delete('view'); p.delete('id')
        const q = p.toString()
        window.history.replaceState({}, '', q ? `${window.location.pathname}?${q}` : window.location.pathname)
      }
    }
  }, [analysisId])

  useEffect(() => {
    if (!analysisId) { setError('ID de análise inválido.'); setLoading(false); return }
    setLoading(true)
    setError(null)

    const startPolling = (id) => {
      pollingRef.current = setInterval(async () => {
        try {
          const status = await api.getAnalysisStatus?.(id) ?? await api.getAnalysis(id)
          const s = status?.status
          if (s === 'completed') {
            clearInterval(pollingRef.current)
            const full = await api.getAnalysis(id)
            setAnalysis(full)
            setLoading(false)
          } else if (s === 'failed') {
            clearInterval(pollingRef.current)
            setError(status.errorMessage || 'Falha ao gerar a análise.')
            setLoading(false)
          }
        } catch { /* rede transitória — tenta de novo */ }
      }, 3000)
    }

    api.getAnalysis(analysisId)
      .then(data => {
        if (!data) { setError('Análise não encontrada.'); setLoading(false); return }
        if (data.status === 'processing') {
          // Mantém loading e inicia polling
          startPolling(analysisId)
        } else if (data.status === 'failed') {
          setError(data.errorMessage || 'Falha ao gerar a análise.')
          setLoading(false)
        } else {
          setAnalysis(data)
          setLoading(false)
        }
      })
      .catch(() => { setError('Não foi possível carregar a análise.'); setLoading(false) })

    return () => clearInterval(pollingRef.current)
  }, [analysisId])

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?view=analise&id=${analysisId}`
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const meta       = templateMeta(analysis?.template)
  const patientObj = patient || (analysis ? { id: analysis.patientId, name: analysis.patientName } : null)
  const initials   = patientObj?.name?.split(' ').slice(0, 2).map(w => w[0]).join('') || '?'

  return (
    <div className="view" style={{ maxWidth: 720 }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        paddingBottom: 16, marginBottom: 20,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexWrap: 'wrap',
      }}>
        {/* Back */}
        <button
          onClick={onBack}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            fontSize: 12, color: 'var(--gr4)', fontFamily: "'DM Sans', sans-serif",
            transition: 'color 0.15s', flexShrink: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--d)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--gr4)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          {patientObj?.name || 'Voltar'}
        </button>

        <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 12 }}>·</span>

        {/* Patient avatar + analysis title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(74,222,128,0.15)', color: '#4ade80',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, flexShrink: 0,
          }}>
            {initials}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--d)', fontFamily: "'Fraunces', serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {patientObj?.name}
          </span>
        </div>

        {/* Metadata chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
          {analysis?.template !== undefined && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 20,
              background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
            }}>
              {meta.label}
            </span>
          )}
          {analysis?.createdAt && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
              {fmtDate(analysis.createdAt)}
            </span>
          )}
          {analysis?.sessionCount > 0 && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>
              {analysis.sessionCount} anotação{analysis.sessionCount !== 1 ? 'ões' : ''}
            </span>
          )}
          {/* Token usage */}
          {(analysis?.inputTokens || analysis?.outputTokens) && (
            <span style={{
              fontSize: 10, color: 'rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 6, padding: '3px 8px',
              whiteSpace: 'nowrap', fontFamily: 'monospace',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: 9 }}>
                {analysis.model?.includes('haiku') ? 'haiku' : analysis.model?.includes('sonnet') ? 'sonnet' : analysis.model?.split('-')[1] ?? 'ai'}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>·</span>
              <span title="tokens de entrada">
                {(analysis.inputTokens ?? 0) >= 1000
                  ? `${((analysis.inputTokens) / 1000).toFixed(1)}k`
                  : analysis.inputTokens} in
              </span>
              <span style={{ color: 'rgba(255,255,255,0.12)' }}>·</span>
              <span title="tokens de saída">
                {(analysis.outputTokens ?? 0) >= 1000
                  ? `${((analysis.outputTokens) / 1000).toFixed(1)}k`
                  : analysis.outputTokens} out
              </span>
            </span>
          )}
          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            title="Copiar link desta análise"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '4px 7px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: copied ? '#4ade80' : 'rgba(255,255,255,0.3)',
              fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            {copied ? (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Copiado
              </>
            ) : (
              <>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copiar link
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      {loading ? (
        <div>
          {/* Feedback de progresso quando está gerando */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '12px 16px', borderRadius: 10, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
            <span style={{ width: 14, height: 14, border: '2px solid rgba(74,222,128,0.25)', borderTopColor: '#4ade80', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'rgba(74,222,128,0.7)', fontFamily: "'DM Sans', sans-serif" }}>
              Carregando análise clínica…
            </span>
          </div>
          <AnalysisSkeleton />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1"
            style={{ margin: '0 auto 16px', display: 'block' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="11"/><line x1="11" y1="14" x2="11.01" y2="14"/>
          </svg>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
            Análise não encontrada
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, marginBottom: 20 }}>
            {error}
          </div>
          <button
            onClick={onBack}
            style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            ← Voltar para {patientObj?.name || 'as análises'}
          </button>
        </div>
      ) : analysis ? (
        /* AiAnalysisPanel existente renderiza o conteúdo completo */
        <AiAnalysisPanel
          sessionId={analysis.noteId || null}
          analysis={analysis}
          createdAt={analysis.createdAt}
        />
      ) : null}

      {/* ── Botão flutuante Nova análise ── */}
      {!loading && !error && patientObj && (
        <FloatingNewAnalysis
          patient={patientObj}
          remaining={remaining}
          plan={plan}
          onClick={onNewAnalysis}
        />
      )}
    </div>
  )
}
